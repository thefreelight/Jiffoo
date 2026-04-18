## What's included
- auto-clears terminal self-hosted upgrade state so Merchant Admin returns to a clean idle state after successful completion or recovery
- adds an authenticated upgrade-status reset path for the Settings page and expires stale terminal updater status files
- blocks self-hosted public feed publication until `api`, `admin`, `shop`, and `updater` runtime images are present in the registry
