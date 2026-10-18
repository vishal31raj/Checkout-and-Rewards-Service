import { Router, type IRouter } from "express";
import type { Pool } from "pg";
import { ApiError } from "./errors";
import {
  addCartItem,
  checkout,
  createCart,
  generateCoupon,
  getAdminReport,
  getCart,
  getOrder,
  getRewardConfig,
  listProducts,
  normalizeCouponCode,
  removeCartItem,
  updateCartItem,
  updateRewardConfig,
} from "./service";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const productIdPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;

function objectBody(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiError(400, "invalid_request", "Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function pathUuid(value: string, name: string): string {
  if (!uuidPattern.test(value)) {
    throw new ApiError(400, "invalid_id", `${name} must be a valid UUID.`);
  }
  return value;
}

function pathProductId(value: string): string {
  if (!productIdPattern.test(value)) {
    throw new ApiError(400, "invalid_product_id", "Product ID must be a lowercase slug.");
  }
  return value;
}

function quantityFrom(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 100_000
  ) {
    throw new ApiError(400, "invalid_quantity", "Quantity must be an integer between 1 and 100000.");
  }
  return value;
}

export function createCommerceRouter(pool: Pool): IRouter {
  const router: IRouter = Router();

  router.get("/products", async (_req, res) => {
    res.json({ products: await listProducts(pool) });
  });

  router.post("/carts", async (_req, res) => {
    res.status(201).json(await createCart(pool));
  });

  router.get("/carts/:cartId", async (req, res) => {
    res.json(await getCart(pool, pathUuid(req.params.cartId, "cartId")));
  });

  router.post("/carts/:cartId/items", async (req, res) => {
    const body = objectBody(req.body);
    if (typeof body.productId !== "string") {
      throw new ApiError(400, "invalid_product_id", "productId is required.");
    }
    const cart = await addCartItem(
      pool,
      pathUuid(req.params.cartId, "cartId"),
      pathProductId(body.productId),
      quantityFrom(body.quantity),
    );
    res.status(200).json(cart);
  });

  router.put("/carts/:cartId/items/:productId", async (req, res) => {
    const body = objectBody(req.body);
    const cart = await updateCartItem(
      pool,
      pathUuid(req.params.cartId, "cartId"),
      pathProductId(req.params.productId),
      quantityFrom(body.quantity),
    );
    res.json(cart);
  });

  router.delete("/carts/:cartId/items/:productId", async (req, res) => {
    const cart = await removeCartItem(
      pool,
      pathUuid(req.params.cartId, "cartId"),
      pathProductId(req.params.productId),
    );
    res.json(cart);
  });

  router.post("/carts/:cartId/checkout", async (req, res) => {
    const body = req.body === undefined ? {} : objectBody(req.body);
    const rawKey = req.get("Idempotency-Key");
    const idempotencyKey = rawKey?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200) {
      throw new ApiError(400, "idempotency_key_required", "Provide an Idempotency-Key header of 1 to 200 characters.");
    }
    if (body.couponCode !== undefined && typeof body.couponCode !== "string") {
      throw new ApiError(400, "invalid_coupon_code", "couponCode must be a string.");
    }
    const couponCode =
      typeof body.couponCode === "string"
        ? normalizeCouponCode(body.couponCode)
        : undefined;
    if (
      body.couponCode !== undefined &&
      (!couponCode || couponCode.length > 80)
    ) {
      throw new ApiError(400, "invalid_coupon_code", "couponCode must be between 1 and 80 characters.");
    }
    const result = await checkout(
      pool,
      pathUuid(req.params.cartId, "cartId"),
      idempotencyKey,
      couponCode,
    );
    if (result.replayed) res.setHeader("Idempotent-Replay", "true");
    res.status(result.replayed ? 200 : 201).json(result.order);
  });

  router.get("/orders/:orderId", async (req, res) => {
    res.json(await getOrder(pool, pathUuid(req.params.orderId, "orderId")));
  });

  // Authentication is intentionally omitted for this assignment; these routes are administrative.
  router.get("/admin/rewards/config", async (_req, res) => {
    res.json(await getRewardConfig(pool));
  });

  router.put("/admin/rewards/config", async (req, res) => {
    const body = objectBody(req.body);
    if (
      typeof body.ordersPerCoupon !== "number" ||
      !Number.isInteger(body.ordersPerCoupon) ||
      body.ordersPerCoupon < 1 ||
      body.ordersPerCoupon > 100_000
    ) {
      throw new ApiError(400, "invalid_reward_config", "ordersPerCoupon must be an integer between 1 and 100000.");
    }
    if (
      typeof body.discountPercent !== "number" ||
      !Number.isInteger(body.discountPercent) ||
      body.discountPercent < 1 ||
      body.discountPercent > 100
    ) {
      throw new ApiError(400, "invalid_reward_config", "discountPercent must be an integer between 1 and 100.");
    }
    res.json(
      await updateRewardConfig(
        pool,
        body.ordersPerCoupon,
        body.discountPercent,
      ),
    );
  });

  router.post("/admin/coupons/generate", async (_req, res) => {
    const result = await generateCoupon(pool);
    res.json(result);
  });

  router.get("/admin/report", async (_req, res) => {
    res.json(await getAdminReport(pool));
  });

  return router;
}
