import { FastifyReply } from 'fastify';

export function sendSuccess(reply: FastifyReply, data: any, message?: string, statusCode: number = 200) {
    return reply.code(statusCode).send({
        success: true,
        data,
        message,
    });
}

export function sendError(reply: FastifyReply, httpStatus: number, code: string, message: string, details?: unknown) {
    return reply.code(httpStatus).send({
        success: false,
        error: {
            code,
            message,
            details,
        },
    });
}
