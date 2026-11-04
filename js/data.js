/* What the agents "do" in the simulated app. Every step type is rendered in sim.js:
   prompt, think, plan, tool, edit, progress, ask, commit, msg. */
window.YIEN_DATA = {
  hero: [
    {
      name: "checkout-rewrite",
      layout: 4,
      files: [
        "migrations/0041_orders.sql",
        "src/api/orders.ts",
        "src/cart/Cart.tsx",
        "src/cart/coupon.ts",
        "src/cart/totals.ts",
        "src/cart/useCart.ts",
        "tests/orders.test.ts",
        "package.json",
      ],
      commits: [{ hash: "e41b07a", msg: "Split the cart out of the page" }],
      agents: [
        {
          cli: "claude",
          task: "Move totals to the server",
          script: [
            { t: "prompt", text: "Move the cart totals to the server. The client shouldn't be doing tax math." },
            { t: "think", text: "Tax gets computed in two places on the client. I'll start from where totals are read." },
            { t: "plan", tasks: ["Find where totals are computed", "Add a totals endpoint", "Point the cart at it", "Run the checkout tests"] },
            { t: "tool", name: "Grep", arg: "calculateTotal", res: "7 matches in 4 files", ms: 312, done: 0 },
            { t: "tool", name: "Read", arg: "src/cart/totals.ts", res: "118 lines", ms: 96 },
            {
              t: "edit", file: "src/api/totals.ts", status: "A", add: 64, del: 0, done: 1,
              lines: ["+export async function getTotals(cart: Cart) {", "+  const tax = await taxFor(cart.address);", "+  return { subtotal, tax, total: subtotal + tax };"],
            },
            {
              t: "edit", file: "src/cart/useCart.ts", status: "M", add: 12, del: 38, done: 2,
              lines: ["-const total = calculateTotal(items, region);", "+const { total } = await fetchTotals(cart.id);"],
            },
            { t: "progress", name: "Bash", arg: "pnpm test checkout", total: 86, res: "86 passed", dur: 3400, done: 3 },
            { t: "commit", hash: "a3f91c2", msg: "Compute cart totals on the server" },
            { t: "msg", text: "Totals now come from /api/totals and the client only displays them. All 86 checkout tests pass." },
          ],
        },
        {
          cli: "codex",
          task: "Handle Stripe webhooks",
          delay: 900,
          script: [
            { t: "prompt", text: "Add the Stripe webhook handler and store every payment event." },
            { t: "think", text: "Events can arrive twice, so the table needs a unique event id." },
            { t: "plan", tasks: ["Add a payment_events table", "Write the handler", "Migrate staging", "Replay test events"] },
            { t: "tool", name: "Read", arg: "src/api/orders.ts", res: "204 lines", ms: 88 },
            {
              t: "edit", file: "migrations/0042_payment_events.sql", status: "A", add: 18, del: 0, done: 0,
              lines: ["+create table payment_events (", "+  stripe_id text primary key,", "+  type text not null,"],
            },
            {
              t: "edit", file: "src/api/webhooks/stripe.ts", status: "A", add: 71, del: 0, done: 1,
              lines: ["+const event = stripe.webhooks.constructEvent(body, sig, secret);", "+await savePaymentEvent(event);"],
            },
            {
              t: "ask", text: "Run this migration on the staging database?", cmd: "pnpm db:migrate --env staging",
              denied: "Understood. I'll leave staging alone and test on a local database.",
            },
            { t: "tool", name: "Bash", arg: "pnpm db:migrate --env staging", res: "1 table created", ms: 1840, done: 2 },
            { t: "progress", name: "Bash", arg: "stripe trigger --replay fixtures/", total: 24, res: "24 events stored", dur: 2800, done: 3 },
            { t: "commit", hash: "c80d5e1", msg: "Store Stripe payment events" },
            { t: "msg", text: "The handler is in, and replaying the same event twice stores it once." },
          ],
        },
        {
          cli: "agy",
          task: "Cover cart edge cases",
          delay: 1700,
          script: [
            { t: "prompt", text: "Write tests for the cart's edge cases: empty carts, coupons, rounding." },
            { t: "tool", name: "Read", arg: "src/cart/coupon.ts", res: "57 lines", ms: 74 },
            {
              t: "edit", file: "tests/cart.test.ts", status: "A", add: 92, del: 0,
              lines: ['+it("rounds a 15% coupon on 3 items", () => {', "+  expect(applyCoupon(cart, c15).total).toBe(25.49);"],
            },
            { t: "progress", name: "Bash", arg: "pnpm test cart", total: 31, res: "30 passed, 1 failed", dur: 2300 },
            { t: "think", text: "That failure is a real bug. The coupon rounds each item, then rounds again on the total." },
            {
              t: "edit", file: "src/cart/coupon.ts", status: "M", add: 3, del: 4,
              lines: ["-return round(items.map(discount).map(round).reduce(sum));", "+return round(items.map(discount).reduce(sum));"],
            },
            { t: "progress", name: "Bash", arg: "pnpm test cart", total: 31, res: "31 passed", dur: 2000 },
            { t: "commit", hash: "7be204d", msg: "Round coupon discounts once" },
            { t: "msg", text: "31 new tests, and they found one real bug: coupons were rounded twice. Fixed." },
          ],
        },
        {
          cli: "opencode",
          task: "Review the branch",
          delay: 5200,
          script: [
            { t: "prompt", text: "Review everything on this branch before it merges." },
            { t: "tool", name: "Bash", arg: "git diff main --stat", res: "9 files, +260 −42", ms: 140 },
            { t: "think", text: "The endpoint trusts the address on the cart. Worth checking who can set it." },
            { t: "tool", name: "Read", arg: "src/api/totals.ts", res: "64 lines", ms: 81 },
            { t: "tool", name: "Read", arg: "src/api/orders.ts", res: "204 lines", ms: 92 },
            { t: "tool", name: "Grep", arg: "cart.address", res: "3 matches", ms: 203 },
            { t: "think", text: "It's only set after sign-in. That part is fine." },
            { t: "tool", name: "Read", arg: "src/api/webhooks/stripe.ts", res: "71 lines", ms: 77 },
            { t: "msg", text: "Looks good to merge. One note: the webhook secret should come from the vault, not from .env." },
          ],
        },
      ],
    },
    {
      name: "auth-migration",
      layout: 2,
      delay: 800,
      files: ["src/auth/session.ts", "src/auth/token.ts", "src/middleware.ts", "migrations/0040_users.sql", "tests/auth.test.ts"],
      commits: [{ hash: "2d9ac44", msg: "Sign tokens with rotating keys" }],
      agents: [
        {
          cli: "claude",
          task: "Replace sessions with tokens",
          script: [
            { t: "prompt", text: "Finish moving auth from server sessions to signed tokens." },
            { t: "think", text: "Only the middleware still reads the session table." },
            { t: "plan", tasks: ["Update the middleware", "Run the auth tests", "Drop the old table"] },
            {
              t: "edit", file: "src/middleware.ts", status: "M", add: 9, del: 22, done: 0,
              lines: ["-const session = await db.sessions.find(cookie);", "+const claims = await verifyToken(cookie);"],
            },
            { t: "progress", name: "Bash", arg: "pnpm test auth", total: 58, res: "58 passed", dur: 3600, done: 1 },
            { t: "think", text: "Nothing reads the sessions table anymore, but dropping it can't be undone." },
            {
              t: "ask", text: "Drop the sessions table in staging?", cmd: "drop table sessions;",
              denied: "Leaving the table in place. I'll note it in the pull request.",
            },
            { t: "tool", name: "Bash", arg: "pnpm db:migrate --env staging", res: "1 table dropped", ms: 620, done: 2 },
            { t: "commit", hash: "91fe3b0", msg: "Remove server sessions" },
            { t: "msg", text: "Auth runs on signed tokens only. The old table is gone from staging." },
          ],
        },
        {
          cli: "aider",
          task: "Update session callers",
          delay: 1400,
          script: [
            { t: "prompt", text: "Update everything that still imports getSession." },
            { t: "tool", name: "Grep", arg: "getSession", res: "14 matches in 9 files", ms: 188 },
            {
              t: "edit", file: "src/auth/session.ts", status: "M", add: 2, del: 41,
              lines: ["-export async function getSession(req) {", "+export { getClaims as getUser } from './token';"],
            },
            { t: "progress", name: "Edit", arg: "9 files", total: 14, res: "14 call sites updated", dur: 3000 },
            { t: "tool", name: "Bash", arg: "pnpm typecheck", res: "no errors", ms: 4210 },
            { t: "commit", hash: "5c07e92", msg: "Stop importing getSession" },
            { t: "msg", text: "All 14 call sites use the new helper, and the types check." },
          ],
        },
      ],
    },
    {
      name: "docs-quickstart",
      layout: 2,
      delay: 400,
      hold: 16000,
      files: ["docs/index.md", "docs/quickstart.md", "docs/install.md"],
      commits: [],
      agents: [
        {
          cli: "claude",
          task: "Rewrite the quickstart",
          script: [
            { t: "prompt", text: "The quickstart takes 14 steps. Get it under five and test it from a clean machine." },
            { t: "tool", name: "Read", arg: "docs/quickstart.md", res: "210 lines", ms: 64 },
            { t: "think", text: "Most of these steps are one install script that never got written." },
            {
              t: "edit", file: "docs/quickstart.md", status: "M", add: 31, del: 142,
              lines: ["-## Step 7: Copy the config by hand", "+## Start it", "+    npx acme init && npx acme dev"],
            },
            { t: "tool", name: "Bash", arg: "docker run --rm node:22 ./try-quickstart.sh", res: "works in 42 s", ms: 42310 },
            { t: "commit", hash: "04ab7d6", msg: "Shorten the quickstart to four steps" },
            { t: "msg", text: "Down to four steps, and it runs from a clean container in 42 seconds." },
          ],
        },
        {
          shell: true,
          keep: true,
          task: "docs server",
          delay: 600,
          run: "pnpm docs:dev",
          out: ["> docs@2.4.0 dev", "ready in 612 ms", "Local: http://localhost:4321/", "hmr update /quickstart.md"],
        },
      ],
    },
    {
      name: "flaky-tests",
      layout: 2,
      delay: 1500,
      files: ["tests/e2e/login.spec.ts", "tests/e2e/search.spec.ts", "tests/setup.ts", "playwright.config.ts"],
      commits: [],
      agents: [
        {
          cli: "codex",
          task: "Find the flaky login test",
          script: [
            { t: "prompt", text: "The login test fails about one run in ten. Find out why." },
            { t: "progress", name: "Bash", arg: "pnpm e2e login --repeat 50", total: 50, res: "46 passed, 4 failed", dur: 4200 },
            { t: "think", text: "All four failures happen before the session cookie lands. The test doesn't wait for it." },
            {
              t: "edit", file: "tests/e2e/login.spec.ts", status: "M", add: 2, del: 1,
              lines: ['-await page.goto("/account");', '+await page.waitForResponse("**/api/login");', '+await page.goto("/account");'],
            },
            { t: "progress", name: "Bash", arg: "pnpm e2e login --repeat 50", total: 50, res: "50 passed", dur: 4200 },
            { t: "commit", hash: "b17c3f8", msg: "Wait for the login response in e2e" },
            { t: "msg", text: "It was a race with the cookie. 50 runs in a row now pass." },
          ],
        },
        {
          cli: "agy",
          task: "Speed up the suite",
          delay: 2000,
          script: [
            { t: "prompt", text: "The e2e suite takes 11 minutes. What's slow?" },
            { t: "tool", name: "Bash", arg: "pnpm e2e --reporter json", res: "11 m 08 s", ms: 3100 },
            { t: "think", text: "Every spec seeds the database from scratch. One shared seed would do." },
            {
              t: "edit", file: "tests/setup.ts", status: "M", add: 14, del: 6,
              lines: ["-beforeEach(seedDatabase);", "+beforeAll(seedDatabase);", "+afterEach(rollback);"],
            },
            { t: "progress", name: "Bash", arg: "pnpm e2e", total: 120, res: "120 passed in 3 m 40 s", dur: 3800 },
            { t: "msg", text: "From 11 minutes down to under 4, with every spec still isolated." },
          ],
        },
      ],
    },
    {
      name: "release-notes",
      layout: 1,
      hold: 40000,
      files: ["CHANGELOG.md", "package.json"],
      commits: [],
      agents: [
        {
          cli: "opencode",
          task: "Draft the 2.4 notes",
          script: [
            { t: "prompt", text: "Draft the 2.4 release notes from the merged pull requests." },
            { t: "tool", name: "Bash", arg: "gh pr list --state merged --limit 40", res: "27 pull requests", ms: 910 },
            {
              t: "edit", file: "CHANGELOG.md", status: "M", add: 24, del: 0,
              lines: ["+## 2.4", "+- Totals are computed on the server", "+- Coupons no longer round twice"],
            },
            { t: "msg", text: "Draft ready in CHANGELOG.md, grouped by what people will notice." },
          ],
        },
      ],
    },
  ],

  closing: [
    {
      name: "install",
      layout: 1,
      hold: 12000,
      files: [],
      commits: [],
      agents: [
        {
          cli: "claude",
          task: "Install YIEN",
          script: [
            { t: "prompt", text: "Install YIEN on this machine." },
            { t: "tool", name: "Bash", arg: "npm install -g yien", res: "404 not found", ms: 1240 },
            { t: "tool", name: "Bash", arg: "brew install yien", res: "no such formula", ms: 860 },
            { t: "think", text: "Nobody publishes it, and there is no repo either." },
            { t: "msg", text: "I can't install it. YIEN is a concept, so there's no app yet. Everything you saw up there was a simulation." },
          ],
        },
      ],
    },
  ],

  splits: [
    {
      name: "search-rebuild",
      layout: 4,
      hold: 5000,
      files: [],
      commits: [],
      agents: [
        {
          cli: "claude",
          task: "Build the search index",
          script: [
            { t: "prompt", text: "Rebuild the search index so it updates as products change." },
            { t: "think", text: "A nightly job can't keep up. I'll listen to product events instead." },
            { t: "plan", tasks: ["Subscribe to product events", "Update the index on each one", "Backfill what exists"] },
            { t: "tool", name: "Read", arg: "src/search/index.ts", res: "143 lines", ms: 82, done: 0 },
            {
              t: "edit", file: "src/search/indexer.ts", status: "A", add: 88, del: 0, done: 1,
              lines: ['+bus.on("product.updated", async (p) => {', "+  await index.upsert(toDocument(p));", "+});"],
            },
            { t: "progress", name: "Bash", arg: "pnpm search:backfill", total: 4200, res: "4,200 products indexed", dur: 3600, done: 2 },
            { t: "msg", text: "Changes reach search within a second, and the backfill is done." },
          ],
        },
        {
          cli: "codex",
          task: "Ranking",
          delay: 800,
          script: [
            { t: "prompt", text: "Rank exact title matches above everything else." },
            { t: "tool", name: "Read", arg: "src/search/rank.ts", res: "61 lines", ms: 70 },
            {
              t: "edit", file: "src/search/rank.ts", status: "M", add: 6, del: 2,
              lines: ["-return bm25(doc, query);", "+return exactTitle(doc, query) ? Infinity : bm25(doc, query);"],
            },
            { t: "progress", name: "Bash", arg: "pnpm test rank", total: 40, res: "40 passed", dur: 2200 },
            { t: "msg", text: "Exact titles come first now. Everything else ranks as before." },
          ],
        },
        {
          cli: "agy",
          task: "Search page",
          delay: 1500,
          script: [
            { t: "prompt", text: "Show results as you type, and keep the old ones until new ones arrive." },
            { t: "tool", name: "Read", arg: "src/pages/Search.tsx", res: "96 lines", ms: 66 },
            {
              t: "edit", file: "src/pages/Search.tsx", status: "M", add: 19, del: 11,
              lines: ["-const results = useSearch(query);", "+const results = useDeferredValue(useSearch(query));"],
            },
            { t: "tool", name: "Bash", arg: "pnpm typecheck", res: "no errors", ms: 2980 },
            { t: "msg", text: "Results update as you type, without flashing empty." },
          ],
        },
        {
          cli: "aider",
          task: "Load test",
          delay: 2600,
          script: [
            { t: "prompt", text: "Load test the new endpoint at 500 requests a second." },
            { t: "progress", name: "Bash", arg: "k6 run search.js", total: 500, res: "p95 at 41 ms", dur: 4600 },
            { t: "msg", text: "It holds at 500 requests a second, with 95% under 41 ms." },
          ],
        },
      ],
    },
  ],
};
