# External Plugin Development Guide

This guide is for external developers building plugins that run outside the Jiffoo core runtime.

## Overview

An external plugin is a standalone service that integrates with Jiffoo through HTTP APIs, signed callbacks, and installation lifecycle hooks.

Typical responsibilities:

- Expose a health endpoint
- Publish a plugin manifest
- Handle install and uninstall lifecycle events
- Validate Jiffoo request signatures
- Expose business APIs for storefront or admin integrations

## Required endpoints

Implement these endpoints in your service:

- `GET /health`
- `GET /manifest`
- `POST /install`
- `POST /uninstall`

Your business APIs are then mounted behind the Jiffoo plugin gateway:

- Public request path: `/api/plugins/<plugin-slug>/api/<path>`
- Upstream service path: `/<path>`

## Security model

Jiffoo signs platform-to-plugin requests. Your plugin must:

- Validate the request signature
- Validate the request timestamp
- Treat `tenantId` and `installationId` as tenant-isolation boundaries

Recommended signing model:

- `HMAC-SHA256`
- Shared secret per plugin installation
- Canonical string includes timestamp, method, path, and body

## Installation model

On installation, Jiffoo calls your plugin with:

- `tenantId`
- `installationId`
- environment metadata
- selected plan
- plugin configuration

Use this to initialize tenant-scoped resources in your service.

## Recommended plugin contract

Your manifest should describe:

- name
- slug
- version
- summary
- category
- tags
- configuration schema
- exposed routes

## Distribution

Public open-source Jiffoo instances do not bundle official plugins. Plugins are distributed through the Jiffoo Marketplace and installed after the merchant connects their instance to the platform.

## Next steps

- Define your manifest shape
- Implement signed install and uninstall handlers
- Add your business routes
- Test through the Jiffoo plugin gateway
