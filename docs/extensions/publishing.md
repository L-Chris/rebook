# Publishing workflow

Trusted uploads are submissions, not immediate releases. Sandboxed submissions
may become discoverable before moderation, but never receive trusted execution.

1. Authenticate a publisher account.
2. Upload a ZIP package for a new immutable version.
3. Pass archive, manifest, engine, permission, and static checks.
4. Review the generated permission diff and build metadata.
5. Submit for manual review.
6. An administrator approves or rejects the version.
7. Approved artifacts are copied to the extension CDN and added to the catalog.

## HTTP workflow

Publishers can use the Web developer center at `/extensions/publish` to upload
packages, inspect validation warnings, submit drafts for review, and track the
state of every immutable version. The page requires a signed-in account; a
verified email is required before uploading.

The official service exposes the following versioned workflow:

```text
POST /api/extensions/submissions                 # multipart file=<ZIP>
GET  /api/extensions/submissions/mine
POST /api/extensions/versions/:versionId/submit
GET  /api/extensions/versions/:versionId/package

GET  /api/extensions/review-queue                # administrator
POST /api/extensions/versions/:versionId/review  # administrator
POST /api/extensions/versions/:versionId/revoke  # administrator
```

Uploading creates a draft; it never publishes code. Approval produces an
immutable catalog artifact with server-computed size and SHA-256 integrity.

Review states are `draft`, `submitted`, `scanning`, `approved`, `rejected`, and `revoked`.

## CLI submission example

The current publisher API uses the same cookie session and CSRF protection as
the Web application. Keep credentials out of shell history in real workflows.

```bash
service_origin=https://read.example.com
curl -sS -c rebook.cookies \
  -H "Origin: $service_origin" \
  -H 'Content-Type: application/json' \
  --data-binary @login.json \
  "$service_origin/api/auth/login" > login-response.json

csrf_token="$(jq -r .csrfToken login-response.json)"
curl -sS -b rebook.cookies \
  -H "Origin: $service_origin" \
  -H "X-CSRF-Token: $csrf_token" \
  -F 'file=@package/com.example.hello-0.1.0.zip;type=application/zip' \
  "$service_origin/api/extensions/submissions" > submission.json

version_id="$(jq -r .id submission.json)"
curl -sS -b rebook.cookies -X POST \
  -H "Origin: $service_origin" \
  -H "X-CSRF-Token: $csrf_token" \
  "$service_origin/api/extensions/versions/$version_id/submit"
```

`login.json` contains `{ "email": "...", "password": "..." }`. Publisher
email verification is required. Delete the temporary cookie and response files
when finished.

Publishers may deprecate a release but cannot replace its bytes. Security revocation remains an administrator operation and records an audit event.

Installations are pinned to the selected exact version. Publishing another
immutable version makes an update available; it does not silently replace code
already approved by the reader user.

Trusted releases require approval. Worker/iframe submissions become
discoverable after submission and execute only through Sandbox Protocol v1.
Administrators may approve them for catalog moderation without changing their
`unverified` trust level, or reject/revoke abusive submissions.
