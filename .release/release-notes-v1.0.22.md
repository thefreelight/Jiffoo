## What's included
- Fixes the self-hosted System Updates screen so successful upgrades clear cached update state and stop showing a misleading `Update Now` action.
- Normalizes runtime versions such as `1.0.21-opensource` to their public release form before comparing them to the public update feed.
- Adds regression coverage for OSS runtime version normalization in the upgrade API.
