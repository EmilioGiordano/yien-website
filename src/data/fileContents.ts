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
};
}
`,
};
