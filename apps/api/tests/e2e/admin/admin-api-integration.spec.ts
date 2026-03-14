import { expect, test, type Page, type Response } from '@playwright/test';

type RouteExpectation = {
  path: string;
  apiPathPrefixes: string[];
  allowedErrorResponses?: Array<{
    pathPrefix: string;
    statuses: number[];
  }>;
};

const locale = process.env.E2E_LOCALE || 'en';
const e2eAdminEmail = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@jiffoo.local';
const e2eAdminPassword = process.env.E2E_ADMIN_PASSWORD || 'E2EAdmin123!';

const routeExpectations: RouteExpectation[] = [
  {
    path: `/${locale}/dashboard`,
    apiPathPrefixes: ['/api/admin/dashboard'],
  },
  {
    path: `/${locale}/products`,
    apiPathPrefixes: ['/api/admin/products'],
  },
  {
    path: `/${locale}/orders`,
    apiPathPrefixes: ['/api/admin/orders'],
  },
  {
    path: `/${locale}/customers`,
    apiPathPrefixes: ['/api/admin/users'],
  },
  {
    path: `/${locale}/inventory`,
    apiPathPrefixes: ['/api/admin/inventory/dashboard'],
  },
  {
    path: `/${locale}/plugins`,
    apiPathPrefixes: ['/api/extensions/plugin'],
  },
  {
    path: `/${locale}/plugins?tab=themes`,
    apiPathPrefixes: ['/api/admin/themes'],
  },
  {
    path: `/${locale}/settings`,
    apiPathPrefixes: ['/api/admin/settings'],
  },
];

function matchPrefix(urlString: string, prefixes: string[]): boolean {
  try {
    const url = new URL(urlString);
    return prefixes.some((prefix) => url.pathname.startsWith(prefix));
  } catch {
    return false;
  }
}

async function verifyApiIntegrationOnPage(page: Page, route: RouteExpectation) {
  const matchedResponses: Response[] = [];
  const handler = (response: Response) => {
    if (matchPrefix(response.url(), route.apiPathPrefixes)) {
      matchedResponses.push(response);
    }
  };

  page.on('response', handler);
  try {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    if (page.url().includes(`/${locale}/auth/login`)) {
      await page.getByLabel('Email address').fill(e2eAdminEmail);
      await page.getByLabel('Password').fill(e2eAdminPassword);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForLoadState('networkidle');
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    }
    await page.waitForLoadState('networkidle');

    await expect
      .poll(() => matchedResponses.length, {
        timeout: 20_000,
        message: `Expected API calls were not detected for ${route.path}`,
      })
      .toBeGreaterThan(0);

    const failedResponses = matchedResponses.filter((response) => response.status() >= 400);
    const unexpectedFailures = failedResponses.filter((response) => {
      const status = response.status();
      const pathname = new URL(response.url()).pathname;
      const allowed = route.allowedErrorResponses || [];

      return !allowed.some((rule) => pathname.startsWith(rule.pathPrefix) && rule.statuses.includes(status));
    });

    if (unexpectedFailures.length > 0) {
      const failureDetails = await Promise.all(
        unexpectedFailures.map(async (response) => {
          let body = '';
          try {
            body = await response.text();
          } catch {
            body = '<failed to read response body>';
          }

          return `${response.status()} ${response.url()} body=${body}`;
        })
      );

      expect(
        unexpectedFailures,
        `Unexpected API responses failed on ${route.path}: ${failureDetails.join(' | ')}`
      ).toHaveLength(0);
    }

    await expect(page).not.toHaveURL(new RegExp(`/${locale}/auth/login`));
  } finally {
    page.off('response', handler);
  }
}

test.describe('Admin Frontend ↔ API Integration', () => {
  test('unauthenticated user should be redirected to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto(`/${locale}/dashboard`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/auth/login`));

    await context.close();
  });

  for (const route of routeExpectations) {
    test(`${route.path} should consume expected APIs successfully`, async ({ page }) => {
      await verifyApiIntegrationOnPage(page, route);
    });
  }
});
