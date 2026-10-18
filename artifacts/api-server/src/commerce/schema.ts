import type { Pool } from "pg";

function integerSetting(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export async function initializeCommerceSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        unit_price_cents BIGINT NOT NULL CHECK (unit_price_cents >= 0),
        inventory INTEGER NOT NULL CHECK (inventory >= 0),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reward_config (
        singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
        orders_per_coupon INTEGER NOT NULL CHECK (orders_per_coupon > 0),
        discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id UUID PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'checked_out')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        checked_out_at TIMESTAMPTZ
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100000),
        PRIMARY KEY (cart_id, product_id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id UUID PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        milestone_order_count INTEGER NOT NULL UNIQUE CHECK (milestone_order_count > 0),
        discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
        status TEXT NOT NULL DEFAULT 'available'
          CHECK (status IN ('available', 'redeemed')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        redeemed_at TIMESTAMPTZ
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY,
        cart_id UUID NOT NULL UNIQUE REFERENCES carts(id),
        idempotency_key TEXT NOT NULL UNIQUE,
        coupon_id UUID UNIQUE REFERENCES coupons(id),
        currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
        subtotal_cents BIGINT NOT NULL CHECK (subtotal_cents >= 0),
        discount_cents BIGINT NOT NULL CHECK (discount_cents >= 0),
        total_cents BIGINT NOT NULL CHECK (total_cents >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (total_cents = subtotal_cents - discount_cents)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        unit_price_cents BIGINT NOT NULL CHECK (unit_price_cents >= 0),
        quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100000),
        line_total_cents BIGINT NOT NULL CHECK (line_total_cents >= 0),
        PRIMARY KEY (order_id, product_id),
        CHECK (line_total_cents = unit_price_cents * quantity)
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items(product_id)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at)",
    );

    const ordersPerCoupon = integerSetting(
      "REWARD_ORDER_INTERVAL",
      5,
      1,
      100000,
    );
    const discountPercent = integerSetting(
      "REWARD_DISCOUNT_PERCENT",
      10,
      1,
      100,
    );
    await client.query(
      `INSERT INTO reward_config (singleton, orders_per_coupon, discount_percent)
       VALUES (TRUE, $1, $2)
       ON CONFLICT (singleton) DO NOTHING`,
      [ordersPerCoupon, discountPercent],
    );
    await client.query(
      `INSERT INTO products (id, name, unit_price_cents, inventory) VALUES
        ('ceramic-travel-mug', 'Ceramic Travel Mug', 2400, 120),
        ('field-notebook', 'Field Notebook', 1400, 200),
        ('canvas-tote', 'Canvas Tote', 3200, 60),
        ('desk-lamp', 'Tactile Desk Lamp', 4999, 18),
        ('mechanical-keyboard', 'Mechanical Keyboard', 12900, 3)
       ON CONFLICT (id) DO NOTHING`,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
