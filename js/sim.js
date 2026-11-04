/* The simulated YIEN window: scripted agents running side by side, for this page only. */
(() => {
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
  const TICK = 40;

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  /* Time only passes while a window is on screen, so no agent finishes unseen. */
  class Clock {
    constructor() {
      this.now = 0;
      this.sleepers = [];
      this.awake = false;
    }
    sleep(ms) {
      if (REDUCED) return Promise.resolve();
      return new Promise((resolve) => this.sleepers.push({ at: this.now + ms, resolve }));
    }
    tick() {
      if (!this.awake) return;
      this.now += TICK;
      this.sleepers = this.sleepers.filter((s) => {
        if (s.at > this.now) return true;
        s.resolve();
        return false;
      });
    }
  }

  const clocks = new Set();
  let frame = 0;
  if (!REDUCED) {
    setInterval(() => {
      if (document.hidden) return;
      clocks.forEach((clock) => clock.tick());
      frame++;
      if (frame % 2) return;
      const glyph = SPINNER[(frame / 2) % SPINNER.length];
      document.querySelectorAll(".spin").forEach((node) => (node.textContent = glyph));
    }, TICK);
  }

  const glyphOf = (state) => (state === "done" ? "✓" : state === "asking" ? "■" : SPINNER[0]);

  class Agent {
    constructor(sim, ws, spec) {
      this.sim = sim;
      this.ws = ws;
      this.spec = spec;
      this.state = "working";
      this.run = 0;
      this.pane = el("section", "pane");
      const head = el("header", "pane-head");
      this.glyph = el("span", "pane-glyph spin", SPINNER[0]);
      this.meta = el("span", "pane-meta");
      head.append(this.glyph, el("b", "pane-cli", spec.cli), el("span", "pane-task", spec.task), this.meta);
      this.log = el("div", "pane-log");
      this.pane.append(head, this.log);
    }

    add(node) {
      this.log.append(node);
      this.follow();
      return node;
    }
    follow() {
      this.log.scrollTop = this.log.scrollHeight;
    }
    setState(state) {
      this.state = state;
      this.pane.classList.toggle("is-asking", state === "asking");
      this.glyph.className = "pane-glyph" + (state === "working" ? " spin" : "");
      this.glyph.textContent = glyphOf(state);
      this.sim.refresh();
    }
    renderMeta() {
      const min = Math.floor(this.secs / 60);
      const sec = String(this.secs % 60).padStart(2, "0");
      this.meta.textContent = `${min}:${sec}  ${(this.tokens / 1000).toFixed(1)}k`;
    }
    async ticker(run) {
      if (REDUCED) return;
      while (this.run === run && this.state !== "done") {
        await this.sim.clock.sleep(1000);
        if (this.run !== run || this.state === "done") return;
        if (this.state === "working") {
          this.secs += 2;
          this.tokens += 90 + Math.floor(Math.random() * 420);
          this.renderMeta();
        }
      }
    }

    async start() {
      const run = ++this.run;
      this.log.replaceChildren();
      this.planItems = null;
      this.skip = 0;
      this.secs = 0;
      this.tokens = 800;
      this.renderMeta();
      this.setState("working");
      this.ticker(run);
      await this.sim.clock.sleep(this.spec.delay || 0);
      for (const step of this.spec.script) {
        if (this.skip) {
          this.skip--;
          continue;
        }
        await this[step.t](step);
        if (step.done != null && this.planItems) this.planItems[step.done].classList.add("is-done");
        if (REDUCED) {
          this.secs += 14;
          this.tokens += 1300;
        }
      }
      this.renderMeta();
      this.setState("done");
    }

    async stream(node, text, min, spread) {
      if (REDUCED) {
        node.textContent = text;
        this.follow();
        return;
      }
      for (let i = 0; i < text.length; i += min + Math.floor(Math.random() * spread)) {
        node.textContent = text.slice(0, i);
        this.follow();
        await this.sim.clock.sleep(TICK);
      }
      node.textContent = text;
      this.follow();
    }

    async prompt(step) {
      const line = el("p", "l-prompt");
      const text = el("span");
      line.append(el("span", "l-caret", "›"), text);
      this.add(line);
      await this.stream(text, step.text, 1, 3);
      await this.sim.clock.sleep(450);
    }
    async think(step) {
      this.add(el("p", "l-think", step.text));
      await this.sim.clock.sleep(1100);
    }
    async plan(step) {
      const list = el("ul", "l-plan");
      this.planItems = step.tasks.map((task) => list.appendChild(el("li", null, task)));
      this.add(list);
      await this.sim.clock.sleep(650);
    }
    toolLine(name, arg) {
      const line = el("p", "l-tool");
      const glyph = el("span", "l-glyph spin", SPINNER[0]);
      const res = el("span", "l-res");
      const ms = el("span", "l-ms");
      line.append(glyph, el("b", null, name), el("span", "l-arg", arg), res, ms);
      this.add(line);
      return { line, glyph, res, ms };
    }
    finish(tool, res, ms) {
      tool.glyph.className = "l-glyph";
      tool.glyph.textContent = "✓";
      tool.res.textContent = res;
      tool.ms.textContent = ms;
      this.follow();
    }
    async tool(step) {
      const tool = this.toolLine(step.name, step.arg);
      await this.sim.clock.sleep(450 + Math.min(step.ms, 1400) * 0.6 + Math.random() * 300);
      const ms = step.ms >= 1000 ? `${(step.ms / 1000).toFixed(1)}s` : `${step.ms}ms`;
      this.finish(tool, step.res, ms);
      await this.sim.clock.sleep(220);
    }
    async edit(step) {
      const tool = this.toolLine(step.status === "A" ? "Write" : "Edit", step.file);
      await this.sim.clock.sleep(700 + Math.random() * 400);
      this.finish(tool, `+${step.add} −${step.del}`, "");
      const diff = el("pre", "l-diff");
      for (const text of step.lines) diff.append(el("span", text[0] === "+" ? "is-add" : "is-del", text));
      this.add(diff);
      this.ws.changes.set(step.file, { status: step.status, add: step.add, del: step.del });
      this.ws.fresh = step.file;
      this.sim.renderPanel(this.ws);
      await this.sim.clock.sleep(650);
    }
    async progress(step) {
      const tool = this.toolLine(step.name, step.arg);
      const bar = el("span", "l-bar");
      const fill = el("i");
      bar.append(fill);
      tool.line.classList.add("has-bar");
      tool.line.append(bar);
      this.follow();
      const steps = 30;
      for (let n = 1; n <= steps && !REDUCED; n++) {
        await this.sim.clock.sleep(step.dur / steps);
        fill.style.width = `${(n / steps) * 100}%`;
        tool.res.textContent = `${Math.round((step.total * n) / steps).toLocaleString("en-US")}/${step.total.toLocaleString("en-US")}`;
      }
      fill.style.width = "100%";
      this.finish(tool, step.res, `${(step.dur / 1000 + 1.2).toFixed(1)}s`);
      await this.sim.clock.sleep(260);
    }
    async commit(step) {
      const tool = this.toolLine("Bash", "git commit");
      await this.sim.clock.sleep(500);
      this.finish(tool, step.hash, "");
      this.ws.commits.unshift({ hash: step.hash, msg: step.msg });
      this.sim.renderPanel(this.ws);
      await this.sim.clock.sleep(320);
    }
    async msg(step) {
      await this.stream(this.add(el("p", "l-msg")), step.text, 3, 4);
    }
    async ask(step) {
      const box = el("div", "l-ask");
      const allow = el("button", "ask-yes", "Allow");
      const deny = el("button", "ask-no", "Deny");
      allow.type = deny.type = "button";
      const buttons = el("span", "l-ask-actions");
      buttons.append(allow, deny);
      box.append(el("p", null, step.text), el("code", null, step.cmd), buttons);
      this.add(box);
      this.setState("asking");
      const answer = await new Promise((resolve) => {
        this.answer = resolve;
        allow.addEventListener("click", () => resolve("allow"));
        deny.addEventListener("click", () => resolve("deny"));
        this.sim.driveAsk(this);
      });
      this.answer = null;
      buttons.replaceWith(el("span", "l-ask-said", answer === "allow" ? "Allowed by you" : "Denied by you"));
      box.classList.add("is-answered");
      this.setState("working");
      this.follow();
      if (answer === "deny") {
        this.add(el("p", "l-msg", step.denied));
        this.skip = 1;
      }
      await this.sim.clock.sleep(350);
    }
  }

  class Sim {
    /* options.chrome: draw the title bar, tabs and right panel. options.driver: act out
       the demo (open a tab that needs you, allow it) until someone clicks. */
    constructor(root, workspaces, options = {}) {
      this.root = root;
      this.chrome = options.chrome !== false;
      this.driver = options.driver && !REDUCED;
      this.clock = new Clock();
      this.view = "files";
      this.touched = false;
      this.queue = Promise.resolve();
      clocks.add(this.clock);

      this.stage = el("div", "stage");
      this.workspaces = workspaces.map((spec) => {
        const ws = { spec, files: spec.files, base: spec.commits, changes: new Map(), commits: [...spec.commits], fresh: null };
        ws.panes = el("div", "panes");
        ws.panes.dataset.layout = spec.layout;
        ws.panes.hidden = true;
        ws.agents = spec.agents.map((agent) => new Agent(this, ws, agent));
        ws.agents.forEach((agent) => ws.panes.append(agent.pane));
        this.stage.append(ws.panes);
        return ws;
      });
      this.home = this.workspaces[0];

      if (this.chrome) this.buildChrome();
      else root.append(this.stage);

      root.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button")) this.touched = true;
      });
      new IntersectionObserver(([entry]) => (this.clock.awake = entry.isIntersecting)).observe(root);

      this.switchTo(this.home);
      this.workspaces.forEach((ws) => this.runWorkspace(ws));
      if (this.driver) this.flipPanel();
    }

    buildChrome() {
      const bar = el("div", "app-bar");
      const lights = el("span", "app-lights");
      lights.append(el("i"), el("i"), el("i"));
      this.title = el("span", "app-title");
      this.count = el("span", "app-count");
      bar.append(lights, this.title, this.count);

      const side = el("div", "side");
      side.append(el("p", "side-label", "Tabs"));
      const list = el("div", "side-tabs");
      for (const ws of this.workspaces) {
        ws.row = el("button", "tab-row");
        ws.row.type = "button";
        ws.glyph = el("span", "tab-glyph");
        ws.sub = el("span", "tab-sub");
        ws.row.append(ws.glyph, el("span", "tab-name", ws.spec.name), ws.sub);
        ws.row.addEventListener("click", () => this.switchTo(ws));
        list.append(ws.row);
      }
      const add = el("p", "side-new");
      add.append(el("span", null, "New tab"), el("kbd", null, "Ctrl T"));
      side.append(list, add);

      const panel = el("div", "panel");
      const toggle = el("div", "panel-toggle");
      this.viewButtons = ["files", "git"].map((view) => {
        const button = el("button", null, view === "files" ? "Files" : "Git");
        button.type = "button";
        button.dataset.view = view;
        button.addEventListener("click", () => this.setView(view));
        toggle.append(button);
        return button;
      });
      this.panelBody = el("div", "panel-body");
      panel.append(toggle, this.panelBody);

      const body = el("div", "app-body");
      body.append(side, this.stage, panel);
      this.thread = el("span", "app-thread");
      this.root.append(bar, body, this.thread);
    }

    async runWorkspace(ws) {
      await this.clock.sleep(ws.spec.delay || 0);
      for (;;) {
        ws.changes.clear();
        ws.commits = [...ws.base];
        ws.fresh = null;
        this.renderPanel(ws);
        await Promise.all(ws.agents.map((agent) => agent.start()));
        if (REDUCED) return;
        await this.clock.sleep(ws.spec.hold || 7000);
      }
    }

    switchTo(ws) {
      this.active = ws;
      for (const other of this.workspaces) {
        other.panes.hidden = other !== ws;
        other.row?.classList.toggle("is-active", other === ws);
        other.row?.setAttribute("aria-current", other === ws ? "true" : "false");
      }
      ws.agents.forEach((agent) => agent.follow());
      this.renderPanel(ws);
      this.refresh();
    }
    setView(view) {
      this.view = view;
      this.renderPanel(this.active);
    }
    setLayout(count) {
      this.active.panes.dataset.layout = count;
      this.active.agents.forEach((agent) => agent.follow());
    }

    /* The sidebar and title always reflect every tab, not just the one on show. */
    refresh() {
      if (!this.chrome || !this.count) return;
      let working = 0;
      let asking = 0;
      let firstAsking = null;
      for (const ws of this.workspaces) {
        const states = ws.agents.map((agent) => agent.state);
        const w = states.filter((s) => s === "working").length;
        const a = states.filter((s) => s === "asking").length;
        working += w;
        asking += a;
        if (a && !firstAsking) firstAsking = ws;
        ws.row.classList.toggle("is-asking", a > 0);
        ws.glyph.className = "tab-glyph" + (!a && w ? " spin" : "");
        ws.glyph.textContent = a ? "■" : w ? SPINNER[0] : "✓";
        ws.sub.textContent = a ? "Needs you" : w ? `${w} working` : "Done";
      }
      this.title.textContent = this.active.spec.name;
      this.count.replaceChildren(document.createTextNode(`${working} working`));
      if (asking) this.count.append(el("b", null, `${asking} ${asking === 1 ? "needs" : "need"} you`));

      // the red thread runs down the window's edge, from the tab that needs you
      this.thread.classList.toggle("is-on", !!firstAsking);
      if (firstAsking) {
        const app = this.root.getBoundingClientRect();
        const row = firstAsking.row.getBoundingClientRect();
        this.thread.style.top = `${row.top - app.top + row.height / 2}px`;
      }
    }

    renderPanel(ws) {
      if (!this.chrome || ws !== this.active) return;
      this.viewButtons.forEach((b) => b.classList.toggle("is-on", b.dataset.view === this.view));
      this.panelBody.replaceChildren(this.view === "files" ? this.fileTree(ws) : this.gitView(ws));
    }

    fileTree(ws) {
      const root = {};
      for (const path of new Set([...ws.files, ...ws.changes.keys()])) {
        let dir = root;
        path.split("/").forEach((part, i, parts) => {
          if (i === parts.length - 1) dir[part] = path;
          else dir = dir[part] = dir[part] || {};
        });
      }
      const list = el("ul", "tree");
      const walk = (dir, depth) => {
        const names = Object.keys(dir).sort((a, b) => {
          const folder = (typeof dir[b] === "object") - (typeof dir[a] === "object");
          return folder || a.localeCompare(b);
        });
        for (const name of names) {
          const isDir = typeof dir[name] === "object";
          const change = isDir ? null : ws.changes.get(dir[name]);
          const row = el("li", isDir ? "is-dir" : change ? "is-changed" : null);
          row.style.paddingLeft = `${depth * 12 + 12}px`;
          row.append(el("span", null, isDir ? `${name}/` : name));
          if (change) row.append(el("em", null, change.status));
          if (!isDir && dir[name] === ws.fresh) row.classList.add("is-fresh");
          list.append(row);
          if (isDir) walk(dir[name], depth + 1);
        }
      };
      walk(root, 0);
      return list;
    }

    gitView(ws) {
      const box = el("div", "git");
      box.append(el("p", "git-branch", `yien/${ws.spec.name}`));
      let add = 0;
      let del = 0;
      const rows = el("ul", "git-files");
      for (const [path, change] of ws.changes) {
        add += change.add;
        del += change.del;
        const row = el("li");
        row.append(el("span", null, path.split("/").pop()), el("em", null, `+${change.add} −${change.del}`));
        rows.append(row);
      }
      const files = ws.changes.size;
      box.append(el("p", "git-sum", files ? `${files} ${files === 1 ? "file" : "files"} changed, +${add} −${del}` : "No changes yet"), rows);
      if (ws.commits.length) {
        box.append(el("p", "git-head", "Commits"));
        const log = el("ul", "git-log");
        for (const commit of ws.commits) {
          const row = el("li");
          row.append(el("code", null, commit.hash), el("span", null, commit.msg));
          log.append(row);
        }
        box.append(log);
      }
      return box;
    }

    /* The demo plays itself: a tab goes red, gets opened, gets answered. One click hands it over. */
    driveAsk(agent) {
      if (!this.driver) return;
      this.queue = this.queue.then(async () => {
        const { clock } = this;
        const away = agent.ws !== this.active;
        await clock.sleep(away ? 4200 : 6500);
        if (this.touched || !agent.answer) return;
        if (agent.ws !== this.active) {
          this.switchTo(agent.ws);
          await clock.sleep(3000);
          if (this.touched || !agent.answer) return;
        }
        agent.pane.querySelector(".l-ask:not(.is-answered) .ask-yes")?.classList.add("is-pressed");
        await clock.sleep(260);
        if (this.touched || !agent.answer) return;
        agent.answer("allow");
        if (away) {
          await clock.sleep(3600);
          if (!this.touched) this.switchTo(this.home);
        }
      });
    }

    async flipPanel() {
      for (;;) {
        await this.clock.sleep(13000);
        if (this.touched) return;
        this.setView(this.view === "files" ? "git" : "files");
      }
    }
  }

  window.YienSim = Sim;
})();
