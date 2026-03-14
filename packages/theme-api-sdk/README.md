# @jiffoo/theme-api-sdk

Theme-facing SDK for Jiffoo Core API.

## Install

```bash
npm i @jiffoo/theme-api-sdk
```

## Usage

```ts
import { createThemeApiClient } from '@jiffoo/theme-api-sdk';

const api = createThemeApiClient({
  baseUrl: 'https://api.example.com',
  token: async () => localStorage.getItem('token'),
});

const profile = await api.account.getProfile();
const products = await api.products.list({ page: 1, limit: 20 });
```

## Raw request

```ts
const data = await api.request('/products/search', {
  query: { q: 'shirt', page: 1, limit: 10 },
});
```
