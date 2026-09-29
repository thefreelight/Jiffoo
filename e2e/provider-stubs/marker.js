(() => {
  window.recordProviderStub = (provider, commands) => {
    const evidence = window.providerStubEvidence || (window.providerStubEvidence = {});
    const previous = evidence[provider];
    evidence[provider] = {
      loads: (previous?.loads || 0) + 1,
      commands: [...(previous?.commands || []), ...commands.map((command) =>
        Array.from(command, (value) => value instanceof Date ? '<Date>' : value))],
    };
    let marker = document.getElementById('provider-command-marker');
    if (!marker) {
      marker = document.createElement('div');
      marker.id = 'provider-command-marker';
      document.body.appendChild(marker);
    }
    marker.textContent = 'Provider commands: ' + JSON.stringify(
      ['ga4', 'meta', 'baidu'].filter((name) => evidence[name]).map((name) => ({
        provider: name, ...evidence[name],
      })),
    ) + '|merchant:' + JSON.stringify(window.providerMerchant || null);
  };
})();
