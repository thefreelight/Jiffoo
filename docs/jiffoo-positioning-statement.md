# Jiffoo Positioning Statement

Status: Draft  
Last updated: 2026-04-23

## One Sentence

Jiffoo is a productized open-source commerce runtime with strong extension contracts, not a general-purpose app framework.

## Primary Role

Jiffoo exists to provide a complete OSS runtime surface for:

- `shop`
- `api`
- `admin`

with:

- stable commerce semantics
- self-hosted install and upgrade paths
- theme and plugin extension contracts
- a usable default open-source experience

## What Jiffoo Is

- a runnable commerce core
- an opinionated platform product
- the canonical OSS source of truth for public runtime contracts
- the place where default storefront behavior and extension protocols are defined

## What Jiffoo Is Not

- not a low-level general-purpose framework
- not the canonical source tree for every official theme or plugin implementation
- not the product host for private mobile and desktop apps
- not the right place for speculative abstraction that makes normal extension work harder

## Design Principle

Jiffoo should optimize for:

1. a clear and stable commerce core
2. easy theme and plugin authoring against explicit contracts
3. a strong default OSS storefront and admin experience
4. predictable self-hosted operations

Jiffoo should not optimize for:

1. making every future product variation live inside core
2. moving all official extension implementation into the runtime repo
3. abstracting early just because something might be reusable later

## Ownership Boundary

### Jiffoo should own

- core commerce contracts
- core storefront runtime
- theme and plugin protocols
- default OSS theme
- self-hosted deployment and updater behavior
- cross-client storefront contracts that other repos must consume

### Jiffoo should not own canonically

- official extension source packages
- private commercial overlay behavior
- mobile and desktop product-specific host logic
- customer-specific implementation detail

## Decision Filter

When deciding whether work belongs in Jiffoo, ask:

1. Does this strengthen the public runtime surface of `shop`, `api`, or `admin`?
2. Does this clarify or improve a core contract used by themes, plugins, or official clients?
3. Does this improve the default OSS experience directly?
4. Does this reduce operational ambiguity for self-hosted runtime behavior?

If the answer to all four is no, the work probably does not belong in Jiffoo.

## Extension Simplicity Rule

If a change makes normal theme or plugin development harder without clearly improving:

- core commerce semantics
- extension contracts
- default OSS runtime quality
- self-hosted operability

then the change is probably architectural overhead and should be rejected, deferred, or moved out of core.

## Repo Routing Rule

- If the work changes OSS runtime contracts or default runtime behavior, it belongs in `Jiffoo`.
- If the work is official theme or plugin source authoring, it belongs in `jiffoo-extensions-official`.
- If the work is private overlay behavior, it belongs in `jiffoo-mall-core`.
- If the work is mobile or desktop host behavior, it belongs in the corresponding client repository unless it changes a core storefront contract.

## Default Architectural Stance

Prefer:

- explicit contracts
- narrow runtime responsibilities
- productized defaults
- extension-friendly boundaries

Avoid:

- framework sprawl
- contract duplication
- host-specific logic leaking into core
- putting every reusable idea into the core repo
