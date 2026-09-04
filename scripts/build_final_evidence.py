from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from seoul_shield.evidence_package import build_public_evidence


def main() -> None:
    parser = argparse.ArgumentParser(description="Build sanitized final public evidence after real Paper execution.")
    parser.add_argument("--execution", type=Path, required=True,
                        help="Private sanitized execution evidence JSON (never the raw account export).")
    parser.add_argument("--output", type=Path,
                        default=ROOT / "app" / "public" / "data" / "final-evidence.json")
    args = parser.parse_args()
    payload = json.loads(args.execution.read_text(encoding="utf-8"))
    public = build_public_evidence(payload)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(public, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "evidence_sha256": public["evidence_sha256"]}))


if __name__ == "__main__":
    main()
