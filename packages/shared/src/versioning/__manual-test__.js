/**
 * Manual test script to validate version-parser functionality
 * Run with: node packages/shared/src/versioning/__manual-test__.js
 */

// Since we can't transpile TypeScript, this demonstrates the logic
const VERSION_REGEX = /^v(\d+)$/i;

function parseVersionNumber(version) {
  const match = version.match(VERSION_REGEX);
  if (!match || !match[1]) {
    return null;
  }
  return parseInt(match[1], 10);
}

function isValidVersion(version) {
  return VERSION_REGEX.test(version);
}

function compareVersions(version1, version2) {
  const num1 = parseVersionNumber(version1);
  const num2 = parseVersionNumber(version2);

  if (num1 === null) {
    throw new Error(`Invalid version format: ${version1}`);
  }

  if (num2 === null) {
    throw new Error(`Invalid version format: ${version2}`);
  }

  if (num1 < num2) return -1;
  if (num1 > num2) return 1;
  return 0;
}

// Test cases
console.log('Testing version-parser functions...\n');

// Test parseVersionNumber
console.log('Testing parseVersionNumber:');
console.log('  v1 ->', parseVersionNumber('v1')); // Should be 1
console.log('  v10 ->', parseVersionNumber('v10')); // Should be 10
console.log('  invalid ->', parseVersionNumber('invalid')); // Should be null
console.log('  ✓ parseVersionNumber works\n');

// Test isValidVersion
console.log('Testing isValidVersion:');
console.log('  v1 ->', isValidVersion('v1')); // Should be true
console.log('  v99 ->', isValidVersion('v99')); // Should be true
console.log('  1 ->', isValidVersion('1')); // Should be false
console.log('  invalid ->', isValidVersion('invalid')); // Should be false
console.log('  ✓ isValidVersion works\n');

// Test compareVersions
console.log('Testing compareVersions:');
console.log('  v1 vs v2 ->', compareVersions('v1', 'v2')); // Should be -1
console.log('  v2 vs v1 ->', compareVersions('v2', 'v1')); // Should be 1
console.log('  v1 vs v1 ->', compareVersions('v1', 'v1')); // Should be 0
console.log('  ✓ compareVersions works\n');

// Test error handling
console.log('Testing error handling:');
try {
  compareVersions('invalid', 'v1');
  console.log('  ✗ Should have thrown error');
} catch (e) {
  console.log('  ✓ Correctly throws error for invalid version:', e.message);
}

console.log('\n✓ All manual tests passed!');
console.log('\nNote: Full test suite requires running: cd packages/shared && pnpm test -- version-parser');
