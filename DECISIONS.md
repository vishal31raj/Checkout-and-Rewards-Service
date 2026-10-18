# Design decisions

## Invariants

- A cart has at most one order, and an idempotency key identifies at most one order.
- An order, its item snapshots, inventory decrements, cart closure, and coupon redemption commit or roll back together.
- Inventory cannot become negative; checkout validates and locks each product row before decrementing it.
- A coupon has one immutable milestone and discount percentage, and can be redeemed by at most one order.
- Reports are derived from committed orders and coupons and do not change state.
- Money is represented as integer cents in PostgreSQL and as decimal strings over JSON, never as floating-point currency.

## Decision: Use the latest price at checkout

**Context:** The requirements do not say whether a cart locks its item price.

**Options considered:** Preserve the price when added; or keep the cart as a quantity selection and apply current catalog pricing at checkout.

**Choice:** Cart views show current prices, and checkout uses the current unit price under the product row lock.

**Why:** No price-hold duration or reservation model was requested. This avoids honoring stale prices and makes the price at purchase unambiguous.

**Consequences:** A cart subtotal can change between reads. The order stores checkout-time names, unit prices, quantities, and line totals, so later catalog changes do not rewrite order history.

## Decision: Use a required idempotency key and a unique cart/order relationship

**Context:** Clients may retry after a timeout, and a cart must not create multiple orders.

**Options considered:** Only deduplicate by cart; only deduplicate by request key; or enforce both.

**Choice:** Require a bounded `Idempotency-Key`, add a unique database constraint for it, and make `orders.cart_id` unique. Replays for the same key and cart return the original order; using the key for another cart is a `409`.

**Why:** The request key handles transport retries while the cart constraint protects the business invariant even when a client accidentally changes keys.

**Consequences:** Idempotency records are retained with orders. A replay returns the original result even if the retry body differs.

## Decision: Serialize checkout with PostgreSQL row locks

**Context:** Multiple carts can compete for the same remaining stock or coupon.

**Options considered:** Optimistic stock updates only; serializable transactions with automatic retry; or row locks plus guarded updates inside a transaction.

**Choice:** Lock the cart, then product rows in stable ID order, then the optional coupon row. Recheck inventory and coupon status while locked, and commit all order effects in one transaction. Inventory updates also include `inventory >= requested`.

**Why:** `READ COMMITTED` plus row locks is straightforward to explain and test for this workload. The guarded update provides a second check against overselling.

**Consequences:** Competing checkouts may wait for a row lock, then one receives a useful `409` if stock or coupon availability has changed. Production with higher contention should add lock-timeout and retry policies, metrics, and load tests before changing isolation.

## Decision: Use exact integer cents and round discounts down

**Context:** Floating-point currency calculations can produce inconsistent totals.

**Options considered:** Decimal library arithmetic; database numeric decimals; or integer minor units.

**Choice:** Store cent amounts as PostgreSQL `BIGINT`, compute with JavaScript `BigInt`, and serialize exact cent values as decimal strings. The discount is `floor(subtotalCents * percent / 100)`.

**Why:** The configured discount is an integer percentage, so the calculation is deterministic without introducing a rounding library. The total is `subtotal - discount`, and the percentage is constrained to 1–100, so totals cannot be negative.

**Consequences:** API consumers must parse the string representation as an integer, not a decimal dollar amount. Taxes, shipping, and fractional percentages are outside this assignment.

## Decision: Make coupon issuance explicit and redemption atomic

**Context:** A reward becomes eligible at every configured order milestone, but generation is an administrator action.

**Options considered:** Generate coupons automatically during checkout; issue all missing coupons at once; or issue one eligible milestone per admin request.

**Choice:** Admin generation locks the reward configuration and creates the lowest eligible milestone that has no coupon. The milestone has a unique constraint. Coupon percentage is snapshotted when issued. Checkout locks and marks a coupon redeemed in the same transaction as the order.

**Why:** This preserves the requested admin operation, makes delayed generation predictable, and prevents concurrent admin requests from duplicating a milestone or concurrent checkouts from double-spending a coupon.

**Consequences:** If generation was delayed, repeated admin calls catch up one milestone at a time. Changing the reward settings affects future issuance; already-issued coupon terms remain unchanged.

## Decision: Treat checkout commit as payment success

**Context:** The assignment says no real payment integration is required.

**Options considered:** Add a fake payment module; or make the successful order transaction the payment-success boundary.

**Choice:** No payment API or fake provider is included. A committed checkout represents successful payment for this exercise.

**Why:** This keeps payment and inventory outcomes atomic without implying a real external charge can participate in a PostgreSQL transaction.

**Consequences:** A production payment flow would need a payment intent/state machine, idempotent provider calls, and a saga/outbox or compensating inventory workflow.

## Decision: Initialize the sample schema and seed data idempotently

**Context:** Evaluators need a repeatable setup without a private migration service.

**Options considered:** Require a separate migration command; or let startup create missing tables and seed only absent catalog/config rows.

**Choice:** Startup runs `CREATE TABLE IF NOT EXISTS` and inserts sample products and reward defaults with `ON CONFLICT DO NOTHING`.

**Why:** The take-home asks for repeatable setup and requires no private credentials. Existing catalog and reward configuration are not overwritten on restart.

**Consequences:** This is not a production migration strategy. A production service should use versioned migrations, review destructive changes, and run migrations with a separate deployment role.

## Decision: Return stable error codes and compute reporting from committed rows

**Context:** API clients need to distinguish invalid input from business conflicts, and report requests must reconcile without mutating state.

**Options considered:** Generic HTTP error messages; or a shared structured error shape with stable codes and optional details.

**Choice:** Errors return `{ error: { code, message, details? } }`; input problems use `400`, missing resources use `404`, and state/concurrency conflicts use `409`. The report is a single read-only SQL statement over orders, order items, and coupons.

**Why:** Stable codes are actionable for clients, while a single statement gives each report a consistent PostgreSQL snapshot.

**Consequences:** The service intentionally does not expose raw database errors. Operational logs retain unexpected errors for diagnosis.

## Implemented and deferred

Implemented: product seeding, cart lifecycle, current-price display, stock checks at edit and checkout, immutable order snapshots, transactional checkout, idempotency, admin reward config/generation, one-use coupons, reconciliation reporting, structured errors, OpenAPI, and PostgreSQL integration tests for retries, competing inventory, coupon failure, and competing redemption.

Deferred: authentication and admin authorization (explicitly out of scope), real payment processing, taxes and shipping, expiration/cleanup of abandoned carts and idempotency records, product management endpoints, customer ownership, rate limits, audit logs, observability metrics, schema versioning, and multi-currency behavior.

## Scaling beyond one service instance

All business state and serialization live in PostgreSQL, not process memory, so multiple API instances share the same inventory, idempotency, and coupon guarantees. At production scale I would first add versioned migrations, connection-pool sizing, lock and transaction timing metrics, request tracing, and load tests that include hot products and coupons. If contention became high, I would evaluate inventory reservation/queueing and carefully designed retry behavior; I would not replace database constraints with in-memory locks.

## AI-tool use

AI assistance was used to reason about the service shape, draft implementation, documentation, and tests. One initial direction—treating a unique idempotency key as sufficient protection—was rejected because stock could be changed before a duplicate-key failure unless all effects were transactional. The implementation instead locks the cart/products/coupon and rolls back the full checkout on failure. The price behavior was also made explicit rather than allowing an unspecified cart-price assumption to emerge silently.

## If given two more hours

I would add property-based tests for totals and report reconciliation, stress the checkout paths with larger concurrent request sets, add startup/migration versioning and structured request metrics, and verify failure recovery around process termination during a transaction.
