export const fileContents: Record<string, string> = {
  "src/cart/coupon.ts": `export function applyCoupon(cart, coupon) {
  const items = cart.items.filter(eligible);
  const rounded = items.map(discount).map(round);
  const off = round(rounded.reduce(sum, 0));
  if (off > cart.subtotal) return cart;
  return { ...cart, off };
}

export function removeCoupon(cart) {
  const { off, ...rest } = cart;
  return rest;
}
`,
  "src/cart/totals.ts": `import { taxRate } from "./tax";

export function calculateTotal(items, region) {
  const subtotal = items.reduce((n, item) => n + item.price * item.qty, 0);
  const tax = subtotal * taxRate(region);
  return subtotal + tax;
}
`,
  "src/cart/useCart.ts": `import { useState } from "react";
import { calculateTotal } from "./totals";

export function useCart(region) {
  const [items, setItems] = useState([]);
  const total = calculateTotal(items, region);
  return { items, setItems, total };
}
`,
  "src/cart/Cart.tsx": `import { useCart } from "./useCart";

export function Cart({ region }) {
  const { items, total } = useCart(region);
  return (
    <section>
      {items.map((item) => <CartRow key={item.id} item={item} />)}
      <p>Total: {format(total)}</p>
    </section>
  );
}
`,
  "src/api/orders.ts": `export async function createOrder(req) {
  const cart = await carts.find(req.body.cartId);
  const order = await orders.insert({ cart, status: "open" });
  return json(order, 201);
}
`,
  "migrations/0041_orders.sql": `create table orders (
  id uuid primary key,
  cart_id uuid not null,
  status text not null
);
`,
  "tests/orders.test.ts": `it("creates an open order", async () => {
  const order = await createOrder(request({ cartId }));
  expect(order.status).toBe("open");
});
`,
  "package.json": `{
  "name": "shop",
  "version": "2.4.0",
  "scripts": {
    "dev": "vite",
    "test": "vitest run"
  }
}
`,
  "src/api/totals.ts": `import { taxFor } from "../tax";

export async function getTotals(cart: Cart) {
  const subtotal = cart.items.reduce((n, item) => n + item.price * item.qty, 0);
  const tax = await taxFor(cart.address);
  return { subtotal, tax, total: subtotal + tax };
}
`,
  "src/api/webhooks/stripe.ts": `import { stripe } from "../../stripe";
import { savePaymentEvent } from "../../payments";

const secret = process.env.STRIPE_WEBHOOK_SECRET;

export async function handleStripe(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const event = stripe.webhooks.constructEvent(body, sig, secret);

  // Stripe can send the same event twice, and the unique id absorbs it.
  await savePaymentEvent(event);
  return new Response(null, { status: 204 });
}
`,
  "migrations/0042_payment_events.sql": `create table payment_events (
  id text primary key,
  order_id uuid not null references orders (id),
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index payment_events_order on payment_events (order_id);
`,
  "tests/cart.test.ts": `import { applyCoupon } from "../src/cart/coupon";

const cart = (...prices: number[]) => ({
  items: prices.map((price) => ({ price, qty: 1 })),
  subtotal: prices.reduce((a, b) => a + b, 0),
});

it("rounds a 15% coupon on 3 items", () => {
  const c15 = { percent: 15 };
  expect(applyCoupon(cart(9.99, 19.99, 29.99), c15).off).toBe(9);
});

it("never takes off more than the subtotal", () => {
  const all = { percent: 150 };
  expect(applyCoupon(cart(10), all).off).toBeUndefined();
});
`,
  "src/auth/session.ts": `// Sessions are gone. This keeps the old import path working.
export { getClaims as getUser } from "./token";
`,
  "src/auth/token.ts": `import { jwtVerify, SignJWT } from "jose";
import { currentKey, keyById } from "./keys";

const LIFETIME = "15m";

export async function signToken(userId: string) {
  const key = await currentKey();
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "EdDSA", kid: key.id })
    .setExpirationTime(LIFETIME)
    .sign(key.secret);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, ({ kid }) => keyById(kid));
  return payload;
}

export async function getClaims(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return token ? verifyToken(token) : null;
}
`,
  "src/middleware.ts": `import { verifyToken } from "./auth/token";

const PUBLIC = ["/login", "/signup", "/health"];

export async function middleware(req: Request, next: Next) {
  const { pathname } = new URL(req.url);
  if (PUBLIC.includes(pathname)) return next(req);

  const cookie = readCookie(req, "token");
  if (!cookie) return redirect("/login");

  const claims = await verifyToken(cookie);
  return next(withUser(req, claims.sub));
}
`,
  "migrations/0040_users.sql": `create table users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
`,
  "tests/auth.test.ts": `import { signToken, verifyToken } from "../src/auth/token";

it("reads back the user it signed", async () => {
  const token = await signToken("user_42");
  const claims = await verifyToken(token);
  expect(claims.sub).toBe("user_42");
});

it("rejects a token that was changed", async () => {
  const token = await signToken("user_42");
  await expect(verifyToken(token + "x")).rejects.toThrow();
});
`,
  "docs/index.md": `# Acme docs

Acme gives your app accounts, billing and email in one package.

- [Quickstart](quickstart.md): running in four steps
- [Install](install.md): requirements and package managers
`,
  "docs/quickstart.md": `# Quickstart

You need Node 22 or newer.

## Create a project

    npx acme new shop
    cd shop

## Start it

    npx acme init && npx acme dev

## Add your first user

Open \`http://localhost:3000\` and sign up.

## Deploy

Run \`npx acme deploy\` when you're ready.
`,
  "docs/install.md": `# Install

Acme runs on Node 22 or newer.

## With a package manager

    pnpm add acme

## Check it

Run \`npx acme doctor\` to see what's missing.
`,
  "tests/e2e/login.spec.ts": `import { expect, test } from "@playwright/test";

test("signs in and reaches the account page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("correct horse");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForResponse("**/api/login");
  await page.goto("/account");
  await expect(page.getByRole("heading")).toHaveText("Your account");
});
`,
  "tests/e2e/search.spec.ts": `import { expect, test } from "@playwright/test";

test("finds a product by its name", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("trainers");
  await expect(page.getByRole("listitem").first()).toContainText("Trainers");
});
`,
  "tests/setup.ts": `import { afterEach, beforeAll } from "vitest";
import { db, seedDatabase } from "./db";

// One seed for the whole run. Each spec rolls back what it wrote.
beforeAll(seedDatabase);

beforeEach(() => db.begin());
afterEach(rollback);

function rollback() {
  return db.rollback();
}
`,
  "playwright.config.ts": `import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: 0,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  webServer: { command: "pnpm dev", port: 3000, reuseExistingServer: true },
});
`,
  "CHANGELOG.md": `# Changelog

## 2.4

- Totals are computed on the server
- Payments arrive through Stripe webhooks
- Sign-in uses signed tokens instead of sessions

## 2.3

- Coupons round once, on the total
- The cart moved out of the page
`,
};
