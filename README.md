# Checkout and Rewards Service

A TypeScript, Express, and PostgreSQL API for carts, inventory-safe checkout, orders, and milestone discount coupons. A successful checkout is treated as payment success; no real payment provider is called.

## Run it

Requirements: Node.js 24+, pnpm, and PostgreSQL.

```sh
export DATABASE_URL='postgres://user:password@host:5432/database'
export PORT=5000
# Optional, used when the reward settings row is first created:
export REWARD_ORDER_INTERVAL=5
export REWARD_DISCOUNT_PERCENT=10
pnpm install
pnpm --filter @workspace/api-server run dev
```

The service listens on the configured `PORT` (5000 when run outside the managed workflow). On startup it creates the commerce tables if absent and inserts five sample products. Existing product records and reward settings are not overwritten. The first database initialization stores the reward settings; later changes can be made through the administrative config endpoint.

For the supplied integration tests, use a disposable PostgreSQL database:

```sh
export TEST_DATABASE_URL='postgres://user:password@host:5432/test_database'
pnpm --filter @workspace/api-server test
```

Tests create a uniquely named schema, run the HTTP API against that schema, then drop it. The test database account needs permission to create and drop schemas. `pnpm --filter @workspace/api-server run typecheck` performs the TypeScript check.

## API

Base path: `/api`. Monetary values are integer cents serialized as decimal strings. Currency is USD. Errors use:

```json
{
  "error": {
    "code": "insufficient_inventory",
    "message": "There is not enough inventory to complete checkout.",
    "details": { "productId": "mechanical-keyboard", "available": 1, "requested": 2 }
  }
}
```

### Catalog and carts

| Method | Path | Request | Success | Important failures |
| --- | --- | --- | --- | --- |
| `GET` | `/products` | — | `200 { products: [...] }` | — |
| `POST` | `/carts` | — | `201 Cart` | — |
| `GET` | `/carts/{cartId}` | — | `200 Cart` | `400 invalid_id`, `404 cart_not_found` |
| `POST` | `/carts/{cartId}/items` | `{ "productId": "field-notebook", "quantity": 2 }` | `200 Cart`; adds to an existing line | `400 invalid_quantity`, `404 cart_not_found` / `product_not_found`, `409 insufficient_inventory` / `cart_checked_out` |
| `PUT` | `/carts/{cartId}/items/{productId}` | `{ "quantity": 3 }` | `200 Cart`; replaces line quantity | `400 invalid_quantity`, `404 cart_item_not_found`, `409 insufficient_inventory` / `cart_checked_out` |
| `DELETE` | `/carts/{cartId}/items/{productId}` | — | `200 Cart` | `404 cart_item_not_found`, `409 cart_checked_out` |

A cart response includes its line items, current unit prices, current inventory, and subtotal. Adding or changing a line checks current inventory but does not reserve it. Checkout checks inventory again while holding database row locks.

### Checkout and orders

| Method | Path | Request | Success | Important failures |
| --- | --- | --- | --- | --- |
| `POST` | `/carts/{cartId}/checkout` | Required `Idempotency-Key` header; optional `{ "couponCode": "REWARD-5-..." }` | `201 Order`; a retry returns `200 Order` with `Idempotent-Replay: true` | `400 idempotency_key_required`, `404 cart_not_found`, `409 empty_cart`, `insufficient_inventory`, `coupon_invalid`, `coupon_redeemed`, `idempotency_key_reused` |
| `GET` | `/orders/{orderId}` | — | `200 Order` | `400 invalid_id`, `404 order_not_found` |

The idempotency key is limited to 200 characters and is unique across orders. Reusing a key for the same cart returns its original order, regardless of the retry body. Reusing it for a different cart returns `409 idempotency_key_reused`. A checked-out cart always resolves to its original order and cannot create another one.

Orders preserve the purchased product ID and name, unit price in cents, quantity, line total, subtotal, discount, total, and any coupon/percentage used. Product price changes after adding an item are reflected in the cart view and at checkout; successful orders retain the checkout-time snapshot.

### Administration

These routes are administrative but intentionally have no authentication or authorization in this assignment.

| Method | Path | Request | Success | Behavior |
| --- | --- | --- | --- | --- |
| `GET` | `/admin/rewards/config` | — | `200 { "ordersPerCoupon": 5, "discountPercent": 10 }` | Reads the active reward settings. |
| `PUT` | `/admin/rewards/config` | `{ "ordersPerCoupon": 5, "discountPercent": 10 }` | `200 RewardConfig` | Sets settings for future coupon generation; already-created coupons keep their original percentage. |
| `POST` | `/admin/coupons/generate` | — | `200 { "coupon": Coupon or null, "eligibleOrderCount": 5 }` | Generates the lowest eligible unrewarded milestone coupon. Returns `coupon: null` when no milestone is eligible. |
| `GET` | `/admin/report` | — | `200 AdminReport` | Read-only totals from committed orders and coupons. |

The report includes purchased quantity by product, gross revenue before discounts, discounts, net revenue, order count, and generated/available/redeemed coupon counts. Every amount and count is returned as an exact decimal string. The report is computed by one SQL statement so its aggregates share a database snapshot.

The complete machine-readable contract is in `lib/api-spec/openapi.yaml`; generated API client and schema files can be refreshed with:

```sh
pnpm --filter @workspace/api-spec run codegen
```
