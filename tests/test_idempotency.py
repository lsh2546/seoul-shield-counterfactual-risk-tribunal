from seoul_shield.idempotency import IdempotencyStore


def test_same_signal_reuses_reserved_id_and_new_signal_is_unique(tmp_path):
    store = IdempotencyStore(tmp_path / "orders.sqlite3")
    first = store.reserve("signal-a")
    assert store.reserve("signal-a") == first
    assert store.reserve("signal-b") != first
