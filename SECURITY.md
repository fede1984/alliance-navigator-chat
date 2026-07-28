# Security Policy

## Secrets

Never commit API keys, credentials, access tokens, or populated environment
files. Local credentials belong in `.env` or `.env.*.local`, which Git ignores.
Only placeholders belong in `.env.example`.

Provider keys are read by the Node.js backend. They must not use the `VITE_`
prefix because Vite exposes prefixed values to browser code at build time.
Production credentials must be configured through the deployment platform's
secret manager.

Use separate development and production credentials with the least available
privilege, provider-side quotas, and rotation. Revoke and replace a credential
immediately if it may have been exposed; deleting it from the latest commit is
not sufficient because Git retains history.

## Public demo

Keeping provider credentials on the server prevents direct disclosure, but it
does not prevent visitors from consuming the server's quota. A deployment must
retain the endpoint rate limit, set provider spending limits, and add
authentication when usage should be restricted.

Set `TRUST_PROXY=true` only behind a trusted reverse proxy that replaces,
rather than blindly forwards, the client-supplied `X-Forwarded-For` header.

## Reporting

Do not open a public issue containing a suspected secret. Revoke the credential
first, then contact the repository owner privately through their GitHub profile.
