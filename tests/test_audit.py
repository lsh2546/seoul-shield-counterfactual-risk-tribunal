import json

from seoul_shield.audit import append_event, verify_chain


def test_hash_chain_detects_tampering(tmp_path):
    path = tmp_path / "events.jsonl"
    append_event(path, {"type": "signal", "value": 1})
    append_event(path, {"type": "decision", "value": 2})
    assert verify_chain(path)[0]
    lines = path.read_text(encoding="utf-8").splitlines()
    record = json.loads(lines[0])
    record["value"] = 99
    lines[0] = json.dumps(record)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    assert not verify_chain(path)[0]
