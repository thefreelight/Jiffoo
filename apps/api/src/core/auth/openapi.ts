/**
 * Route options that publish `bearerAuth` on the operation of the exported
 * OpenAPI document.
 *
 * Routes guarded by a plugin-level hook (`fastify.addHook('onRequest', authMiddleware)`
 * or a `preHandler`) carry no trace of it in their schema, so the operation
 * reads as public there — and the contract test proves the API answers 401.
 * Pass `protectedRoute()` as the route's options in that case.
 */
export function protectedRoute(): { schema: { security: Array<Record<string, string[]>> } } {
  return { schema: { security: [{ bearerAuth: [] }] } };
}
