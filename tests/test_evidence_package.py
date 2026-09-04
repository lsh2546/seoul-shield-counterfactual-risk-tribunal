import pytest

from seoul_shield.evidence_package import build_public_evidence


def complete_payload():
    return {
        "ai": {"status": "AI VERIFIED", "local_schema_validated": True},
        "market": {"quote_timestamp_utc": "2026-09-03T14:30:00Z"},
        "blocked_order": {"reason": "risk cap"},
        "safe_alternative": {"max_loss": 800},
        "human_approval": {"decision": "APPROVED", "timestamp_utc": "2026-09-03T14:31:00Z"},
        "paper_order": {"id": "paper-order", "environment": "PAPER TRADING", "account_id": "private"},
        "order_timeline": [
            {"status": "submitted"}, {"status": "accepted"}, {"status": "filled"},
        ],
        "execution": {"filled_qty": 1, "avg_fill_price": 2.5},
        "position": {"qty": 1}, "paper_pnl": {"unrealized": 0},
        "audit_chain": {"verified": True, "head_hash": "a" * 64},
        "tests": {"passed": 1}, "reproduction": ["python -m pytest tests -q"],
    }


def test_final_evidence_refuses_missing_execution_fields():
    with pytest.raises(ValueError, match="missing final evidence"):
        build_public_evidence({"ai": {}})


def test_final_evidence_is_sanitized_and_hashed():
    result = build_public_evidence(complete_payload())
    assert "account_id" not in result["paper_order"]
    assert result["credentials_present"] is False
    assert len(result["evidence_sha256"]) == 64
