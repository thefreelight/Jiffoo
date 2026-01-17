import { Queue, Job } from 'bull';
import { FastifyRequest } from 'fastify';
import { getRequestId } from '@/core/logger/trace-context';
import { winstonLogger } from '@/core/logger/unified-logger';
import winston from 'winston';

export class QueueService {
    private queue: Queue;

    constructor(queue: Queue) {
        this.queue = queue;
    }

    /**
     * Add job to queue with request ID
     */
    async addJob(
        name: string,
        data: any,
        request?: FastifyRequest
    ) {
        const requestId = request ? getRequestId(request) : undefined;

        return this.queue.add(name, {
            ...data,
            // Propagate request ID to job
            _requestId: requestId,
        }, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
        });
    }

    /**
     * Process job with request ID in logs
     */
    async processJob(job: Job, handler: (job: Job, logger: winston.Logger) => Promise<void>) {
        const requestId = job.data._requestId || 'job-' + job.id;
        // Create a child logger with requestId
        const jobLogger = winstonLogger.child({ requestId, jobId: job.id });

        jobLogger.info(`Processing job: ${job.name}`);

        try {
            // Job processing logic
            await handler(job, jobLogger);

            jobLogger.info(`Job completed: ${job.name}`);
        } catch (error) {
            jobLogger.error(`Job failed: ${job.name}`, { error });
            throw error;
        }
    }
}
