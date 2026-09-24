import 'server-only';
import { requestClientIp } from './client-ip';
import { forwardedApiHeaders } from './outgoing-headers';

export async function shopApiHeaders(incoming = new Headers()): Promise<Headers> {
  return forwardedApiHeaders(incoming, await requestClientIp());
}
