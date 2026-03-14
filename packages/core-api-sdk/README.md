# jiffoo-core-api-sdk

TypeScript SDK for Jiffoo Core API.

## Install

```bash
npm i jiffoo-core-api-sdk
```

## Usage

```ts
import { createCoreOpenApiClient } from 'jiffoo-core-api-sdk';

const client = createCoreOpenApiClient({
  baseUrl: 'https://api.example.com',
  token: async () => process.env.CORE_API_TOKEN,
});

const products = await client.call('/api/products?page=1&limit=20');
```

## Request tracing

```ts
import { randomUUID } from 'node:crypto';

const client = createCoreOpenApiClient({
  baseUrl: 'https://api.example.com',
  requestId: () => randomUUID(),
});
```

Use a custom header name if needed:

```ts
const client = createCoreOpenApiClient({
  requestId: () => 'trace-123',
  requestIdHeaderName: 'x-correlation-id',
});
```

