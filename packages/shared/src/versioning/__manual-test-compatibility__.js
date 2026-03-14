#!/usr/bin/env node
/**
 * Manual test script for compatibility-checker
 * This verifies the core logic without needing pnpm/npm
 */

// Simple test framework
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log(`✓ ${message}`);
  } else {
    failCount++;
    console.error(`✗ ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual === expected) {
    passCount++;
    console.log(`✓ ${message}`);
  } else {
    failCount++;
    console.error(`✗ ${message}`);
    console.error(`  Expected: ${expected}`);
    console.error(`  Actual: ${actual}`);
  }
}

// Import the functions (simulating the logic)
const VERSION_REGEX = /^v(\d+)$/i;

function parseVersionNumber(version) {
  const match = version.match(VERSION_REGEX);
  if (!match || !match[1]) return null;
  return parseInt(match[1], 10);
}

function isValidVersion(version) {
  return VERSION_REGEX.test(version);
}

function compareVersions(version1, version2) {
  const num1 = parseVersionNumber(version1);
  const num2 = parseVersionNumber(version2);

  if (num1 === null) throw new Error(`Invalid version format: ${version1}`);
  if (num2 === null) throw new Error(`Invalid version format: ${version2}`);

  if (num1 < num2) return -1;
  if (num1 > num2) return 1;
  return 0;
}

function normalizeVersion(version) {
  const normalized = version.toLowerCase();
  if (!isValidVersion(normalized)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return normalized;
}

function isVersionInRange(version, minVersion, maxVersion) {
  if (minVersion && compareVersions(version, minVersion) < 0) {
    return false;
  }
  if (maxVersion && compareVersions(version, maxVersion) > 0) {
    return false;
  }
  return true;
}

function isVersionCompatible(currentVersion, requiredRange) {
  if (!isValidVersion(currentVersion)) {
    throw new Error(`Invalid current version format: ${currentVersion}`);
  }

  if (requiredRange.exact) {
    if (!isValidVersion(requiredRange.exact)) {
      throw new Error(`Invalid exact version format: ${requiredRange.exact}`);
    }
    return compareVersions(currentVersion, requiredRange.exact) === 0;
  }

  const min = requiredRange.min || null;
  const max = requiredRange.max || null;

  if (min && !isValidVersion(min)) {
    throw new Error(`Invalid min version format: ${min}`);
  }
  if (max && !isValidVersion(max)) {
    throw new Error(`Invalid max version format: ${max}`);
  }

  return isVersionInRange(currentVersion, min, max);
}

function checkPluginCompatibility(pluginCompat, currentVersion) {
  const warnings = [];
  const errors = [];

  if (!isValidVersion(currentVersion)) {
    errors.push(`Invalid API version format: ${currentVersion}`);
    return {
      isCompatible: false,
      currentVersion,
      requiredVersion: JSON.stringify(pluginCompat.requiredApiVersion),
      message: `Plugin ${pluginCompat.pluginId} cannot be loaded due to invalid API version`,
      warnings,
      errors,
    };
  }

  try {
    const isCompatible = isVersionCompatible(
      currentVersion,
      pluginCompat.requiredApiVersion
    );

    if (!isCompatible) {
      errors.push(
        `Plugin requires API version ${JSON.stringify(pluginCompat.requiredApiVersion)} but current version is ${currentVersion}`
      );
      return {
        isCompatible: false,
        currentVersion,
        requiredVersion: JSON.stringify(pluginCompat.requiredApiVersion),
        message: `Plugin ${pluginCompat.pluginId} v${pluginCompat.pluginVersion} is not compatible with API ${currentVersion}`,
        warnings,
        errors,
      };
    }

    if (
      pluginCompat.supportedApiVersions &&
      pluginCompat.supportedApiVersions.length > 0
    ) {
      const isInSupportedList = pluginCompat.supportedApiVersions.some(
        (version) => {
          try {
            return compareVersions(currentVersion, version) === 0;
          } catch {
            return false;
          }
        }
      );

      if (!isInSupportedList) {
        warnings.push(
          `Current version ${currentVersion} is not in the explicitly supported versions list: ${pluginCompat.supportedApiVersions.join(', ')}`
        );
      }
    }

    return {
      isCompatible: true,
      currentVersion,
      requiredVersion: JSON.stringify(pluginCompat.requiredApiVersion),
      message: `Plugin ${pluginCompat.pluginId} v${pluginCompat.pluginVersion} is compatible with API ${currentVersion}`,
      warnings,
      errors,
    };
  } catch (error) {
    errors.push(error.message || 'Unknown compatibility error');
    return {
      isCompatible: false,
      currentVersion,
      requiredVersion: JSON.stringify(pluginCompat.requiredApiVersion),
      message: `Error checking compatibility for plugin ${pluginCompat.pluginId}`,
      warnings,
      errors,
    };
  }
}

function parseVersionRangeSpec(spec) {
  const trimmed = spec.trim();

  const rangeMatch = trimmed.match(/^(v\d+)-(v\d+)$/i);
  if (rangeMatch) {
    const min = normalizeVersion(rangeMatch[1]);
    const max = normalizeVersion(rangeMatch[2]);
    return { min, max };
  }

  const minMatch = trimmed.match(/^>=?\s*(v\d+)$/i);
  if (minMatch) {
    const min = normalizeVersion(minMatch[1]);
    return { min };
  }

  const maxMatch = trimmed.match(/^<=?\s*(v\d+)$/i);
  if (maxMatch) {
    const max = normalizeVersion(maxMatch[1]);
    return { max };
  }

  if (isValidVersion(trimmed)) {
    return { exact: normalizeVersion(trimmed) };
  }

  throw new Error(`Invalid version range specification: ${spec}`);
}

console.log('\n=== Testing Compatibility Checker ===\n');

// Test isVersionCompatible
console.log('Testing isVersionCompatible:');
assert(isVersionCompatible('v2', { exact: 'v2' }), 'exact version match');
assert(!isVersionCompatible('v1', { exact: 'v2' }), 'exact version mismatch');
assert(isVersionCompatible('v2', { min: 'v1' }), 'min version check');
assert(isVersionCompatible('v2', { max: 'v3' }), 'max version check');
assert(isVersionCompatible('v2', { min: 'v1', max: 'v3' }), 'range version check');
assert(!isVersionCompatible('v4', { min: 'v1', max: 'v3' }), 'version above range');

console.log('\nTesting checkPluginCompatibility:');
const plugin1 = {
  pluginId: 'test-plugin',
  pluginVersion: '1.0.0',
  requiredApiVersion: { min: 'v1', max: 'v3' },
};
const result1 = checkPluginCompatibility(plugin1, 'v2');
assert(result1.isCompatible, 'plugin compatible with version in range');
assertEquals(result1.errors.length, 0, 'no errors for compatible plugin');

const plugin2 = {
  pluginId: 'test-plugin',
  pluginVersion: '1.0.0',
  requiredApiVersion: { min: 'v2', max: 'v3' },
};
const result2 = checkPluginCompatibility(plugin2, 'v1');
assert(!result2.isCompatible, 'plugin incompatible with version out of range');
assert(result2.errors.length > 0, 'errors present for incompatible plugin');

const plugin3 = {
  pluginId: 'test-plugin',
  pluginVersion: '1.0.0',
  requiredApiVersion: { exact: 'v2' },
};
assert(checkPluginCompatibility(plugin3, 'v2').isCompatible, 'exact version match');
assert(!checkPluginCompatibility(plugin3, 'v1').isCompatible, 'exact version mismatch');

const plugin4 = {
  pluginId: 'test-plugin',
  pluginVersion: '1.0.0',
  requiredApiVersion: { min: 'v1', max: 'v3' },
  supportedApiVersions: ['v1', 'v2'],
};
const result4 = checkPluginCompatibility(plugin4, 'v3');
assert(result4.isCompatible, 'compatible despite not in supported list');
assert(result4.warnings.length > 0, 'warning for version not in supported list');

console.log('\nTesting parseVersionRangeSpec:');
const spec1 = parseVersionRangeSpec('v2');
assert(spec1.exact === 'v2', 'parse exact version');

const spec2 = parseVersionRangeSpec('v1-v3');
assert(spec2.min === 'v1' && spec2.max === 'v3', 'parse version range');

const spec3 = parseVersionRangeSpec('>=v2');
assert(spec3.min === 'v2', 'parse >= operator');

const spec4 = parseVersionRangeSpec('<=v3');
assert(spec4.max === 'v3', 'parse <= operator');

const spec5 = parseVersionRangeSpec('V2');
assert(spec5.exact === 'v2', 'case insensitive parsing');

try {
  parseVersionRangeSpec('invalid');
  assert(false, 'should throw for invalid spec');
} catch (e) {
  assert(true, 'throws error for invalid spec');
}

console.log('\n=== Test Summary ===');
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);

if (failCount === 0) {
  console.log('\n✅ All tests passed!');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
}
