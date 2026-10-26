import { afterEach, describe, expect, it } from 'vitest';
import { systemSettingsService } from '@/core/settings/service';
import {
  clearFulfillmentPolicies,
  defaultFulfillmentPolicy,
  fulfillmentPolicyFor,
  registeredFulfillmentPolicyTypes,
} from '@/core/shared/fulfillment-policy';

/**
 * The production entry point of the fulfilment policy: the store setting and
 * the registry of the process.
 *
 * The setting is the only switch of the capability, so the path from the
 * setting to the registry is covered here: a valid selection reaches the
 * registry of the process, an invalid selection is rejected before anything
 * is written, and a process that reads the store settings picks the current
 * selection up.
 */
const FULFILLMENT_POLICIES_KEY = 'fulfillment.policies';

describe('the fulfilment policy selection of the store settings', () => {
  afterEach(async () => {
    // The selection is a store setting: the test removes it again, so the
    // next test file of the shard sees the default policy of every product
    // type.
    await systemSettingsService.resetSetting(FULFILLMENT_POLICIES_KEY);
    clearFulfillmentPolicies();
  });

  it('applies the selection of the store to the registry of the process', async () => {
    clearFulfillmentPolicies();

    await systemSettingsService.setSetting(FULFILLMENT_POLICIES_KEY, { digital: 'digital' });

    expect(registeredFulfillmentPolicyTypes()).toEqual(['digital']);
    expect(fulfillmentPolicyFor('digital')).toEqual({
      requiresShippingAddress: false,
      requiresShippingQuote: false,
      tracksInventory: false,
    });
    // A product type outside the selection keeps the default policy.
    expect(fulfillmentPolicyFor('physical')).toEqual(defaultFulfillmentPolicy());
  });

  it('rejects an invalid selection before anything is written', async () => {
    clearFulfillmentPolicies();

    await expect(systemSettingsService.setSetting(FULFILLMENT_POLICIES_KEY, { digital: 'virtual' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect(await systemSettingsService.getSetting(FULFILLMENT_POLICIES_KEY)).toBeNull();
    expect(registeredFulfillmentPolicyTypes()).toEqual([]);
  });

  it('applies the selection of the store when the settings are read', async () => {
    await systemSettingsService.setSetting(FULFILLMENT_POLICIES_KEY, { digital: 'digital' });

    // Another process: the registry of this process holds no policy until it
    // reads the store settings.
    clearFulfillmentPolicies();
    expect(registeredFulfillmentPolicyTypes()).toEqual([]);

    await systemSettingsService.getAllSettings();

    expect(registeredFulfillmentPolicyTypes()).toEqual(['digital']);
  });

  it('keeps the default policy of every product type when the store selects nothing', async () => {
    await systemSettingsService.resetSetting(FULFILLMENT_POLICIES_KEY);
    clearFulfillmentPolicies();

    await systemSettingsService.getAllSettings();

    expect(registeredFulfillmentPolicyTypes()).toEqual([]);
    expect(fulfillmentPolicyFor('digital')).toEqual(defaultFulfillmentPolicy());
  });
});
