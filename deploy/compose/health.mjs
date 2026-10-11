const [url, mode] = process.argv.slice(2);
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error('Unhealthy HTTP status');
  if (mode === 'api') {
    const body = await response.json();
    if (body.checks?.database !== true || body.checks?.redis !== true) throw new Error('Unhealthy dependency');
  }
} catch { process.exitCode = 1; }
