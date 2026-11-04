(() => {
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const data = window.YIEN_DATA;

  /* ---------- The windows ---------- */
  new YienSim(document.querySelector("#hero-app"), data.hero, { driver: true });

  new YienSim(document.querySelector("#closing-app"), data.closing, { chrome: false, title: "install" });

  const splitsRoot = document.querySelector("#splits-app");
  const splits = new YienSim(splitsRoot, data.splits, { chrome: false, title: "search-rebuild" });
  const layoutButtons = [...document.querySelectorAll("[data-set-layout]")];
  const setLayout = (count) => {
    splits.setLayout(count);
    layoutButtons.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.setLayout) === count)));
  };
  let picked = false;
  layoutButtons.forEach((button) =>
    button.addEventListener("click", () => {
      picked = true;
      setLayout(Number(button.dataset.setLayout));
    }),
  );
  if (!REDUCED) {
    (async () => {
      const narrow = matchMedia("(max-width: 760px)").matches;
      const order = narrow ? [1, 2] : [1, 2, 3, 4];
      let i = order.length - 1;
      if (narrow) setLayout(2);
      for (;;) {
        await splits.clock.sleep(5200);
        if (picked) return;
        i = (i + 1) % order.length;
        setLayout(order[i]);
      }
    })();
  }

  /* ---------- Git: the same window, stopped where an agent needs you ---------- */
  const reviewRoot = document.querySelector("#review-app");
  const review = new YienSim(reviewRoot, data.hero.slice(0, 1), { side: false, still: true, view: "graph", title: "checkout-rewrite" });
  const gitButtons = [...document.querySelectorAll("[data-git]")];
  const showGit = (view) => {
    const ws = review.active;
    const waiting = ws.agents.find((agent) => agent.state === "asking");
    if (waiting) review.setBranch(ws, waiting.branch);
    review.setView(view);
    if (view === "graph") {
      const commit = ws.commits.find((c) => c.branch !== "main");
      if (commit) review.openCommit(ws, commit);
    } else if (view === "changes") {
      const file = waiting && [...waiting.changes.values()][0];
      if (file) review.openDiff(ws, file);
    } else if (view === "files") {
      review.openFile(ws, "src/cart/coupon.ts");
      document.activeElement.blur();
    } else {
      review.showSurface(ws, "terminals");
    }
    review.renderPanel(ws);
    gitButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.git === view)));
  };
  let gitPicked = false;
  gitButtons.forEach((button) =>
    button.addEventListener("click", () => {
      gitPicked = true;
      showGit(button.dataset.git);
    }),
  );
  reviewRoot.addEventListener("pointerdown", () => (gitPicked = true));
  // the still window settles on the next tick, once the script has run
  setTimeout(() => {
    showGit("graph");
    if (REDUCED) return;
    let seen = false;
    new IntersectionObserver(([entry]) => (seen = entry.isIntersecting)).observe(reviewRoot);
    const timer = setInterval(() => {
      if (gitPicked) return clearInterval(timer);
      if (!seen || document.hidden) return;
      const next = gitButtons[(gitButtons.findIndex((b) => b.getAttribute("aria-pressed") === "true") + 1) % gitButtons.length];
      showGit(next.dataset.git);
    }, 6000);
  }, 50);

  /* ---------- The three states, one tab at a time ---------- */
  const rows = [...document.querySelectorAll("[data-tab-demo] .big-tab")];
  const work = ["Refactoring", "Migrating tokens", "Rewriting the docs", "Running tests", "Writing notes"];
  let beat = 0;
  const showBeat = () => {
    rows.forEach((row, i) => {
      const age = (beat - i + rows.length) % rows.length;
      const state = age === 0 ? "asking" : age < 3 ? "working" : "done";
      row.dataset.state = state;
      row.querySelector(".big-glyph").textContent = state === "asking" ? "■" : state === "done" ? "✓" : "⠋";
      row.querySelector(".big-glyph").classList.toggle("spin", state === "working");
      row.querySelector(".big-sub").textContent =
        state === "asking" ? "Needs you" : state === "done" ? "Done" : work[i];
    });
  };
  showBeat();
  if (!REDUCED && rows.length) {
    let seen = false;
    new IntersectionObserver(([entry]) => (seen = entry.isIntersecting)).observe(rows[0].parentElement);
    setInterval(() => {
      if (!seen || document.hidden) return;
      beat = (beat + 1) % rows.length;
      showBeat();
    }, 3000);
  }

  /* ---------- The page's red thread ---------- */
  const main = document.querySelector("main");
  const thread = document.querySelector(".thread");
  const start = document.querySelector("#hero-app");
  const end = document.querySelector(".closing-hook");
  const place = () => {
    const base = main.getBoundingClientRect().top;
    const top = start.getBoundingClientRect().bottom - base;
    thread.style.top = `${top}px`;
    thread.style.height = `${end.getBoundingClientRect().top - base - top}px`;
  };
  new ResizeObserver(place).observe(main);
  place();

})();
