import { themeDefaultTokens, themeTokenStyle } from 'shared';

// Availability pages must remain usable when the upstream theme cannot be read.
export function GET() {
  return new Response(themeTokenStyle('shop', themeDefaultTokens.shop), { headers: { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=300' } });
}
