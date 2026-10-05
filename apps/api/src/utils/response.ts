import { FastifyReply } from 'fastify';
import { PROTECTION_RETRY_SECONDS } from '@/infra/shared-protection';

export function sendSuccess(reply: FastifyReply, data: any, message?: string, statusCode: number = 200) {
    return reply.code(statusCode).send({
        success: true,
        data,
        message,
    });
}

export function sendError(reply: FastifyReply, httpStatus: number, code: string, message: string, details?: unknown) {
    if (code === 'SHARED_PROTECTION_UNAVAILABLE') reply.header('Retry-After', PROTECTION_RETRY_SECONDS).header('Cache-Control', 'no-store');
    return reply.code(httpStatus).send({
        success: false,
        error: {
            code,
            message,
            details,
        },
    });
}
