from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "evidence" / "preflight" / "2026-09-03T081011Z-paper-preflight.json"
DESTINATION = ROOT / "evidence" / "ai" / "2026-09-03-gemini-ai-verified.json"


source = json.loads(SOURCE.read_text(encoding="utf-8"))
model = source["ai"]["evidence"]
if not source["ai"]["structured_call_ok"] or model["response"] is None:
    raise SystemExit("Source evidence is not a verified structured AI result.")

record = {
    "schema_version": "seoul-shield.ai-evidence.v1",
    "status": "AI VERIFIED",
    "provider": model["provider"],
    "model": model["model"],
    "recorded_at": source["generated_at"],
    "input_sha256": model["input_sha256"],
    "local_schema_validated": True,
    "structured_response": model["response"],
    "latency_ms": model["latency_ms"],
    "order_authority": False,
    "hard_gate_final_authority": True,
}
canonical = json.dumps(record, sort_keys=True, separators=(",", ":")).encode("utf-8")
record["evidence_sha256"] = hashlib.sha256(canonical).hexdigest()
DESTINATION.parent.mkdir(parents=True, exist_ok=True)
DESTINATION.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(json.dumps({
    "file": str(DESTINATION.relative_to(ROOT)),
    "status": record["status"],
    "model": record["model"],
    "input_sha256": record["input_sha256"],
    "evidence_sha256": record["evidence_sha256"],
    "local_schema_validated": record["local_schema_validated"],
}))
