# ADR: Admin Bootstrap Credential Display Must Be State-Driven

Status: accepted

Date: 2026-03-28

## Context

The Admin login page currently exposes seeded credentials (`admin@jiffoo.com / admin123`) as a hardcoded UI affordance.

That is acceptable for:

- public demo environments
- the first-run bootstrap flow of a self-hosted install

It is not acceptable as a permanent product behavior after the initial administrator has rotated the password.

## Decision

1. Demo credential display must be controlled by backend state, not by frontend hardcoded assumptions.
2. The system must distinguish:
   - `demo` mode
   - `bootstrap` mode
   - `normal` mode
3. `bootstrap` mode may expose initial admin credentials only until the seeded admin password is rotated.
4. After a successful password rotation by the seeded admin, the system must:
   - stop showing demo credentials
   - clear the password-rotation requirement flag
5. The login surface and protected Admin routing should treat `requiresPasswordRotation` as a first-class user/session signal.

## Consequences

- self-hosted first-run UX stays convenient
- demo instances can still expose sample credentials intentionally
- normal installations stop leaking default credentials after onboarding
- future themes/plugins do not need to special-case hardcoded login-page credentials
