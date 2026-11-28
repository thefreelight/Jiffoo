'use client'

/**
 * Whether this admin belongs to the demonstration instance. The core answers
 * from its `DEMO_MODE` setting; anywhere else the answer is false.
 */

import { useQuery } from '@tanstack/react-query'
import { authApi, unwrapApiResponse } from '@/lib/api'

export function useDemoInstance(): boolean {
  const { data } = useQuery({
    queryKey: ['auth', 'login-config'],
    queryFn: async () => unwrapApiResponse(await authApi.getLoginConfig()),
    staleTime: Infinity,
    retry: false,
  })
  return data?.demoModeEnabled === true
}
