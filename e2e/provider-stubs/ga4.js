(() => {
  const provider = 'ga4';
  window.recordProviderStub(provider, window.dataLayer.splice(0));
})();
