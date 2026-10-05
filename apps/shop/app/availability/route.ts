import { availabilityResponse } from '@/lib/availability';

export const dynamic = 'force-dynamic';
export function GET(request: Request) { return availabilityResponse(request); }
