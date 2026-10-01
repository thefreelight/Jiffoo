import { packBuiltinPlugin } from '../../src/core/admin/extension-installer/builtin-package';

packBuiltinPlugin(process.argv[2]).then(({ hash }) => {
  process.send?.({ kind: 'packed', hash });
  process.disconnect?.();
}).catch((error) => {
  process.send?.({ kind: 'error', message: String(error) });
  process.disconnect?.();
  process.exitCode = 1;
});
