import json
from dataclasses import asdict

from seoul_shield.alpaca_client import AlpacaClient


if __name__ == "__main__":
    result = AlpacaClient().check_competition_account()
    safe = asdict(result)
    safe["account_number"] = ("***" + result.account_number[-4:]) if result.account_number else ""
    print(json.dumps(safe, indent=2))
