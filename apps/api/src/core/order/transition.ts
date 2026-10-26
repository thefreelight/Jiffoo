/**
 * Historical import path of the order transition rule.
 *
 * The transition table, the guard and the error of the order state machine
 * live in the public order policy of this module, so that the data of the
 * rule does not live in the file that depends on it. This module re-exports
 * them, so the historical import path keeps working.
 */

export { allowed, assertOrderTransition, InvalidOrderTransitionError } from './policy';
