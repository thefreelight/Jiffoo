import '../../src/core/logger/production-console';
import { once } from 'node:events';
import { logger } from '../../src/core/logger/logger';

console.info('Startup message\nwith a newline');
console.error(JSON.stringify({ event: 'plugin_process_failure', context: 'unhandledRejection', slug: 'probe' }));
logger.info('Request message', { requestId: 'compose-request', orderId: 'compose-order' });
logger.error(new Error('Logged failure'));
async function finish() {
  if (logger.transports.some(transport => 'filename' in transport)) throw new Error('Production file transport is forbidden');
  const finished = once(logger, 'finish');
  logger.end();
  await finished;
}
void finish();
