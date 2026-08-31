# Security

Mango Tree is a single-owner platform that holds real credentials: IMAP and SMTP
passwords, Gmail and Outlook OAuth refresh tokens, Strava tokens, and API keys
for whichever model providers you configure. That is why this file exists on an
otherwise small project.

## Reporting a vulnerability

Use this repository's **Security** tab → *Report a vulnerability*, not a public
issue. If that option is not offered, private vulnerability reporting has not
been enabled here yet; open an issue asking for a contact address and nothing
more, and wait for a reply before saying anything further. Please include what you did, what happened, and the
version or commit you were on. This is a personal project maintained by one
person — expect a reply in days, not hours, and no bounty.

## What is in scope

Anything that lets a request reach data without the owner's session: an endpoint
missing the `IsAuthenticated` default, a way past the signup lock, a tool that
executes for a disabled tool group, a path traversal out of the artifact store,
or a credential that leaks into a log, an API response, or the agent's context.

## What is not

The deployment is yours. Running it on a public host without TLS, with
`DJANGO_DEBUG` on, or with `DJANGO_ALLOWED_HOSTS` left at the default is a
configuration choice, not a vulnerability — see the Security section of the
README for the one trap that catches people. Denial of service against your own
instance is out of scope, as is anything requiring the owner's own session
cookie.

## Where the sensitive parts live

| Concern | Path |
| --- | --- |
| Login, signup lock, IP lockout, audit log | `utils/shared/auth/` |
| Tool gating, enforced twice | `utils/agents/`, `config/tools.yaml` |
| Provider keys | `.env` and the `mango_llm` tables — never `config/models.yaml` |
| Declared filesystem and network scopes | `config/permissions.yaml` |
