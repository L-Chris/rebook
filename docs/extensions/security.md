# Security and permissions

Extension code is untrusted input. A catalog listing, HTTPS URL, or publisher name is not proof of safety.

## Trust levels

- `builtin`: shipped and reviewed with the host.
- `verified`: immutable artifact that passed automated checks and manual review.
- `unverified`: discoverable metadata only; it must not execute in the trusted host runtime.

Phase one executes only `builtin` and `verified` artifacts in the trusted runtime.

## Trusted runtime

Trusted code shares the page's JavaScript realm and can technically reach browser state. Therefore it requires:

- immutable artifact URL
- server-generated SHA-256 integrity
- exact published version
- manual review
- declared permissions
- revocation support

## Sandbox runtime

Public, unverified extensions use Worker or iframe RPC. The host passes capability-scoped handles rather than raw DOM, storage, credentials, or complete `Book` objects.

See [Worker and iframe sandbox](./sandbox.md) for the protocol, opaque-origin
boundary, CSP, and the Host API v1 capability surface.

## Network access

`network` requires `allowedHosts`, and wildcard access is reserved for built-ins.
In Host API v1 this is an admission/review declaration for trusted extensions,
not a hard browser boundary: trusted code shares the page realm and can reach
browser APIs directly. Worker/iframe extensions receive no network capability
and CSP blocks their direct connections. A future brokered network API can
enforce host and redirect checks without widening the current sandbox contract.

## Secrets

Browser storage cannot protect a secret from trusted same-page JavaScript. Hosts must never expose application or other-extension credentials through the extension context. A setting marked `secret` is masked and isolated by convention, not cryptographically hidden from trusted code.

## Revocation

Clients refresh the official catalog before third-party activation and fail
closed when that refresh is unavailable. They block revoked `(id, version,
integrity)` tuples; previously cached bytes remain inert until the listing is
published again. Installed versions are pinned, so a newly published version
requires an explicit user update before its code runs.
