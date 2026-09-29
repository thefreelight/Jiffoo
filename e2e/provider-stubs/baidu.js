(() => {
  const provider = 'baidu';
  window.recordProviderStub(provider, window._hmt.splice(0));
  window._hmt.push = (...commands) => {
    window.recordProviderStub(provider, commands, false);
    return Array.prototype.push.apply(window._hmt, commands);
  };
})();
