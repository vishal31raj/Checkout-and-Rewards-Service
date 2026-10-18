import { pool } from "@workspace/db";
import app from "./app";
import { initializeCommerceSchema } from "./commerce/schema";
import { logger } from "./lib/logger";

async function start(): Promise<void> {
  await initializeCommerceSchema(pool);
  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

start().catch((error: unknown) => {
  logger.error({ err: error }, "API server failed to start");
  process.exit(1);
});
