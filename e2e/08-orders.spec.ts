import { expect, test } from '@playwright/test';
import { api, customerEmail, customerToken, login } from './helpers';

test('record payment, ship an order, and resend its notification', async ({ page, request }) => {
  const registered = await api<{ user: { id: string } }>(request, '/auth/register', {
    method: 'POST',
    data: { email: customerEmail, username: 'e2e-customer', password: 'CustomerPassword123!' },
  });
  expect(registered.user.id).toBeTruthy();
  const token = await customerToken(request);
  const products = await api<{ items: Array<{ id: string; name: string }> }>(request, '/products');
  const listed = products.items.find((item) => item.name === 'E2E Product');
  expect(listed).toBeTruthy();
  const product = await api<{ id: string; variants: Array<{ id: string }> }>(request, `/products/${listed!.id}`);
  expect(product.variants.length).toBeGreaterThan(0);
  const address = {
    firstName: 'E2E', lastName: 'Customer', phone: '+1-555-0102', addressLine1: '1 Test Street',
    city: 'San Francisco', state: 'CA', postalCode: '94105', country: 'US',
  };
  await api(request, '/cart/items', {
    method: 'POST', token, data: { productId: product.id, variantId: product.variants[0].id, quantity: 1 },
  });
  await api(request, '/checkout/quote', {
    method: 'POST', token, data: { shippingAddress: address, shippingOptionId: 'free-shipping:free' },
  });
  const order = await api<{ id: string }>(request, '/orders/', {
    method: 'POST', token,
    data: {
      items: [{ productId: product.id, variantId: product.variants[0].id, quantity: 1 }],
      shippingAddress: address, shippingOptionId: 'free-shipping:free', paymentMethod: 'manual-payment',
    },
  });
  await api(request, '/payments/create-session', {
    method: 'POST', token,
    data: { orderId: order.id, paymentMethod: 'manual-payment', idempotencyKey: `e2e:${order.id}` },
  });
  await login(page);
  await page.goto(`/en/orders/${order.id}`);
  await page.getByRole('button', { name: 'Record Payment' }).click();
  await expect(page.getByText('PAID', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Initiate Dispatch' }).click();
  await page.getByRole('textbox', { name: 'Shipping Carrier' }).fill('E2E Carrier');
  await page.getByRole('textbox', { name: 'Tracking Number' }).fill('E2E-TRACK-001');
  await page.getByRole('button', { name: 'Confirm Shipment' }).click();
  await expect(page.getByText('SHIPPED', { exact: true }).first()).toBeVisible();
  await page.goto('/en/notifications');
  await expect(page.getByText('order confirmation')).toBeVisible();
  await expect(page.getByText('payment received')).toBeVisible();
  await expect(page.getByText('shipped', { exact: true })).toBeVisible();
  await page.getByRole('row', { name: /order confirmation.*customer@e2e.example/i }).click();
  await expect(page.getByRole('dialog', { name: 'Notification detail' })).toBeVisible();
  await page.getByRole('button', { name: 'Resend' }).click();
  await expect(page.getByText('Notification queued')).toBeVisible();
});
