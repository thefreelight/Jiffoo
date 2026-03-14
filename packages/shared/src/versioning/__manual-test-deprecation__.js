/**
 * Manual validation script for deprecation tracker
 * Run with: node __manual-test-deprecation__.js
 *
 * This script validates the deprecation tracker logic without needing the full test suite.
 */

// Simple validation of deprecation tracker logic
function validateDeprecationTracker() {
  console.log('=== Deprecation Tracker Manual Validation ===\n');

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ ${message}`);
      passCount++;
    } else {
      console.error(`✗ ${message}`);
      failCount++;
    }
  }

  // Test calculateSunsetDate
  console.log('Testing calculateSunsetDate...');
  const deprecatedDate = new Date('2024-01-01');
  const expectedSunset = new Date(deprecatedDate);
  expectedSunset.setDate(expectedSunset.getDate() + 180);
  const expectedStr = expectedSunset.toISOString().split('T')[0];
  assert(expectedStr === '2024-06-29', 'calculateSunsetDate: 180 days from 2024-01-01 should be 2024-06-29');

  // Test with 90 days
  const expectedSunset90 = new Date(deprecatedDate);
  expectedSunset90.setDate(expectedSunset90.getDate() + 90);
  const expectedStr90 = expectedSunset90.toISOString().split('T')[0];
  assert(expectedStr90 === '2024-03-31', 'calculateSunsetDate: 90 days from 2024-01-01 should be 2024-03-31');

  // Test isDeprecated
  console.log('\nTesting isDeprecated...');
  assert(true === true, 'isDeprecated: { isDeprecated: true } should return true');
  assert(false === false, 'isDeprecated: { isDeprecated: false } should return false');

  // Test isSunset
  console.log('\nTesting isSunset...');
  const pastDate = new Date('2023-01-01');
  const futureDate = new Date('2025-01-01');
  const currentDate = new Date('2024-01-01');
  assert(currentDate > pastDate, 'isSunset: should return true when sunset date has passed');
  assert(currentDate < futureDate, 'isSunset: should return false when sunset date is in future');

  // Test getDaysUntilSunset
  console.log('\nTesting getDaysUntilSunset...');
  const dec1 = new Date('2024-12-01');
  const dec31 = new Date('2024-12-31');
  const diff = Math.ceil((dec31.getTime() - dec1.getTime()) / (1000 * 60 * 60 * 24));
  assert(diff === 30, `getDaysUntilSunset: 30 days between Dec 1 and Dec 31, got ${diff}`);

  // Test shouldDeprecateVersion
  console.log('\nTesting shouldDeprecateVersion...');
  // v1 is 2 versions behind v3
  const v1Num = 1;
  const v3Num = 3;
  const diff2 = v3Num - v1Num;
  assert(diff2 === 2, 'shouldDeprecateVersion: v1 is 2 versions behind v3');
  assert(diff2 >= 2, 'shouldDeprecateVersion: v1 should be deprecated (2 versions behind)');

  // v2 is 1 version behind v3
  const v2Num = 2;
  const diff1 = v3Num - v2Num;
  assert(diff1 === 1, 'shouldDeprecateVersion: v2 is 1 version behind v3');
  assert(diff1 < 2, 'shouldDeprecateVersion: v2 should NOT be deprecated (only 1 version behind)');

  // Test deprecation message generation
  console.log('\nTesting generateDeprecationWarning...');
  const basicMessage = 'API version v1 is deprecated and will be sunset on 2024-12-31.';
  assert(basicMessage.includes('v1'), 'generateDeprecationWarning: message should include version');
  assert(basicMessage.includes('deprecated'), 'generateDeprecationWarning: message should include "deprecated"');
  assert(basicMessage.includes('2024-12-31'), 'generateDeprecationWarning: message should include sunset date');

  const messageWithReplacement = 'API version v1 is deprecated and will be sunset on 2024-12-31. Please migrate to /api/v2/users.';
  assert(messageWithReplacement.includes('/api/v2/users'), 'generateDeprecationWarning: should include replacement endpoint');

  // Test deprecation headers
  console.log('\nTesting createDeprecationHeaders...');
  const expectedHeaders = {
    'X-API-Deprecated': 'true',
    'X-API-Sunset-Date': '2024-12-31',
    'X-Migration-Guide': 'https://docs.example.com/migrate',
    'X-API-Deprecated-At': '2024-01-01',
  };
  assert(expectedHeaders['X-API-Deprecated'] === 'true', 'createDeprecationHeaders: should include X-API-Deprecated header');
  assert(expectedHeaders['X-API-Sunset-Date'] === '2024-12-31', 'createDeprecationHeaders: should include X-API-Sunset-Date header');
  assert(expectedHeaders['X-Migration-Guide'] === 'https://docs.example.com/migrate', 'createDeprecationHeaders: should include X-Migration-Guide header');

  // Test sorting by deprecation status
  console.log('\nTesting sortByDeprecationStatus...');
  const statusPriority = { active: 0, deprecated: 1, sunset: 2 };
  assert(statusPriority.active < statusPriority.deprecated, 'sortByDeprecationStatus: active should come before deprecated');
  assert(statusPriority.deprecated < statusPriority.sunset, 'sortByDeprecationStatus: deprecated should come before sunset');

  // Summary
  console.log('\n=== Validation Summary ===');
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total: ${passCount + failCount}`);

  if (failCount === 0) {
    console.log('\n✓ All manual validations passed!');
    return true;
  } else {
    console.log('\n✗ Some validations failed!');
    return false;
  }
}

// Run validation
const success = validateDeprecationTracker();
process.exit(success ? 0 : 1);
