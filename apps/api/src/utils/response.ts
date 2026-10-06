import { FastifyReply } from 'fastify';
import { catalogError, sendMappedError } from './api-errors';

export function sendSuccess(reply: FastifyReply, data: any, message?: string, statusCode: number = 200) {
    return reply.code(statusCode).send({
        success: true,
        data,
        message,
    });
}

export function sendError(reply: FastifyReply, _httpStatus: number, code: string, _message: string, details?: unknown) {
    return sendMappedError(reply, catalogError(code, details));
}
