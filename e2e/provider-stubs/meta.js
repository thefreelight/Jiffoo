(() => {
  const provider = 'meta';
  window.recordProviderStub(provider, window.fbq.queue.splice(0));
  window.fbq.callMethod = (...command) => window.recordProviderStub(provider, [command], false);
})();
