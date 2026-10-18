import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Pool } from "pg";
import { createApp } from "../app";
import { initializeCommerceSchema } from "../commerce/schema";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("Set TEST_DATABASE_URL to run the isolated PostgreSQL integration tests.");
}

const schemaName = `checkout_test_${randomBytes(8).toString("hex")}`;
const adminPool = new Pool({ connectionString: testDatabaseUrl });
const testPool = new Pool({
  connectionString: testDatabaseUrl,
  options: `-c search_path=${schemaName}`,
});
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
let baseUrl = "";

before(async () => {
  await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
  const previousInterval = process.env.REWARD_ORDER_INTERVAL;
  const previousPercent = process.env.REWARD_DISCOUNT_PERCENT;
  process.env.REWARD_ORDER_INTERVAL = "2";
  process.env.REWARD_DISCOUNT_PERCENT = "10";
  try {
    await initializeCommerceSchema(testPool);
  } finally {
    if (previousInterval === undefined) delete process.env.REWARD_ORDER_INTERVAL;
    else process.env.REWARD_ORDER_INTERVAL = previousInterval;
    if (previousPercent === undefined) delete process.env.REWARD_DISCOUNT_PERCENT;
    else process.env.REWARD_DISCOUNT_PERCENT = previousPercent;
  }

  await new Promise<void>((resolve, reject) => {
    server = createApp(testPool).listen(0, "127.0.0.1");
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test API did not bind to a TCP port.");
  }
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  await testPool.end();
  await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await adminPool.end();
});

async function request(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    idempotencyKey?: string;
  } = {},
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(options.idempotencyKey
        ? { "Idempotency-Key": options.idempotencyKey }
        : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

async function createTestProduct(inventory: number, priceCents: number): Promise<string> {
  const id = `test-${randomBytes(6).toString("hex")}`;
  await testPool.query(
    `INSERT INTO products (id, name, unit_price_cents, inventory)
     VALUES ($1, $2, $3, $4)`,
    [id, `Test Product ${id}`, priceCents, inventory],
  );
  return id;
}

async function createCartWithProduct(
  productId: string,
  quantity: number,
): Promise<string> {
  const response = await request("/carts", { method: "POST" });
  assert.equal(response.status, 201);
  const cart = (await response.json()) as { id: string };
  const addResponse = await request(`/carts/${cart.id}/items`, {
    method: "POST",
    body: { productId, quantity },
  });
  assert.equal(addResponse.status, 200);
  return cart.id;
}

test("a checkout retry returns the same order and changes inventory once", async () => {
  const productId = await createTestProduct(5, 1234);
  const cartId = await createCartWithProduct(productId, 2);
  const key = `retry-${randomUUID()}`;

  const first = await request(`/carts/${cartId}/checkout`, {
    method: "POST",
    idempotencyKey: key,
  });
  assert.equal(first.status, 201);
  const order = (await first.json()) as {
    id: string;
    subtotalCents: string;
    totalCents: string;
    items: Array<{ unitPriceCents: string; quantity: number }>;
  };
  assert.equal(order.subtotalCents, "2468");
  assert.equal(order.totalCents, "2468");
  assert.equal(order.items[0]?.unitPriceCents, "1234");

  const retry = await request(`/carts/${cartId}/checkout`, {
    method: "POST",
    idempotencyKey: key,
  });
  assert.equal(retry.status, 200);
  assert.equal(retry.headers.get("Idempotent-Replay"), "true");
  const replayedOrder = (await retry.json()) as { id: string };
  assert.equal(replayedOrder.id, order.id);

  const inventory = await testPool.query(
    "SELECT inventory FROM products WHERE id = $1",
    [productId],
  );
  assert.equal(inventory.rows[0].inventory, 3);
  const savedOrders = await testPool.query(
    "SELECT COUNT(*)::int AS count FROM orders WHERE idempotency_key = $1",
    [key],
  );
  assert.equal(savedOrders.rows[0].count, 1);
});

test("competing checkouts cannot oversell the last unit", async () => {
  const productId = await createTestProduct(1, 500);
  const firstCart = await createCartWithProduct(productId, 1);
  const secondCart = await createCartWithProduct(productId, 1);

  const results = await Promise.all([
    request(`/carts/${firstCart}/checkout`, {
      method: "POST",
      idempotencyKey: `race-a-${randomUUID()}`,
    }),
    request(`/carts/${secondCart}/checkout`, {
      method: "POST",
      idempotencyKey: `race-b-${randomUUID()}`,
    }),
  ]);
  assert.deepEqual(
    results.map((result) => result.status).sort(),
    [201, 409],
  );
  const failed = results.find((result) => result.status === 409);
  assert.ok(failed);
  const failureBody = (await failed.json()) as { error: { code: string } };
  assert.equal(failureBody.error.code, "insufficient_inventory");

  const inventory = await testPool.query(
    "SELECT inventory FROM products WHERE id = $1",
    [productId],
  );
  assert.equal(inventory.rows[0].inventory, 0);
});

test("a failed checkout does not consume a coupon, and concurrent redemption has one winner", async () => {
  const qualifyingProduct = await createTestProduct(20, 1050);
  for (let index = 0; index < 2; index += 1) {
    const cartId = await createCartWithProduct(qualifyingProduct, 1);
    const response = await request(`/carts/${cartId}/checkout`, {
      method: "POST",
      idempotencyKey: `qualify-${randomUUID()}`,
    });
    assert.equal(response.status, 201);
  }

  const [firstGeneration, secondGeneration] = await Promise.all([
    request("/admin/coupons/generate", { method: "POST" }),
    request("/admin/coupons/generate", { method: "POST" }),
  ]);
  assert.equal(firstGeneration.status, 200);
  assert.equal(secondGeneration.status, 200);
  const generated = await Promise.all([
    firstGeneration.json() as Promise<{
      coupon: { code: string; milestoneOrderCount: number } | null;
    }>,
    secondGeneration.json() as Promise<{
      coupon: { code: string; milestoneOrderCount: number } | null;
    }>,
  ]);
  const coupons = generated.map((result) => result.coupon).filter(Boolean);
  assert.equal(coupons.length, 2);
  assert.equal(new Set(coupons.map((coupon) => coupon?.milestoneOrderCount)).size, 2);
  const coupon = coupons[0];
  assert.ok(coupon);

  const scarceProduct = await createTestProduct(1, 700);
  const failingCart = await createCartWithProduct(scarceProduct, 1);
  await testPool.query("UPDATE products SET inventory = 0 WHERE id = $1", [scarceProduct]);
  const failedCheckout = await request(`/carts/${failingCart}/checkout`, {
    method: "POST",
    idempotencyKey: `failed-${randomUUID()}`,
    body: { couponCode: coupon.code },
  });
  assert.equal(failedCheckout.status, 409);
  const stillAvailable = await testPool.query(
    "SELECT status FROM coupons WHERE code = $1",
    [coupon.code],
  );
  assert.equal(stillAvailable.rows[0].status, "available");

  const redeemableProduct = await createTestProduct(2, 1000);
  const firstCart = await createCartWithProduct(redeemableProduct, 1);
  const secondCart = await createCartWithProduct(redeemableProduct, 1);
  const redemptionResults = await Promise.all([
    request(`/carts/${firstCart}/checkout`, {
      method: "POST",
      idempotencyKey: `coupon-a-${randomUUID()}`,
      body: { couponCode: coupon.code },
    }),
    request(`/carts/${secondCart}/checkout`, {
      method: "POST",
      idempotencyKey: `coupon-b-${randomUUID()}`,
      body: { couponCode: coupon.code },
    }),
  ]);
  assert.deepEqual(
    redemptionResults.map((result) => result.status).sort(),
    [201, 409],
  );

  const couponState = await testPool.query(
    "SELECT status FROM coupons WHERE code = $1",
    [coupon.code],
  );
  assert.equal(couponState.rows[0].status, "redeemed");

  const reportResponse = await request("/admin/report");
  const report = (await reportResponse.json()) as {
    grossRevenueCents: string;
    totalDiscountsCents: string;
    netRevenueCents: string;
  };
  assert.equal(
    BigInt(report.grossRevenueCents) - BigInt(report.netRevenueCents),
    BigInt(report.totalDiscountsCents),
  );
});
