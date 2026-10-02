export function pluginLifecycleErrorKey(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const keys: Record<string, string> = {
    PLUGIN_NOT_FOUND: 'notFound', PLUGIN_BUILTIN_PROTECTED: 'builtinProtected',
    PLUGIN_ALREADY_UNINSTALLED: 'alreadyRemoved', PLUGIN_NOT_UNINSTALLED: 'notRemoved',
    PLUGIN_PURGE_CONFIRMATION_REQUIRED: 'confirmationRequired', PLUGIN_UNFINISHED_PAYMENTS: 'unfinishedPayments',
    PLUGIN_PACKAGE_UNAVAILABLE: 'packageUnavailable', PLUGIN_PACKAGE_CORRUPT: 'packageCorrupt',
    PLUGIN_PACKAGE_MATERIALIZATION_TIMEOUT: 'packageUnavailable', PLUGIN_REINSTALL_REQUIRED: 'reinstallRequired',
    PLUGIN_TEST_SIGNING_DISABLED: 'testSigningDisabled', LAST_PROVIDER_REQUIRED: 'lastProvider',
    PLUGIN_OPERATION_IN_PROGRESS: 'busy', PLUGIN_OPERATION_LEASE_LOST: 'busy',
  };
  return code && keys[code] ? keys[code] : 'failed';
}
