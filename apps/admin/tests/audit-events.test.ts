import { describe, expect, it } from 'vitest';
import { auditActionKeys, summaryText } from '../lib/audit-events';

describe('Audit event presentation', () => {
  it('pretty prints literal summaries and localizes empty summaries without dropping scalar values', () => {
    expect(summaryText({ nested: '<b>literal</b>' }, 'Not recorded')).toBe('{\n  "nested": "<b>literal</b>"\n}');
    for (const value of [{}, [], null, '']) expect(summaryText(value, '未记录')).toBe('未记录');
    expect(summaryText(false, 'Not recorded')).toBe('false');
    expect(summaryText(0, 'Not recorded')).toBe('0');
  });
  it('maps known writer actions and leaves unknown actions unmapped', () => {
    expect(Object.keys(auditActionKeys).sort()).toEqual([
      'storefront-code.restore', 'storefront-code.save', 'storefront-code.switch',
      'theme.activate', 'theme.config.migrated', 'theme.config.restore', 'theme.config.update',
      'theme.install', 'theme.restore_previous', 'theme.uninstall',
    ]);
    expect(auditActionKeys['future.event']).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(auditActionKeys, 'constructor')).toBe(false);
  });
});
