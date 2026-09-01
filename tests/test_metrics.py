from seoul_shield.metrics import TradeComparison, loss_avoided, trust_score


def test_loss_avoided_direction_and_rejection_decomposition():
    result = loss_avoided(TradeComparison(-500, 0, 2, 0, -250))
    assert result["total"] == 500
    assert result["rejection"] == 500


def test_loss_avoided_only_when_no_guard_loses():
    assert loss_avoided(TradeComparison(200, 0, 2, 0, 100))["eligible"] is False


def test_trust_weights_are_fixed_and_visible():
    result = trust_score(loss_protection=1, drawdown_control=1,
                         opportunity_efficiency=1, gate_precision=1,
                         hard_limit_compliance=1, evidence_completeness=1)
    assert result["score"] == 100
    assert sum(result["weights"].values()) == 1
