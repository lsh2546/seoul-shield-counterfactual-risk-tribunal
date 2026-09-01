import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def bundle():
    return json.loads((ROOT / "app/public/data/preview.json").read_text(encoding="utf-8"))


def test_replay_counts_and_selected_contract_values():
    data = bundle()
    counts = {}
    for contract in data["terrain"]:
        counts[contract["classification"]] = counts.get(contract["classification"], 0) + 1
    assert len(data["terrain"]) == 245
    assert counts == {"RISK BLOCKED": 144, "UNCERTAIN": 80, "OPPORTUNITY": 21}
    assert data["selection"]["long"]["symbol"] == "SPY260904C00765000"
    assert data["selection"]["short"]["symbol"] == "SPY260904C00770000"
    assert data["selection"]["long"]["open_interest"] == 1909
    assert data["selection"]["short"]["open_interest"] == 4486
    assert data["selection"]["requested_contracts"] == 4
    assert data["selection"]["max_loss"] == 1096.0


def test_replay_block_reasons_and_safety_labels_are_explicit():
    data = bundle()
    reasons = {contract["classification_reason"] for contract in data["terrain"]}
    assert "WIDE SPREAD" in reasons
    assert "LOW LIQUIDITY" in reasons
    assert data["selection"]["quote_age_seconds"] > 30
    assert data["risk"]["hard_gate"] == "BLOCKED"
    assert "per-trade risk limit exceeded" in data["risk"]["reasons"]
    assert data["ai_status"] == "FALLBACK / NOT LIVE AI"
    assert data["preview"]["status"] == "NOT SUBMITTED"
    assert data["preview"]["allow_submit"] is False
