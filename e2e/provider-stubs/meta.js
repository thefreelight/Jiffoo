(() => {
  const provider = 'meta';
  window.recordProviderStub(provider, window.fbq.queue.splice(0));
})();
