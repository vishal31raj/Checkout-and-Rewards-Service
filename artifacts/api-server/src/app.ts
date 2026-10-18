import { pool as defaultPool } from "@workspace/db";
import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import type { Pool } from "pg";
import { ApiError } from "./commerce/errors";
import { createApiRouter } from "./routes";
import { logger } from "./lib/logger";

export function createApp(pool: Pool = defaultPool): Express {
  const app: Express = express();

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
  app.use(cors());
  app.use(express.json({ limit: "64kb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", createApiRouter(pool));
  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: { code: "route_not_found", message: "API route was not found." },
    });
  });

  const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    if (error instanceof ApiError) {
      res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
      return;
    }
    if (
      error instanceof SyntaxError &&
      "body" in error
    ) {
      res.status(400).json({
        error: { code: "invalid_json", message: "Request body must contain valid JSON." },
      });
      return;
    }
    req.log.error({ err: error }, "Unhandled request error");
    res.status(500).json({
      error: { code: "internal_error", message: "An unexpected error occurred." },
    });
  };
  app.use(errorHandler);
  return app;
}

export default createApp();
