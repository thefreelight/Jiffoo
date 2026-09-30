import { expect, test } from './local-requests';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { login, ownerEmail } from './helpers';

test('J Admin edits manual payment configuration and a new customer order displays the instructions', async ({ page, newObservedContext }) => {
  test.setTimeout(120_000);
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.goto('/en/plugins/manual-payment');
  const instructions = page.getByRole('textbox', { name: 'instructions' });
  const timeout = page.getByRole('spinbutton', { name: 'unpaidTimeoutHours' });
  await expect(instructions).toBeVisible();
  await expect(timeout).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'type', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'properties', exact: true })).toHaveCount(0);
  const previousInstructions = await instructions.inputValue();
  const previousTimeout = await timeout.inputValue();
  const updated = `E2E payment instructions ${randomUUID()}`;
  const context = await newObservedContext({ baseURL: 'http://127.0.0.1:3003', viewport: { width: 1440, height: 900 } });
  const shop = await context.newPage();
  try {
    await instructions.fill(updated);
    await timeout.fill('48');
    await page.screenshot({ path: path.resolve('test-results/manual-payment-config-1440x900.png') });
    await page.getByRole('button', { name: 'Save configuration' }).click();
    await expect(instructions).toHaveValue(updated);

    const id = randomUUID();
    await shop.goto('/en/register');
    await shop.getByLabel('Name').fill(`Plugin Config Buyer ${id}`);
    await shop.getByLabel('Email').fill(`plugin-config-${id}@e2e.example`);
    await shop.getByLabel('Password', { exact: true }).fill('PluginConfigBuyerPassword123!');
    await shop.getByRole('button', { name: 'Create account' }).click();
    await expect(shop).toHaveURL(/\/en\/account$/);
    await shop.goto('/en/products');
    await shop.getByRole('searchbox', { name: 'Search products' }).fill('E2E Product');
    await shop.getByRole('button', { name: 'Search', exact: true }).click();
    await shop.getByRole('link', { name: /E2E Product/ }).click();
    await shop.getByRole('button', { name: 'Add to cart' }).click();
    await shop.getByRole('link', { name: 'Checkout', exact: true }).click();
    await shop.getByLabel('First name').fill('Config');
    await shop.getByLabel('Last name').fill('Buyer');
    await shop.getByLabel('Phone').fill('+1-555-0130');
    await shop.getByLabel('Address line 1').fill('29 Test Street');
    await shop.getByRole('textbox', { name: 'City', exact: true }).fill('San Francisco');
    await shop.getByLabel('State / province').fill('CA');
    await shop.getByLabel('Postal code').fill('94105');
    await shop.getByRole('combobox', { name: 'Country', exact: true }).selectOption({ label: 'United States' });
    await shop.getByRole('button', { name: 'Get shipping options' }).click();
    await shop.getByRole('radio', { name: /Free shipping/i }).check();
    await shop.getByRole('radio', { name: 'Manual payment' }).check();
    await shop.getByRole('button', { name: 'Place order' }).click();
    await expect(shop.getByText(updated, { exact: true })).toBeVisible();
  } finally {
    await instructions.fill(previousInstructions);
    await timeout.fill(previousTimeout);
    await page.getByRole('button', { name: 'Save configuration' }).click();
    await context.close();
  }
});
