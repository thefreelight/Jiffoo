/**
 * Admin UI - Serves the Stripe Console HTML panel.
 */

import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Stripe Console</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f7fb;
        --panel: #ffffff;
        --line: #d8e1ee;
        --text: #0f172a;
        --muted: #526076;
        --good: #0f9f6e;
        --warn: #d97706;
        --bad: #dc2626;
        --chip: #eef4ff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "SF Pro Text", "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, #ffffff 0%, var(--bg) 55%);
        color: var(--text);
      }
      .wrap {
        max-width: 980px;
        margin: 0 auto;
        padding: 32px 24px 56px;
      }
      .hero, .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 24px;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
      }
      .hero {
        padding: 28px;
        margin-bottom: 20px;
      }
      .eyebrow {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--chip);
        color: #264372;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 16px 0 8px;
        font-size: 32px;
        line-height: 1.1;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }
      .grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        margin-top: 20px;
      }
      .metric {
        padding: 18px;
        border-radius: 18px;
        background: #f8fafc;
        border: 1px solid #e5edf7;
      }
      .metric strong {
        display: block;
        font-size: 14px;
        color: var(--muted);
        margin-bottom: 8px;
      }
      .metric span {
        font-size: 22px;
        font-weight: 700;
      }
      .ok { color: var(--good); }
      .warn { color: var(--warn); }
      .bad { color: var(--bad); }
      .panel {
        padding: 24px;
        margin-top: 20px;
      }
      ul {
        margin: 12px 0 0;
        padding-left: 18px;
        color: var(--muted);
      }
      code {
        display: inline-block;
        padding: 3px 7px;
        border-radius: 8px;
        background: #f3f6fb;
        color: #1e3a5f;
      }
      .loading {
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="hero">
        <span class="eyebrow">Official Payment Plugin</span>
        <h1>Stripe Console</h1>
        <p>Checks whether the current deployment is ready to use the built-in Stripe payment flow exposed by the platform.</p>
        <div id="metrics" class="grid">
          <div class="metric"><strong>Status</strong><span class="loading">Loading...</span></div>
        </div>
      </section>

      <section class="panel">
        <h2>Integration Endpoints</h2>
        <div id="endpoints" class="loading">Loading endpoint metadata...</div>
      </section>

      <section class="panel">
        <h2>Warnings</h2>
        <div id="warnings" class="loading">Loading runtime checks...</div>
      </section>
    </main>
    <script>
      const basePath = window.location.pathname.replace(/\\/$/, '');
      const statusUrl = basePath + '/api/status' + window.location.search;

      function metric(label, value, tone) {
        return '<div class="metric"><strong>' + label + '</strong><span class="' + tone + '">' + value + '</span></div>';
      }

      async function loadStatus() {
        const response = await fetch(statusUrl, {
          headers: { accept: 'application/json' },
          credentials: 'same-origin',
        });
        const payload = await response.json();
        const data = payload && payload.success === false ? null : (payload.data || payload);

        if (!response.ok || !data) {
          throw new Error((payload && payload.error && payload.error.message) || 'Failed to load Stripe status');
        }

        document.getElementById('metrics').innerHTML = [
          metric('Configured', data.configured ? 'Ready' : 'Attention needed', data.configured ? 'ok' : 'bad'),
          metric('Storefront Key', data.storefrontReady ? 'Present' : 'Missing', data.storefrontReady ? 'ok' : 'bad'),
          metric('API Secret', data.apiReady ? 'Present' : (data.stubMode ? 'Stub mode' : 'Missing'), data.apiReady ? 'ok' : 'warn'),
          metric('Webhook Secret', data.webhookReady ? 'Present' : 'Missing', data.webhookReady ? 'ok' : 'warn')
        ].join('');

        document.getElementById('endpoints').innerHTML = [
          '<p><code>' + data.endpoints.createIntent + '</code></p>',
          '<p><code>' + data.endpoints.webhook + '</code></p>',
          '<p><code>' + data.endpoints.availableMethods + '</code></p>',
          '<p><code>' + data.endpoints.verifySession + '</code></p>'
        ].join('');

        if (!Array.isArray(data.warnings) || data.warnings.length === 0) {
          document.getElementById('warnings').innerHTML = '<p class="ok">No blocking warnings detected.</p>';
          return;
        }

        document.getElementById('warnings').innerHTML =
          '<ul>' + data.warnings.map(function(item) {
            return '<li>' + item + '</li>';
          }).join('') + '</ul>';
      }

      loadStatus().catch(function(error) {
        document.getElementById('metrics').innerHTML =
          metric('Status', 'Unavailable', 'bad');
        document.getElementById('warnings').innerHTML =
          '<p class="bad">' + error.message + '</p>';
        document.getElementById('endpoints').innerHTML =
          '<p class="bad">Unable to load integration metadata.</p>';
      });
    </script>
  </body>
</html>`);
});

export { router as adminUiRoutes };
