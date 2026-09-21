# Licence Boundary

Governs the Jiffoo open-source core and its SDK packages.

## Layer 1 — GPL core

Applies to `apps/api`, `apps/admin`, `packages/shared`, and the root
package.

Licence: GPL-2.0-or-later.

Anyone who modifies and distributes the core must release their changes under the same
terms.

## Layer 2 — SDK packages (MIT)

| Package | Purpose |
|---------|---------|
| `@jiffoo/plugin-sdk` | Plugin development SDK |
| `@jiffoo/ui` | Shared UI components |

These are MIT so that anyone can build against Jiffoo's documented APIs without
triggering copyleft, provided they do not import core code.

## Extensions

Core V1 has one local execution model: extension packages run in the Core process,
reached through the plugin gateway. An extension that runs in the Core process is a
derivative work of the GPL core, and distributing it requires GPL-2.0-or-later,
regardless of whether the package is signed.

A package signature establishes publisher accountability, not a licence exemption and
not technical isolation. The three trust tiers defined in the charter — builtin,
signed, unsigned — hold identical execution rights and identical licence obligations.

Themes are declarative data, not code, and carry no copyleft obligation.

## Versioning

Each release is governed by the version of this document in effect at that release.
