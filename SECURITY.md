# Security Policy

Seoul Shield is a hackathon prototype designed for Alpaca Paper Trading only.

## Never commit

- `.env` files or API credentials
- Full account identifiers, emails, or authentication tokens
- Private audit/runtime databases or raw logs
- Unsanitized broker or model responses

The repository's `.gitignore` excludes these artifacts. Public replay data must set `security.contains_credentials=false` and `security.contains_full_account_number=false`.

## Execution safety

The default and public configuration is `ALPACA_ALLOW_SUBMIT=false`. The public app contains no broker credentials, submission API route, or order controls. Never use live-account credentials with this project.

## Reporting

Do not open a public issue containing a credential or account identifier. Revoke any accidentally exposed key immediately before reporting the affected file and commit hash privately to the repository owner.
