## What's included
- Fixes docker-compose image-first upgrades by recreating runtime services sequentially, avoiding compose force-recreate conflicts, preferring newer workspace updater code when it is ahead of the container updater version, and keeping the updater rehearsal aligned with the safer rollout path.
