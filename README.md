# Seoul Shield

Risk-first AI options agent for the Alpaca AI Trading Agents Hackathon.

The AI/research layer proposes a thesis and a two-leg debit spread. A separate,
deterministic risk engine checks defined loss, position size, portfolio exposure,
expiration, and a daily-loss kill switch. Only approved orders reach the
paper-only broker adapter. Every proposal, rejection, and preview is recorded.

## Safe quick start

```powershell
py -m venv .venv
.venv\Scripts\python -m pip install -e .
.venv\Scripts\python -m seoul_shield.cli
```

The default is preview-only. Submission additionally requires `--execute`, paper
API credentials, and `ALPACA_ALLOW_SUBMIT=true`. Never use live account keys.

## Connect the dedicated competition account

Set the credentials only in your local shell or an untracked `.env` file. Do not
paste them into chat, source files, screenshots, or the repository.

```powershell
$env:ALPACA_API_KEY="your-paper-key"
$env:ALPACA_SECRET_KEY="your-paper-secret"
$env:PYTHONPATH="src"
py scripts/check_account.py
```

The check masks the account number and reports account status, equity, buying
power, options approval level, trading restrictions, and whether the initial
balance appears to be $100,000. A vertical spread requires options level 3.

Before any submission, replace the sample option symbols and quotes with current
contracts returned by Alpaca, review the preview, and confirm the dedicated
competition account still has the required $100,000 starting balance.
