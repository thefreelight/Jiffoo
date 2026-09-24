export function forwardedApiHeaders(incoming: Headers, ip: string): Headers {
  const outgoing = new Headers(incoming);
  outgoing.set('X-Forwarded-For', ip);
  return outgoing;
}
