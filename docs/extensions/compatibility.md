# Compatibility policy

Extension compatibility has three independent versions:

- `manifestVersion`: package metadata schema.
- `engines.hostApi`: activation and contribution API.
- `engines.rebook`: `Book`, parser, renderer, and plugin types used at build time.

Manifest v1 and Host API v1 are frozen. Additive optional fields do not require a new major version. Removing fields, changing meanings, or widening privileges requires a new major version.

Hosts and the marketplace reject unsupported manifest/Host API versions before
importing code. Marketplace publication rejects invalid SemVer.
`engines.rebook` is recorded for compatibility review and future automated
range negotiation; Host API v1 is the enforceable runtime boundary today.

Deprecated APIs remain documented for at least one minor release and produce development warnings before removal in a new major version.
