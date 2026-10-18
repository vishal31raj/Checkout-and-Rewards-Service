import { randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { ApiError, isPostgresError } from "./errors";

type DbRow = Record<string, any>;

const MAX_CART_QUANTITY = 100_000;

function asCents(value: string | number | bigint): string {
  return BigInt(value).toString();
}

function requireOpenCart(status: string): void {
  if (status !== "open") {
    throw new ApiError(409, "cart_checked_out", "This cart has already been checked out.");
  }
}

async function readOrder(client: PoolClient, orderId: string): Promise<DbRow | null> {
  const result = await client.query(
    `SELECT o.id, o.cart_id, o.currency, o.subtotal_cents, o.discount_cents,
            o.total_cents, o.created_at, o.coupon_id, c.code AS coupon_code,
            c.discount_percent AS coupon_discount_percent
       FROM orders o
       LEFT JOIN coupons c ON c.id = o.coupon_id
      WHERE o.id = $1`,
    [orderId],
  );
  const row = result.rows[0] as DbRow | undefined;
  if (!row) return null;

  const items = await client.query(
    `SELECT product_id, product_name, unit_price_cents, quantity, line_total_cents
       FROM order_items
      WHERE order_id = $1
      ORDER BY product_id`,
    [orderId],
  );
  return {
    id: row.id,
    cartId: row.cart_id,
    currency: row.currency,
    subtotalCents: asCents(row.subtotal_cents),
    discountCents: asCents(row.discount_cents),
    totalCents: asCents(row.total_cents),
    coupon:
      row.coupon_id === null
        ? null
        : {
            code: row.coupon_code,
            discountPercent: row.coupon_discount_percent,
          },
    items: items.rows.map((item: DbRow) => ({
      productId: item.product_id,
      productName: item.product_name,
      unitPriceCents: asCents(item.unit_price_cents),
      quantity: item.quantity,
      lineTotalCents: asCents(item.line_total_cents),
    })),
    createdAt: row.created_at,
  };
}

async function readCart(client: PoolClient, cartId: string): Promise<DbRow | null> {
  const cartResult = await client.query(
    `SELECT id, status, created_at, checked_out_at FROM carts WHERE id = $1`,
    [cartId],
  );
  const cart = cartResult.rows[0] as DbRow | undefined;
  if (!cart) return null;

  const items = await client.query(
    `SELECT p.id AS product_id, p.name, p.unit_price_cents, p.inventory, p.active,
            ci.quantity, (p.unit_price_cents * ci.quantity)::text AS line_total_cents
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = $1
      ORDER BY p.id`,
    [cartId],
  );
  const subtotal = items.rows.reduce(
    (sum: bigint, item: DbRow) => sum + BigInt(item.line_total_cents),
    0n,
  );

  return {
    id: cart.id,
    status: cart.status,
    createdAt: cart.created_at,
    checkedOutAt: cart.checked_out_at,
    items: items.rows.map((item: DbRow) => ({
      productId: item.product_id,
      productName: item.name,
      unitPriceCents: asCents(item.unit_price_cents),
      quantity: item.quantity,
      lineTotalCents: asCents(item.line_total_cents),
      availableInventory: item.inventory,
      active: item.active,
    })),
    subtotalCents: subtotal.toString(),
    currency: "USD",
  };
}

async function transaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let open = false;
  try {
    await client.query("BEGIN");
    open = true;
    const result = await fn(client);
    await client.query("COMMIT");
    open = false;
    return result;
  } catch (error) {
    if (open) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listProducts(pool: Pool): Promise<DbRow[]> {
  const result = await pool.query(
    `SELECT id, name, unit_price_cents, inventory, active
       FROM products
      WHERE active = TRUE
      ORDER BY id`,
  );
  return result.rows.map((row: DbRow) => ({
    id: row.id,
    name: row.name,
    unitPriceCents: asCents(row.unit_price_cents),
    inventory: row.inventory,
    currency: "USD",
  }));
}

export async function createCart(pool: Pool): Promise<DbRow> {
  const id = randomUUID();
  await pool.query("INSERT INTO carts (id) VALUES ($1)", [id]);
  return getCart(pool, id);
}

export async function getCart(pool: Pool, cartId: string): Promise<DbRow> {
  const client = await pool.connect();
  try {
    const cart = await readCart(client, cartId);
    if (!cart) throw new ApiError(404, "cart_not_found", "Cart was not found.");
    return cart;
  } finally {
    client.release();
  }
}

async function withEditableCart<T>(
  pool: Pool,
  cartId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return transaction(pool, async (client) => {
    const result = await client.query(
      "SELECT status FROM carts WHERE id = $1 FOR UPDATE",
      [cartId],
    );
    const cart = result.rows[0] as DbRow | undefined;
    if (!cart) throw new ApiError(404, "cart_not_found", "Cart was not found.");
    requireOpenCart(cart.status);
    return fn(client);
  });
}

export async function addCartItem(
  pool: Pool,
  cartId: string,
  productId: string,
  quantity: number,
): Promise<DbRow> {
  await withEditableCart(pool, cartId, async (client) => {
    const productResult = await client.query(
      `SELECT id, inventory, active FROM products WHERE id = $1 FOR UPDATE`,
      [productId],
    );
    const product = productResult.rows[0] as DbRow | undefined;
    if (!product || !product.active) {
      throw new ApiError(404, "product_not_found", "Product was not found.");
    }
    const currentResult = await client.query(
      "SELECT quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2",
      [cartId, productId],
    );
    const current = Number(currentResult.rows[0]?.quantity ?? 0);
    const next = current + quantity;
    if (next > MAX_CART_QUANTITY) {
      throw new ApiError(400, "invalid_quantity", `A cart line cannot exceed ${MAX_CART_QUANTITY} units.`);
    }
    if (next > product.inventory) {
      throw new ApiError(409, "insufficient_inventory", "Requested quantity exceeds current inventory.", {
        productId,
        available: product.inventory,
        requested: next,
      });
    }
    await client.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, product_id)
       DO UPDATE SET quantity = EXCLUDED.quantity`,
      [cartId, productId, next],
    );
  });
  return getCart(pool, cartId);
}

export async function updateCartItem(
  pool: Pool,
  cartId: string,
  productId: string,
  quantity: number,
): Promise<DbRow> {
  await withEditableCart(pool, cartId, async (client) => {
    const productResult = await client.query(
      `SELECT id, inventory, active FROM products WHERE id = $1 FOR UPDATE`,
      [productId],
    );
    const product = productResult.rows[0] as DbRow | undefined;
    if (!product || !product.active) {
      throw new ApiError(404, "product_not_found", "Product was not found.");
    }
    const currentResult = await client.query(
      "SELECT quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2",
      [cartId, productId],
    );
    if (!currentResult.rows[0]) {
      throw new ApiError(404, "cart_item_not_found", "Cart item was not found.");
    }
    if (quantity > product.inventory) {
      throw new ApiError(409, "insufficient_inventory", "Requested quantity exceeds current inventory.", {
        productId,
        available: product.inventory,
        requested: quantity,
      });
    }
    await client.query(
      "UPDATE cart_items SET quantity = $3 WHERE cart_id = $1 AND product_id = $2",
      [cartId, productId, quantity],
    );
  });
  return getCart(pool, cartId);
}

export async function removeCartItem(
  pool: Pool,
  cartId: string,
  productId: string,
): Promise<DbRow> {
  await withEditableCart(pool, cartId, async (client) => {
    const result = await client.query(
      "DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2",
      [cartId, productId],
    );
    if (result.rowCount === 0) {
      throw new ApiError(404, "cart_item_not_found", "Cart item was not found.");
    }
  });
  return getCart(pool, cartId);
}

export async function checkout(
  pool: Pool,
  cartId: string,
  idempotencyKey: string,
  couponCode?: string,
): Promise<{ order: DbRow; replayed: boolean }> {
  try {
    return await transaction(pool, async (client) => {
      const prior = await client.query(
        "SELECT id, cart_id FROM orders WHERE idempotency_key = $1",
        [idempotencyKey],
      );
      if (prior.rows[0]) {
        if (prior.rows[0].cart_id !== cartId) {
          throw new ApiError(409, "idempotency_key_reused", "This idempotency key was already used for a different cart.");
        }
        const order = await readOrder(client, prior.rows[0].id);
        if (!order) throw new Error("Idempotency record refers to a missing order.");
        return { order, replayed: true };
      }

      const cartResult = await client.query(
        "SELECT id, status FROM carts WHERE id = $1 FOR UPDATE",
        [cartId],
      );
      const cart = cartResult.rows[0] as DbRow | undefined;
      if (!cart) throw new ApiError(404, "cart_not_found", "Cart was not found.");
      if (cart.status === "checked_out") {
        const existing = await client.query("SELECT id FROM orders WHERE cart_id = $1", [cartId]);
        if (!existing.rows[0]) throw new Error("Checked-out cart has no corresponding order.");
        const order = await readOrder(client, existing.rows[0].id);
        if (!order) throw new Error("Checked-out cart order could not be retrieved.");
        return { order, replayed: true };
      }

      const lineResult = await client.query(
        `SELECT p.id, p.name, p.unit_price_cents, p.inventory, p.active, ci.quantity
           FROM cart_items ci
           JOIN products p ON p.id = ci.product_id
          WHERE ci.cart_id = $1
          ORDER BY p.id
          FOR UPDATE OF p`,
        [cartId],
      );
      const lines = lineResult.rows as DbRow[];
      if (lines.length === 0) {
        throw new ApiError(409, "empty_cart", "An empty cart cannot be checked out.");
      }

      for (const line of lines) {
        if (!line.active) {
          throw new ApiError(409, "product_unavailable", "A product in this cart is no longer available.", {
            productId: line.id,
          });
        }
        if (line.quantity > line.inventory) {
          throw new ApiError(409, "insufficient_inventory", "There is not enough inventory to complete checkout.", {
            productId: line.id,
            available: line.inventory,
            requested: line.quantity,
          });
        }
      }

      let coupon: DbRow | undefined;
      if (couponCode) {
        const couponResult = await client.query(
          `SELECT id, code, discount_percent, status
             FROM coupons
            WHERE code = $1
            FOR UPDATE`,
          [couponCode],
        );
        coupon = couponResult.rows[0] as DbRow | undefined;
        if (!coupon) {
          throw new ApiError(409, "coupon_invalid", "Coupon code is invalid or unavailable.");
        }
        if (coupon.status !== "available") {
          throw new ApiError(409, "coupon_redeemed", "Coupon has already been redeemed.");
        }
      }

      const subtotal = lines.reduce(
        (sum, line) =>
          sum + BigInt(line.unit_price_cents) * BigInt(line.quantity),
        0n,
      );
      const discountPercent = BigInt(coupon?.discount_percent ?? 0);
      const discount = (subtotal * discountPercent) / 100n;
      const total = subtotal - discount;
      const orderId = randomUUID();

      for (const line of lines) {
        const updated = await client.query(
          `UPDATE products SET inventory = inventory - $2
            WHERE id = $1 AND inventory >= $2`,
          [line.id, line.quantity],
        );
        if (updated.rowCount !== 1) {
          throw new ApiError(409, "insufficient_inventory", "There is not enough inventory to complete checkout.", {
            productId: line.id,
          });
        }
      }

      await client.query(
        `INSERT INTO orders
          (id, cart_id, idempotency_key, coupon_id, subtotal_cents, discount_cents, total_cents)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          orderId,
          cartId,
          idempotencyKey,
          coupon?.id ?? null,
          subtotal.toString(),
          discount.toString(),
          total.toString(),
        ],
      );
      for (const line of lines) {
        const lineTotal = BigInt(line.unit_price_cents) * BigInt(line.quantity);
        await client.query(
          `INSERT INTO order_items
            (order_id, product_id, product_name, unit_price_cents, quantity, line_total_cents)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            orderId,
            line.id,
            line.name,
            asCents(line.unit_price_cents),
            line.quantity,
            lineTotal.toString(),
          ],
        );
      }
      if (coupon) {
        const redeemed = await client.query(
          `UPDATE coupons SET status = 'redeemed', redeemed_at = NOW()
            WHERE id = $1 AND status = 'available'`,
          [coupon.id],
        );
        if (redeemed.rowCount !== 1) {
          throw new ApiError(409, "coupon_redeemed", "Coupon has already been redeemed.");
        }
      }
      await client.query(
        "UPDATE carts SET status = 'checked_out', checked_out_at = NOW() WHERE id = $1",
        [cartId],
      );
      const order = await readOrder(client, orderId);
      if (!order) throw new Error("Newly created order could not be retrieved.");
      return { order, replayed: false };
    });
  } catch (error) {
    if (isPostgresError(error) && error.code === "23505") {
      const prior = await pool.query(
        "SELECT id, cart_id FROM orders WHERE idempotency_key = $1",
        [idempotencyKey],
      );
      if (prior.rows[0]) {
        if (prior.rows[0].cart_id !== cartId) {
          throw new ApiError(409, "idempotency_key_reused", "This idempotency key was already used for a different cart.");
        }
        const client = await pool.connect();
        try {
          const order = await readOrder(client, prior.rows[0].id);
          if (order) return { order, replayed: true };
        } finally {
          client.release();
        }
      }
    }
    throw error;
  }
}

export async function getOrder(pool: Pool, orderId: string): Promise<DbRow> {
  const client = await pool.connect();
  try {
    const order = await readOrder(client, orderId);
    if (!order) throw new ApiError(404, "order_not_found", "Order was not found.");
    return order;
  } finally {
    client.release();
  }
}

export async function generateCoupon(
  pool: Pool,
): Promise<{ coupon: DbRow | null; eligibleOrderCount: number }> {
  return transaction(pool, async (client) => {
    const configResult = await client.query(
      `SELECT orders_per_coupon, discount_percent
         FROM reward_config
        WHERE singleton = TRUE
        FOR UPDATE`,
    );
    const config = configResult.rows[0] as DbRow | undefined;
    if (!config) throw new Error("Reward configuration is missing.");

    const countResult = await client.query("SELECT COUNT(*)::int AS count FROM orders");
    const orderCount = Number(countResult.rows[0].count);
    const interval = Number(config.orders_per_coupon);
    const highestMilestone = Math.floor(orderCount / interval) * interval;
    if (highestMilestone === 0) return { coupon: null, eligibleOrderCount: orderCount };

    const missing = await client.query(
      `SELECT milestone
         FROM generate_series($1::int, $2::int, $1::int) AS milestones(milestone)
         LEFT JOIN coupons c ON c.milestone_order_count = milestones.milestone
        WHERE c.id IS NULL
        ORDER BY milestone
        LIMIT 1`,
      [interval, highestMilestone],
    );
    if (!missing.rows[0]) return { coupon: null, eligibleOrderCount: orderCount };

    const milestone = Number(missing.rows[0].milestone);
    const code = `REWARD-${milestone}-${randomBytes(6).toString("hex").toUpperCase()}`;
    const couponId = randomUUID();
    const result = await client.query(
      `INSERT INTO coupons (id, code, milestone_order_count, discount_percent)
       VALUES ($1, $2, $3, $4)
       RETURNING id, code, milestone_order_count, discount_percent, status, created_at`,
      [couponId, code, milestone, config.discount_percent],
    );
    const row = result.rows[0] as DbRow;
    return {
      coupon: {
        id: row.id,
        code: row.code,
        milestoneOrderCount: row.milestone_order_count,
        discountPercent: row.discount_percent,
        status: row.status,
        createdAt: row.created_at,
      },
      eligibleOrderCount: orderCount,
    };
  });
}

export async function getRewardConfig(pool: Pool): Promise<DbRow> {
  const result = await pool.query(
    `SELECT orders_per_coupon, discount_percent
       FROM reward_config
      WHERE singleton = TRUE`,
  );
  const row = result.rows[0] as DbRow | undefined;
  if (!row) throw new Error("Reward configuration is missing.");
  return {
    ordersPerCoupon: row.orders_per_coupon,
    discountPercent: row.discount_percent,
  };
}

export async function updateRewardConfig(
  pool: Pool,
  ordersPerCoupon: number,
  discountPercent: number,
): Promise<DbRow> {
  const result = await pool.query(
    `UPDATE reward_config
        SET orders_per_coupon = $1,
            discount_percent = $2,
            updated_at = NOW()
      WHERE singleton = TRUE
      RETURNING orders_per_coupon, discount_percent`,
    [ordersPerCoupon, discountPercent],
  );
  const row = result.rows[0] as DbRow | undefined;
  if (!row) throw new Error("Reward configuration is missing.");
  return {
    ordersPerCoupon: row.orders_per_coupon,
    discountPercent: row.discount_percent,
  };
}

export async function getAdminReport(pool: Pool): Promise<DbRow> {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::text FROM orders) AS total_orders,
      (SELECT COALESCE(SUM(subtotal_cents), 0)::text FROM orders) AS gross_revenue_cents,
      (SELECT COALESCE(SUM(discount_cents), 0)::text FROM orders) AS total_discounts_cents,
      (SELECT COALESCE(SUM(total_cents), 0)::text FROM orders) AS net_revenue_cents,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'productId', product_id,
          'productName', product_name,
          'quantity', quantity
        ) ORDER BY product_id)
        FROM (
          SELECT product_id, MAX(product_name) AS product_name, SUM(quantity)::int AS quantity
            FROM order_items
           GROUP BY product_id
        ) purchased
      ), '[]'::jsonb) AS purchased_quantity_by_product,
      (SELECT COUNT(*)::text FROM coupons) AS coupons_generated,
      (SELECT COUNT(*)::text FROM coupons WHERE status = 'available') AS coupons_available,
      (SELECT COUNT(*)::text FROM coupons WHERE status = 'redeemed') AS coupons_redeemed
  `);
  const row = result.rows[0] as DbRow;
  return {
    totalOrders: row.total_orders,
    grossRevenueCents: row.gross_revenue_cents,
    totalDiscountsCents: row.total_discounts_cents,
    netRevenueCents: row.net_revenue_cents,
    purchasedQuantityByProduct: row.purchased_quantity_by_product,
    coupons: {
      generated: row.coupons_generated,
      available: row.coupons_available,
      redeemed: row.coupons_redeemed,
    },
    currency: "USD",
  };
}

export function normalizeCouponCode(value: string): string {
  return value.trim().toUpperCase();
}
