import { Router, type IRouter } from "express";
import type { Pool } from "pg";
import { createCommerceRouter } from "../commerce/routes";
import healthRouter from "./health";

export function createApiRouter(pool: Pool): IRouter {
  const router: IRouter = Router();
  router.use(healthRouter);
  router.use(createCommerceRouter(pool));
  return router;
}
