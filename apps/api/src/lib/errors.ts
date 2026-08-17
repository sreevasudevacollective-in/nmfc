import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

/** Errors the API raises deliberately, carrying the status and code to return. */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, identifier: string) {
    super(404, "NOT_FOUND", `${resource} '${identifier}' was not found`);
  }
}

/**
 * Single error shape for every failure: `{ error: { code, message, details? } }`
 * (docs/system-design.md §4).
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: { code: "NOT_FOUND", message: `Route ${request.method} ${request.url} not found` },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_FAILED",
          message: "Request validation failed",
          details: error.issues,
        },
      });
    }

    // Fastify's own errors (malformed JSON, unsupported media type) carry a usable status.
    const fastifyError = error as { statusCode?: number; code?: string; message?: string };
    if (typeof fastifyError.statusCode === "number" && fastifyError.statusCode < 500) {
      return reply.status(fastifyError.statusCode).send({
        error: {
          code: fastifyError.code ?? "BAD_REQUEST",
          message: fastifyError.message ?? "Bad request",
        },
      });
    }

    // Anything else is a bug — log it in full, tell the client nothing.
    request.log.error(error);
    return reply.status(500).send({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    });
  });
}
