(() => {
  const provider = 'ga4';
  window.recordProviderStub(provider, window.dataLayer.splice(0));
  window.dataLayer.push = (...commands) => {
    window.recordProviderStub(provider, commands, false);
    return Array.prototype.push.apply(window.dataLayer, commands);
  };
})();
