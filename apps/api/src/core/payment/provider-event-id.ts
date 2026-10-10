export function paymentProviderEventId(provider: string, sessionId: string, status: string, eventId?: string | null): string {
  return eventId || `${provider}:${sessionId}:${status}`;
}
