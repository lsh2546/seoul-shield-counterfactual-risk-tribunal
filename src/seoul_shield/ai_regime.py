from __future__ import annotations

import json
import os
import time
import hashlib
import subprocess
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass

from .models import AIRegime, MarketSnapshot


REGIME_SCHEMA = {
    "type": "object",
    "properties": {
        "regime": {"type": "string", "enum": ["calm", "trending", "volatile", "dislocated"]},
        "volatility_risk": {"type": "string", "enum": ["low", "medium", "high"]},
        "liquidity_risk": {"type": "string", "enum": ["low", "medium", "high"]},
        "event_risk": {"type": "string", "enum": ["low", "medium", "high"]},
        "direction": {"type": "string", "enum": ["bullish", "bearish", "neutral"]},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "risk_multiplier": {"type": "number", "enum": [0, 0.25, 0.5, 0.75, 1]},
        "reasons": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 4},
    },
    "required": ["regime", "volatility_risk", "liquidity_risk", "event_risk",
                 "direction", "confidence", "risk_multiplier", "reasons"],
    "additionalProperties": False,
}


@dataclass(frozen=True)
class ModelEvidence:
    input: dict
    input_sha256: str
    provider: str
    model: str
    response: dict | None
    latency_ms: int
    timed_out: bool
    fallback: str | None
    error_type: str | None


def _input_hash(value: dict) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _validate_regime(value: object) -> dict:
    if not isinstance(value, dict):
        raise ValueError("model output must be an object")
    required = set(REGIME_SCHEMA["required"])
    if set(value) != required:
        raise ValueError("model output fields do not match the locked schema")
    enums = {
        "regime": {"calm", "trending", "volatile", "dislocated"},
        "volatility_risk": {"low", "medium", "high"},
        "liquidity_risk": {"low", "medium", "high"},
        "event_risk": {"low", "medium", "high"},
        "direction": {"bullish", "bearish", "neutral"},
        "risk_multiplier": {0, 0.25, 0.5, 0.75, 1},
    }
    for name, allowed in enums.items():
        if value[name] not in allowed:
            raise ValueError(f"invalid {name}")
    if not isinstance(value["confidence"], (int, float)) or not 0 <= value["confidence"] <= 1:
        raise ValueError("confidence outside [0, 1]")
    reasons = value["reasons"]
    if not isinstance(reasons, list) or not 1 <= len(reasons) <= 4 or not all(isinstance(x, str) for x in reasons):
        raise ValueError("reasons must contain one to four strings")
    return value


def _json_from_message(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return _validate_regime(json.loads(cleaned))


def _json_object_from_message(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    value = json.loads(cleaned)
    if not isinstance(value, dict):
        raise ValueError("model output must be an object")
    return value


def _gemini_candidates(api_key: str, *, timeout_seconds: float = 8) -> list[str]:
    request = urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/models",
        headers={"x-goog-api-key": api_key},
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        models = json.loads(response.read()).get("models", [])
    candidates = []
    for item in models:
        name = str(item.get("name", "")).removeprefix("models/")
        methods = item.get("supportedGenerationMethods", [])
        lowered = name.lower()
        if ("generateContent" not in methods or not lowered.startswith("gemini-")
                or any(token in lowered for token in (
                    "preview", "experimental", "exp-", "image", "tts", "audio",
                    "robotics", "computer-use", "embedding", "aqa"))):
            continue
        candidates.append(name)

    def preference(name: str) -> tuple[int, tuple[int, ...], str]:
        lowered = name.lower()
        family = 3 if "flash" in lowered and "lite" not in lowered else 2 if "flash-lite" in lowered else 1
        version = tuple(int(part) for part in lowered.replace("-", ".").split(".") if part.isdigit())
        return family, version, name

    return sorted(set(candidates), key=preference, reverse=True)


def _gemini_generate(api_key: str, model: str, payload: dict, *, timeout_seconds: float) -> dict:
    request = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(payload).encode(), method="POST",
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        return json.loads(response.read())


def _gemini_payload(prompt: str, schema: dict, *, max_output_tokens: int) -> dict:
    return {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": max_output_tokens,
            "thinkingConfig": {"thinkingBudget": 0},
            "responseMimeType": "application/json",
            "responseJsonSchema": schema,
        },
    }


def _google_request(safe_input: dict, schema: dict, *, timeout_seconds: float):
    developer_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    requested = os.getenv("AI_PROVIDER", "vertex").lower()
    model = "auto"
    if requested == "gemini" or developer_key:
        if not developer_key:
            raise RuntimeError("missing_gemini_api_key")
        provider = "gemini_developer"
        candidates = _gemini_candidates(developer_key)
        if not candidates:
            raise RuntimeError("no_generate_content_model")
        probe_schema = {
            "type": "object", "properties": {"ok": {"type": "boolean"}},
            "required": ["ok"], "additionalProperties": False,
        }
        deadline = time.monotonic() + 15 * 60
        last_error: Exception | None = None
        for candidate in candidates:
            if time.monotonic() >= deadline:
                break
            probe = _gemini_payload("Return {\"ok\":true}.", probe_schema, max_output_tokens=128)
            probe_ok = False
            for attempt in range(3):
                try:
                    raw_probe = _gemini_generate(
                        developer_key, candidate, probe,
                        timeout_seconds=min(10 + attempt * 4, max(timeout_seconds, 10)),
                    )
                    probe_text = raw_probe["candidates"][0]["content"]["parts"][0]["text"]
                    probe_ok = json.loads(probe_text).get("ok") is True
                    if probe_ok:
                        break
                except urllib.error.HTTPError as exc:
                    last_error = exc
                    if exc.code != 503:
                        break
                    time.sleep(0.5 * (2 ** attempt))
                except (TimeoutError, urllib.error.URLError) as exc:
                    last_error = exc
                    if attempt > 0:
                        break
            if not probe_ok:
                continue
            prompt = (
                "Classify execution risk. Do not authorize orders; deterministic gates decide. JSON input:"
                + json.dumps(safe_input, sort_keys=True, separators=(",", ":"))
            )
            payload = _gemini_payload(prompt, schema, max_output_tokens=512)
            try:
                raw = _gemini_generate(
                    developer_key, candidate, payload,
                    timeout_seconds=max(timeout_seconds, 20),
                )
            except (TimeoutError, urllib.error.URLError):
                compact = {key: safe_input[key] for key in (
                    "underlying", "volatility_percentile", "bid_ask_spread_pct",
                    "open_interest", "quote_age_seconds", "recent_return_pct") if key in safe_input}
                retry_prompt = "Classify execution risk. JSON input:" + json.dumps(
                    compact, sort_keys=True, separators=(",", ":"))
                raw = _gemini_generate(
                    developer_key, candidate,
                    _gemini_payload(retry_prompt, schema, max_output_tokens=384),
                    timeout_seconds=max(timeout_seconds, 30),
                )
            text = raw["candidates"][0]["content"]["parts"][0]["text"]
            parsed = (_json_from_message(text) if schema == REGIME_SCHEMA
                      else _json_object_from_message(text))
            return provider, str(raw.get("modelVersion", candidate)), parsed, raw.get("createTime")
        if last_error:
            raise last_error
        raise RuntimeError("no_structured_gemini_model_succeeded")
    else:
        provider = "vertex_ai"
        project = os.getenv("GOOGLE_CLOUD_PROJECT")
        if not project:
            project = subprocess.check_output(
                ["gcloud", "config", "get-value", "project"], text=True,
                stderr=subprocess.DEVNULL, timeout=5).strip()
        if not project or project == "(unset)":
            raise RuntimeError("missing_google_cloud_project")
        location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        token = subprocess.check_output(
            ["gcloud", "auth", "print-access-token"], text=True,
            stderr=subprocess.DEVNULL, timeout=10).strip()
        if not token:
            raise RuntimeError("missing_vertex_access_token")
        model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        url = (f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/"
               f"{location}/publishers/google/models/{model}:generateContent")
        prompt = "Classify execution risk. JSON input:" + json.dumps(safe_input, sort_keys=True)
        payload = _gemini_payload(prompt, schema, max_output_tokens=256)
        request = urllib.request.Request(
            url, data=json.dumps(payload).encode(), method="POST",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            raw = json.loads(response.read())
    text = raw["candidates"][0]["content"]["parts"][0]["text"]
    return provider, str(raw.get("modelVersion", model)), _json_from_message(text), raw.get("createTime")


def _extract_output_text(response: dict) -> str:
    if isinstance(response.get("output_text"), str):
        return response["output_text"]
    for item in response.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                return str(content.get("text", ""))
    raise ValueError("response contains no output text")


def static_fallback(snapshot: MarketSnapshot) -> AIRegime:
    unsafe = snapshot.quote_age_seconds > 30 or snapshot.bid_ask_spread_pct > 0.20
    return AIRegime(
        regime="dislocated" if unsafe else "volatile" if snapshot.volatility_percentile > .8 else "calm",
        volatility_risk="high" if snapshot.volatility_percentile > .8 else "medium",
        liquidity_risk="high" if unsafe else "medium",
        event_risk="medium", direction="neutral", confidence=0,
        risk_multiplier=0 if unsafe else .5,
        reasons=("model unavailable; deterministic fail-closed fallback applied",),
    )


def assess_market(snapshot: MarketSnapshot, *, timeout_seconds: float = 12) -> tuple[AIRegime, ModelEvidence]:
    safe_input = asdict(snapshot)
    input_sha256 = _input_hash(safe_input)
    google_requested = os.getenv("AI_PROVIDER", "").lower() in {"vertex", "gemini"}
    featherless_key = os.getenv("FEATHERLESS_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    provider = ("vertex_ai" if os.getenv("AI_PROVIDER", "").lower() == "vertex"
                else "gemini_developer" if os.getenv("AI_PROVIDER", "").lower() == "gemini"
                else "featherless" if featherless_key else "openai")
    key = ("google-auth" if google_requested else featherless_key or openai_key)
    model = (os.getenv("GEMINI_MODEL", "gemini-3.6-flash") if google_requested
             else os.getenv("FEATHERLESS_MODEL", "Qwen/Qwen2.5-7B-Instruct")
             if featherless_key else os.getenv("OPENAI_MODEL", "gpt-5-mini"))
    started = time.perf_counter()
    if not key:
        fallback = static_fallback(snapshot)
        return fallback, ModelEvidence(safe_input, input_sha256, provider, model, None, 0, False,
                                       "static_guard", "missing_api_key")
    if google_requested:
        try:
            google_provider, actual_model, parsed, _created_at = _google_request(
                safe_input, REGIME_SCHEMA, timeout_seconds=timeout_seconds)
            regime = AIRegime(**{**parsed, "reasons": tuple(parsed["reasons"])})
            evidence = ModelEvidence(safe_input, input_sha256, google_provider, actual_model, parsed,
                                     int((time.perf_counter() - started) * 1000), False, None, None)
            return regime, evidence
        except Exception as exc:
            fallback = static_fallback(snapshot)
            error_type = (f"HTTP_{exc.code}" if isinstance(exc, urllib.error.HTTPError)
                          else type(exc).__name__)
            evidence = ModelEvidence(safe_input, input_sha256, provider, model, None,
                                     int((time.perf_counter() - started) * 1000), False,
                                     "static_guard", error_type)
            return fallback, evidence
    if featherless_key:
        schema_text = json.dumps(REGIME_SCHEMA, sort_keys=True)
        payload = {
            "model": model,
            "temperature": 0,
            "max_tokens": 500,
            "messages": [
                {"role": "system", "content": (
                    "Classify market and execution risk. Never authorize an order. "
                    "Return exactly one JSON object, without markdown, matching this schema: " + schema_text)},
                {"role": "user", "content": json.dumps(safe_input, sort_keys=True)},
            ],
        }
        request = urllib.request.Request(
            "https://api.featherless.ai/v1/chat/completions",
            data=json.dumps(payload).encode(), method="POST",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                     "HTTP-Referer": "https://seoul-shield-risk-tribunal.ljs2546.chatgpt.site/",
                     "X-Title": "Seoul Shield"},
        )
    else:
        payload = {
            "model": model,
            "store": False,
            "instructions": "Classify market and execution risk. Never authorize an order. Return only schema data.",
            "input": json.dumps(safe_input, sort_keys=True),
            "text": {"format": {"type": "json_schema", "name": "market_risk",
                                "strict": True, "schema": REGIME_SCHEMA}},
        }
        request = urllib.request.Request(
            "https://api.openai.com/v1/responses", data=json.dumps(payload).encode(), method="POST",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            raw = json.loads(response.read())
        if provider == "featherless":
            parsed = _json_from_message(raw["choices"][0]["message"]["content"])
        else:
            parsed = _validate_regime(json.loads(_extract_output_text(raw)))
        regime = AIRegime(**{**parsed, "reasons": tuple(parsed["reasons"])})
        evidence = ModelEvidence(safe_input, input_sha256, provider,
                                 str(raw.get("model", model)), parsed,
                                 int((time.perf_counter() - started) * 1000), False, None, None)
        return regime, evidence
    except Exception as exc:
        timed_out = isinstance(exc, (TimeoutError, urllib.error.URLError)) and "timed out" in str(exc).lower()
        fallback = static_fallback(snapshot)
        evidence = ModelEvidence(safe_input, input_sha256, provider, model, None,
                                 int((time.perf_counter() - started) * 1000), timed_out,
                                 "static_guard", type(exc).__name__)
        return fallback, evidence
