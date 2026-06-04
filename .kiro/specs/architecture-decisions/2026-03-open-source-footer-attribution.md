# ADR: Open-Source Footer Attribution

Status: accepted

Date: 2026-03-28

## Context

Jiffoo ships an open-source default storefront experience that can later be elevated into a managed/customized commercial package by entering an activation code.

The product needs two things at once:

- the open-source default should visibly retain Jiffoo attribution
- managed/customized commercial packages should be able to remove that attribution automatically

The risk is handling this only in theme copy or front-end heuristics, because that would:

- let surfaces drift in behavior
- make desktop/mobile harder to keep aligned
- blur the difference between open-source default mode and licensed managed mode

## Decision

1. Default open-source storefront experiences will display a visible `Powered by Jiffoo` footer attribution.
2. Attribution visibility will be controlled by backend runtime state, not by hardcoded theme-only logic.
3. The runtime read model will expose a `platformBranding` or equivalent attribution projection.
4. When the instance enters managed/customized mode through a commercial package activation code, that runtime projection will hide the default Jiffoo attribution automatically.
5. The built-in default theme is responsible for rendering the attribution elegantly, but the decision to show or hide it belongs to runtime state.

## Consequences

- Web, Desktop, and Mobile can follow the same attribution rule.
- Open-source self-hosted installs keep clear product provenance by default.
- Managed/customized packages do not need per-theme custom hacks to remove default attribution.
- The rule is explicit in product and execution docs rather than left to convention.
