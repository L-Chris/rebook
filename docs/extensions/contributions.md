# Contribution points

Contributions are declarative. Hosts decide where and how to render them so extension UI remains consistent with the application.

## Commands

Declare commands in the manifest and register handlers during activation. Command ids must be prefixed with the extension id.

```json
{
  "commands": [
    { "id": "com.example.notes.open", "title": "Open notes", "category": "Notes" }
  ]
}
```

## Settings

Supported types are `string`, `number`, `integer`, `boolean`, `array`, and
`object`. Defaults must match the declared type and enum. Settings can declare
display order and `global`, `book`, or `session` scope; hosts that do not yet
provide a narrower persistence layer treat the value as global.

`secret: true` only changes host presentation and persistence policy. It is not a security boundary for trusted same-page code.

## Panels

Panel locations are `sidebar`, `bottom`, `reader`, and `settings`. Manifest v1 reserves these slots and exposes their metadata to hosts. A declaration alone does not grant DOM access; rich panel rendering is available only through a host-supported trusted or iframe bridge.

## Tools

Tools describe callable structured operations. `inputSchema` uses JSON Schema. The host controls which AI or automation surfaces may invoke a tool.

## Conditional visibility

The optional `when` expression is reserved for hosts with a documented context
key evaluator. Extensions must not rely on it for authorization or assume an
unsupported key evaluates to true.
