/* The YIEN window on this page: agent CLIs and shells running in tiled terminals, on a script. */
(() => {
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
  const TICK = 40;
  const VIEWS = ["files", "changes", "graph", "branches"];
  const CLIS = {
    claude: { title: "Claude Code", mode: "auto-accept edits on" },
    codex: { title: "Codex", mode: "workspace write" },
    agy: { title: "Antigravity", mode: "agent mode" },
    opencode: { title: "OpenCode", mode: "build mode" },
    aider: { title: "aider", mode: "code mode" },
  };

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  /* Time only passes while a window is on screen, so no agent finishes unseen. */
  class Clock {
    constructor(fast) {
      this.fast = fast;
      this.now = 0;
      this.sleepers = [];
      this.awake = false;
    }
    sleep(ms) {
      if (this.fast) return Promise.resolve();
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

  /* What every terminal shares: a title, a scrollback, and something to type into. */
  class Terminal {
    constructor(sim, ws, title, detail) {
      this.sim = sim;
      this.ws = ws;
      this.pane = el("section", "pane");
      const head = el("header", "pane-head");
      this.glyph = el("span", "pane-glyph");
      const split = el("button", "pane-btn pane-split");
      split.type = "button";
      split.title = "Split terminal (Ctrl D)";
      split.setAttribute("aria-label", "Split terminal");
      split.addEventListener("click", () => sim.split(ws));
      head.append(this.glyph, el("b", "pane-cli", title), el("span", "pane-task", detail), split);
      this.head = head;
      this.log = el("div", "pane-log");
      this.input = el("input", "pane-field");
      this.input.type = "text";
      this.input.spellcheck = false;
      this.input.autocomplete = "off";
      this.input.setAttribute("aria-label", `Type to ${title}`);
      this.input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        const text = this.input.value.trim();
        this.input.value = "";
        if (text) this.submit(text);
      });
      this.pane.append(head, this.log);
      this.pane.addEventListener("pointerdown", () => sim.focus(ws, this));
      this.input.addEventListener("focus", () => sim.focus(ws, this));
    }
    add(node) {
      this.log.append(node);
      this.follow();
      return node;
    }
    follow() {
      this.log.scrollTop = this.log.scrollHeight;
    }
  }

  /* A plain shell: it runs its one command, then answers a few of yours. */
  class Shell extends Terminal {
    constructor(sim, ws, spec) {
      super(sim, ws, "zsh", spec.task || "~/shop");
      this.spec = spec;
      this.glyph.textContent = "$";
      this.input.setAttribute("aria-label", "Type a shell command");
      this.row = el("label", "sh-row");
      this.row.append(el("span", "sh-prompt", this.promptText()), this.input);
      this.log.append(this.row);
      if (!spec.keep) {
        const close = el("button", "pane-btn pane-close", "×");
        close.type = "button";
        close.title = "Close terminal";
        close.setAttribute("aria-label", "Close terminal");
        close.addEventListener("click", () => sim.close(ws, this));
        this.head.append(close);
      }
      this.pane.addEventListener("click", (event) => {
        if (!event.target.closest("button") && !getSelection().toString()) this.input.focus({ preventScroll: true });
      });
    }
    promptText() {
      return `${this.spec.cwd || "~/shop"} %`;
    }
    print(text, cls) {
      const line = el("p", cls || "sh-out", text);
      this.log.insertBefore(line, this.row);
      this.follow();
      return line;
    }
    async start() {
      const { clock } = this.sim;
      await clock.sleep(this.spec.delay || 0);
      if (!this.spec.run) return;
      if (!clock.fast) {
        for (let i = 1; i <= this.spec.run.length; i++) {
          if (document.activeElement !== this.input) this.input.value = this.spec.run.slice(0, i);
          await clock.sleep(TICK * 2);
        }
        await clock.sleep(300);
      }
      if (document.activeElement !== this.input) this.input.value = "";
      this.print(`${this.promptText()} ${this.spec.run}`, "sh-cmd");
      for (const line of this.spec.out || []) {
        await clock.sleep(420);
        this.print(line);
      }
    }
    submit(text) {
      this.print(`${this.promptText()} ${text}`, "sh-cmd");
      const { ws } = this;
      const [cmd, ...rest] = text.split(/\s+/);
      const answers = {
        pwd: () => ["/Users/you/shop"],
        whoami: () => ["you"],
        echo: () => [rest.join(" ")],
        ls: () => [...new Set(ws.spec.files.map((path) => path.split("/")[0]))].sort(),
        help: () => ["Try ls, pwd, git status, git log, git branch, or clear."],
        git: () =>
          rest[0] === "log"
            ? ws.commits.map((commit) => `${commit.hash} ${commit.msg}`)
            : rest[0] === "branch"
              ? ["* main", ...ws.agents.map((agent) => `  ${agent.branch}`)]
              : rest[0] === "status"
                ? ["On branch main", "nothing to commit, working tree clean"]
                : [`git: '${rest[0] || ""}' isn't set up in this shell`],
      };
      if (cmd === "clear") {
        [...this.log.children].forEach((child) => child !== this.row && child.remove());
      } else if (answers[cmd]) {
        answers[cmd]().forEach((line) => this.print(line));
      } else {
        this.print(`zsh: command not found: ${cmd}`);
      }
    }
  }

  /* An agent CLI: banner, scrollback, a status line while it works, and its prompt. */
  class Agent extends Terminal {
    constructor(sim, ws, spec) {
      super(sim, ws, spec.cli, spec.task);
      this.spec = spec;
      this.branch = `${ws.spec.name}/${spec.cli}`;
      this.changes = new Map();
      this.state = "working";
      this.run = 0;
      this.secs = 0;
      this.tokens = 800;
      this.verb = "Starting";
      this.glyph.className = "pane-glyph spin";
      this.glyph.textContent = SPINNER[0];
      this.status = el("p", "pane-status");
      const box = el("label", "pane-input");
      box.append(el("span", "pane-caret", "❯"), this.input);
      this.input.placeholder = `Message ${spec.cli}`;
      const foot = el("p", "pane-foot");
      this.meter = el("span", "pane-meter");
      foot.append(el("span", null, `⏵⏵ ${CLIS[spec.cli].mode}`), this.meter);
      this.pane.append(this.status, box, foot);
    }

    setState(state) {
      this.state = state;
      this.pane.classList.toggle("is-asking", state === "asking");
      this.glyph.className = "pane-glyph" + (state === "working" ? " spin" : "");
      this.glyph.textContent = state === "done" ? "✓" : state === "asking" ? "■" : SPINNER[0];
      this.renderStatus();
      this.sim.refresh();
      this.sim.renderPanel(this.ws);
    }
    setVerb(verb) {
      this.verb = verb;
      this.renderStatus();
    }
    renderStatus() {
      const min = Math.floor(this.secs / 60);
      const time = `${min}:${String(this.secs % 60).padStart(2, "0")}`;
      this.meter.textContent = `${(this.tokens / 1000).toFixed(1)}k tokens`;
      this.status.classList.toggle("is-asking", this.state === "asking");
      if (this.state === "done") this.status.textContent = `✓ Finished in ${time}`;
      else if (this.state === "asking") this.status.textContent = "■ Waiting for your answer";
      else this.status.replaceChildren(el("span", "spin", SPINNER[0]), ` ${this.verb}… (${time}, esc to stop)`);
    }
    async ticker(run) {
      if (this.sim.clock.fast) return;
      while (this.run === run && this.state !== "done") {
        await this.sim.clock.sleep(1000);
        if (this.run !== run || this.state === "done") return;
        if (this.state === "working") {
          this.secs += 2;
          this.tokens += 90 + Math.floor(Math.random() * 420);
          this.renderStatus();
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
      this.verb = "Starting";
      const banner = el("div", "l-banner");
      banner.append(el("b", null, CLIS[this.spec.cli].title), el("span", null, `~/shop/.yien/${this.branch.replace("/", "-")}`));
      this.add(banner);
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
        if (this.sim.clock.fast) {
          this.secs += 14;
          this.tokens += 1300;
        }
      }
      this.setState("done");
    }

    async stream(write, text, min, spread) {
      if (this.sim.clock.fast) {
        write(text);
        this.follow();
        return;
      }
      for (let i = 0; i < text.length; i += min + Math.floor(Math.random() * spread)) {
        write(text.slice(0, i));
        this.follow();
        await this.sim.clock.sleep(TICK);
      }
      write(text);
      this.follow();
    }

    /* The prompt is typed where you'd type it, then sent. */
    async prompt(step) {
      if (document.activeElement !== this.input) {
        await this.stream((text) => (this.input.value = text), step.text, 1, 3);
        await this.sim.clock.sleep(380);
        if (document.activeElement !== this.input) this.input.value = "";
      }
      this.add(el("p", "l-prompt", `❯ ${step.text}`));
      this.setVerb("Thinking");
      await this.sim.clock.sleep(350);
    }
    async think(step) {
      this.setVerb("Thinking");
      this.add(el("p", "l-think", `✻ ${step.text}`));
      await this.sim.clock.sleep(1100);
    }
    async plan(step) {
      const list = el("ul", "l-plan");
      this.planItems = step.tasks.map((task) => list.appendChild(el("li", null, task)));
      this.add(list);
      await this.sim.clock.sleep(650);
    }
    call(name, arg) {
      const box = el("div", "l-tool");
      const head = el("p", "l-call");
      const glyph = el("span", "l-glyph spin", SPINNER[0]);
      const out = el("p", "l-out");
      head.append(glyph, el("b", null, name), el("span", "l-arg", arg));
      box.append(head);
      this.add(box);
      return { box, glyph, out };
    }
    finish(tool, res) {
      tool.glyph.className = "l-glyph";
      tool.glyph.textContent = "●";
      tool.out.textContent = `└ ${res}`;
      tool.box.append(tool.out);
      this.follow();
    }
    async tool(step) {
      this.setVerb(step.name === "Bash" ? "Running" : step.name === "Grep" ? "Searching" : "Reading");
      const tool = this.call(step.name, step.arg);
      await this.sim.clock.sleep(450 + Math.min(step.ms, 1400) * 0.6 + Math.random() * 300);
      this.finish(tool, step.res);
      await this.sim.clock.sleep(220);
    }
    async edit(step) {
      this.setVerb("Editing");
      const tool = this.call(step.status === "A" ? "Write" : "Edit", step.file);
      await this.sim.clock.sleep(700 + Math.random() * 400);
      this.finish(tool, `+${step.add} −${step.del}`);
      const diff = el("pre", "l-diff");
      for (const text of step.lines) diff.append(el("span", text[0] === "+" ? "is-add" : "is-del", text));
      tool.box.append(diff);
      this.follow();
      this.changes.set(step.file, { path: step.file, status: step.status, add: step.add, del: step.del, lines: step.lines });
      this.ws.fresh = step.file;
      this.sim.renderPanel(this.ws);
      await this.sim.clock.sleep(650);
    }
    async progress(step) {
      this.setVerb("Running");
      const tool = this.call(step.name, step.arg);
      const count = el("span", "l-count");
      const bar = el("span", "l-bar");
      const fill = el("i");
      bar.append(fill);
      tool.box.firstChild.append(count);
      tool.box.append(bar);
      this.follow();
      const steps = 30;
      for (let n = 1; n <= steps && !this.sim.clock.fast; n++) {
        await this.sim.clock.sleep(step.dur / steps);
        fill.style.width = `${(n / steps) * 100}%`;
        count.textContent = `${Math.round((step.total * n) / steps).toLocaleString("en-US")}/${step.total.toLocaleString("en-US")}`;
      }
      bar.remove();
      count.remove();
      this.finish(tool, step.res);
      await this.sim.clock.sleep(260);
    }
    async commit(step) {
      this.setVerb("Committing");
      const tool = this.call("Bash", `git commit -m "${step.msg}"`);
      await this.sim.clock.sleep(500);
      this.finish(tool, step.hash);
      this.sim.commit(this, step.hash, step.msg);
      await this.sim.clock.sleep(320);
    }
    async msg(step) {
      const line = this.add(el("p", "l-msg"));
      this.setVerb("Writing");
      await this.stream((text) => (line.textContent = text), step.text, 3, 4);
    }
    async ask(step) {
      const box = el("div", "l-ask");
      const options = el("div", "l-ask-options");
      const choose = (label, value) => {
        const button = el("button", "l-ask-option", label);
        button.type = "button";
        button.addEventListener("click", () => this.answer?.(value));
        options.append(button);
        return button;
      };
      choose("1. Yes", "allow").classList.add("ask-yes");
      choose("2. Yes, and don't ask again", "allow");
      choose("3. No, do something else", "deny");
      box.append(el("p", null, step.text), el("code", null, step.cmd), options);
      this.add(box);
      this.setState("asking");
      const answer = await new Promise((resolve) => {
        this.answer = resolve;
        this.sim.driveAsk(this);
      });
      this.answer = null;
      options.replaceWith(el("p", "l-ask-said", answer === "allow" ? "└ Allowed by you" : "└ Denied by you"));
      box.classList.add("is-answered");
      this.setState("working");
      this.follow();
      if (answer === "deny") {
        this.add(el("p", "l-msg", step.denied));
        this.skip = 1;
      }
      await this.sim.clock.sleep(350);
    }

    /* Whatever you type gets an answer, in the agent's own scrollback. */
    async submit(text) {
      this.add(el("p", "l-prompt", `❯ ${text}`));
      if (text === "/clear") {
        this.log.replaceChildren();
      } else if (text === "/help") {
        this.add(el("p", "l-msg", "/clear wipes this scrollback. Anything else goes to the agent."));
      } else if (this.state === "asking") {
        this.add(el("p", "l-msg", "Answer the question above first, and I'll pick this up after."));
      } else if (this.state === "working") {
        this.add(el("p", "l-msg", "Got it. I'll do that after this step."));
      } else {
        this.verb = "Thinking";
        this.setState("working");
        await this.sim.clock.sleep(1500);
        this.add(el("p", "l-msg", "Done. Nothing else needed changing on this branch."));
        this.setState("done");
      }
    }
  }

  class Sim {
    /* options.chrome: draw the tabs and right panel. options.driver: act out the demo
       (open a tab that needs you, allow it) until someone clicks or types. */
    constructor(root, workspaces, options = {}) {
      this.root = root;
      this.chrome = options.chrome !== false;
      this.driver = options.driver && !REDUCED;
      this.clock = new Clock(REDUCED);
      this.view = options.view || "files";
      this.touched = false;
      this.queue = Promise.resolve();
      this.tabCount = workspaces.length;
      clocks.add(this.clock);

      this.stage = el("div", "stage");
      this.workspaces = workspaces.map((spec) => this.makeWorkspace(spec));
      this.home = this.workspaces[0];

      const bar = el("div", "app-bar");
      const lights = el("span", "app-lights");
      lights.append(el("i"), el("i"), el("i"));
      this.title = el("span", "app-title", options.title);
      this.count = el("span", "app-count");
      bar.append(lights, this.title, this.count);
      root.append(bar);

      if (this.chrome) this.buildChrome();
      else root.append(this.stage);

      root.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button, input")) this.touched = true;
      });
      new IntersectionObserver(([entry]) => (this.clock.awake = entry.isIntersecting)).observe(root);

      this.switchTo(this.home);
      this.workspaces.forEach((ws) => this.runWorkspace(ws));
      if (this.driver) this.flipPanel();
    }

    makeWorkspace(spec) {
      const base = spec.commits.length ? spec.commits : [{ hash: "f0c1e2a", msg: "Release 2.3" }];
      const ws = { spec, files: spec.files, base: base.map((c) => ({ ...c, branch: "main", files: [] })), commits: [], fresh: null, docs: [], surface: "terminals" };
      ws.commits = [...ws.base];
      ws.host = el("div", "center");
      ws.host.hidden = true;
      ws.strip = el("div", "center-tabs");
      ws.docHost = el("div", "doc-host");
      ws.panes = el("div", "panes");
      if (this.chrome) ws.host.append(ws.strip);
      ws.host.append(ws.panes, ws.docHost);
      ws.terms = spec.agents.map((term) => (term.shell ? new Shell(this, ws, term) : new Agent(this, ws, term)));
      ws.agents = ws.terms.filter((term) => term instanceof Agent);
      ws.terms.forEach((term) => ws.panes.append(term.pane));
      ws.panes.dataset.layout = spec.layout || ws.terms.length;
      ws.focus = ws.agents[0] || ws.terms[0];
      ws.branch = ws.agents[0]?.branch || "main";
      ws.focus.pane.classList.add("is-focus");
      this.stage.append(ws.host);
      this.renderStrip(ws);
      return ws;
    }

    buildChrome() {
      const side = el("div", "side");
      side.append(el("p", "side-label", "Tabs"));
      this.tabList = el("div", "side-tabs");
      this.workspaces.forEach((ws) => this.addRow(ws));
      const add = el("button", "side-new");
      add.type = "button";
      add.append(el("span", null, "New tab"), el("kbd", null, "Ctrl T"));
      add.addEventListener("click", () => this.newTab());
      side.append(this.tabList, add);

      const panel = el("div", "panel");
      this.branchButton = el("button", "panel-branch");
      this.branchButton.type = "button";
      this.branchButton.title = "Switch branch";
      this.branchButton.addEventListener("click", () => this.setView("branches"));
      const toggle = el("div", "panel-toggle");
      this.viewButtons = VIEWS.map((view) => {
        const button = el("button", null, view[0].toUpperCase() + view.slice(1));
        button.type = "button";
        button.dataset.view = view;
        button.addEventListener("click", () => this.setView(view));
        toggle.append(button);
        return button;
      });
      this.panelBody = el("div", "panel-body");
      panel.append(this.branchButton, toggle, this.panelBody);

      const body = el("div", "app-body");
      body.append(side, this.stage, panel);
      this.thread = el("span", "app-thread");
      this.root.append(body, this.thread);
    }

    addRow(ws) {
      ws.row = el("button", "tab-row");
      ws.row.type = "button";
      ws.glyph = el("span", "tab-glyph");
      ws.sub = el("span", "tab-sub");
      ws.row.append(ws.glyph, el("span", "tab-name", ws.spec.name), ws.sub);
      ws.row.addEventListener("click", () => this.switchTo(ws));
      this.tabList.append(ws.row);
    }

    newTab() {
      if (this.workspaces.length >= 8) return;
      this.tabCount++;
      const ws = this.makeWorkspace({ name: `tab-${this.tabCount}`, files: [], commits: [], agents: [{ shell: true, keep: true }] });
      this.workspaces.push(ws);
      this.addRow(ws);
      this.switchTo(ws);
      ws.terms[0].input.focus({ preventScroll: true });
    }
    split(ws) {
      if (ws.terms.length >= 4) return;
      const shell = new Shell(this, ws, {});
      ws.terms.push(shell);
      ws.panes.append(shell.pane);
      ws.panes.dataset.layout = ws.terms.length;
      this.renderStrip(ws);
      shell.input.focus({ preventScroll: true });
      ws.terms.forEach((term) => term.follow());
    }
    close(ws, shell) {
      if (ws.terms.length === 1) return;
      ws.terms.splice(ws.terms.indexOf(shell), 1);
      shell.pane.remove();
      ws.panes.dataset.layout = ws.terms.length;
      this.renderStrip(ws);
      ws.terms.forEach((term) => term.follow());
    }

    async runWorkspace(ws) {
      await this.clock.sleep(ws.spec.delay || 0);
      ws.terms.filter((term) => term instanceof Shell).forEach((shell) => shell.start());
      if (!ws.agents.length) return;
      for (;;) {
        ws.agents.forEach((agent) => agent.changes.clear());
        ws.commits = [...ws.base];
        ws.fresh = null;
        this.renderPanel(ws);
        await Promise.all(ws.agents.map((agent) => agent.start()));
        if (this.clock.fast) return;
        await this.clock.sleep(ws.spec.hold || 7000);
      }
    }

    switchTo(ws) {
      this.active = ws;
      for (const other of this.workspaces) {
        other.host.hidden = other !== ws;
        other.row?.classList.toggle("is-active", other === ws);
        other.row?.setAttribute("aria-current", other === ws ? "true" : "false");
      }
      this.showSurface(ws, ws.surface);
      this.renderPanel(ws);
      this.refresh();
    }
    setView(view) {
      this.view = view;
      this.renderPanel(this.active);
    }
    setLayout(count) {
      this.active.panes.dataset.layout = count;
      this.active.terms.forEach((term) => term.follow());
    }

    /* The sidebar and title always reflect every tab, not just the one on show. */
    refresh() {
      if (!this.count) return;
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
        if (!ws.row) continue;
        const idle = !ws.agents.length;
        ws.row.classList.toggle("is-asking", a > 0);
        ws.glyph.className = "tab-glyph" + (!a && w ? " spin" : "");
        ws.glyph.textContent = a ? "■" : w ? SPINNER[0] : idle ? "$" : "✓";
        ws.sub.textContent = a ? "Needs you" : w ? `${w} working` : idle ? "Shell" : "Done";
      }
      if (this.chrome) this.title.textContent = this.active.spec.name;
      if (working || asking) this.count.replaceChildren(document.createTextNode(`${working} working`));
      else this.count.replaceChildren();
      if (asking) this.count.append(el("b", null, `${asking} ${asking === 1 ? "needs" : "need"} you`));

      // the red thread runs down the window's edge, from the tab that needs you
      if (!this.thread) return;
      this.thread.classList.toggle("is-on", !!firstAsking);
      if (firstAsking) {
        const app = this.root.getBoundingClientRect();
        const row = firstAsking.row.getBoundingClientRect();
        this.thread.style.top = `${row.top - app.top + row.height / 2}px`;
      }
    }

    /* ---------- Center: the terminals, plus any file, diff or commit you open ---------- */
    renderStrip(ws) {
      if (!this.chrome) return;
      const tab = (label, id, closable) => {
        const box = el("span", "center-tab" + (ws.surface === id ? " is-on" : ""));
        const open = el("button", null, label);
        open.type = "button";
        open.addEventListener("click", () => this.showSurface(ws, id));
        box.append(open);
        if (closable) {
          const close = el("button", "center-close", "×");
          close.type = "button";
          close.setAttribute("aria-label", `Close ${label}`);
          close.addEventListener("click", () => this.closeDoc(ws, id));
          box.append(close);
        }
        return box;
      };
      ws.strip.replaceChildren(tab(`Terminals ${ws.terms.length}`, "terminals"), ...ws.docs.map((doc) => tab(doc.dirty ? `● ${doc.title}` : doc.title, doc.id, true)));
    }
    showSurface(ws, id) {
      ws.surface = id;
      ws.panes.hidden = id !== "terminals";
      ws.docHost.hidden = id === "terminals";
      ws.docs.forEach((doc) => (doc.node.hidden = doc.id !== id));
      this.renderStrip(ws);
      if (id === "terminals") ws.terms.forEach((term) => term.follow());
    }
    openDoc(ws, id, title, build) {
      let doc = ws.docs.find((d) => d.id === id);
      if (!doc) {
        doc = { id, title, node: build() };
        ws.docs.push(doc);
        ws.docHost.append(doc.node);
      }
      this.showSurface(ws, id);
      return doc;
    }
    closeDoc(ws, id) {
      const doc = ws.docs.find((d) => d.id === id);
      doc.node.remove();
      ws.docs.splice(ws.docs.indexOf(doc), 1);
      this.showSurface(ws, ws.surface === id ? "terminals" : ws.surface);
    }

    /* A file is yours to edit. Ctrl S saves it onto the branch you're on, as a change. */
    openFile(ws, path) {
      const text = window.YIEN_DATA.contents?.[path] ?? this.stubFor(ws, path);
      const doc = this.openDoc(ws, `file:${path}`, path.split("/").pop(), () => {
        const box = el("div", "editor");
        const gutter = el("pre", "editor-gutter");
        const area = el("textarea", "editor-text");
        area.value = text;
        area.spellcheck = false;
        area.wrap = "off";
        area.setAttribute("aria-label", `Edit ${path}`);
        const number = () => (gutter.textContent = area.value.split("\n").map((_, i) => i + 1).join("\n"));
        number();
        area.addEventListener("scroll", () => (gutter.scrollTop = area.scrollTop));
        area.addEventListener("input", () => {
          number();
          const open = ws.docs.find((d) => d.id === `file:${path}`);
          if (!open.dirty) {
            open.dirty = true;
            this.renderStrip(ws);
          }
        });
        area.addEventListener("keydown", (event) => {
          if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
          event.preventDefault();
          this.saveFile(ws, path, text, area.value);
        });
        box.append(el("p", "doc-path", path), gutter, area);
        return box;
      });
      doc.node.querySelector("textarea").focus({ preventScroll: true });
    }
    stubFor(ws, path) {
      const change = ws.agents.map((agent) => agent.changes.get(path)).find(Boolean);
      const body = change ? change.lines.filter((l) => l[0] === "+").map((l) => l.slice(1)) : [];
      return [`// ${path}`, "", ...body, ""].join("\n");
    }
    saveFile(ws, path, before, after) {
      const doc = ws.docs.find((d) => d.id === `file:${path}`);
      doc.dirty = false;
      this.renderStrip(ws);
      const agent = ws.agents.find((a) => a.branch === ws.branch);
      if (!agent || before === after) return;
      const old = before.split("\n");
      const now = after.split("\n");
      const added = now.filter((l) => !old.includes(l));
      const removed = old.filter((l) => !now.includes(l));
      agent.changes.set(path, {
        path,
        status: "M",
        add: added.length,
        del: removed.length,
        lines: [...removed.map((l) => `-${l}`), ...added.map((l) => `+${l}`)],
      });
      ws.fresh = path;
      this.renderPanel(ws);
    }
    diffNode(file) {
      const box = el("div", "doc-file");
      box.append(el("p", "doc-path", `${file.path}  +${file.add} −${file.del}`));
      const pre = el("pre", "diff");
      for (const line of file.lines) pre.append(el("span", line[0] === "+" ? "is-add" : "is-del", line));
      box.append(pre);
      return box;
    }
    openDiff(ws, file) {
      this.openDoc(ws, `diff:${file.path}`, `${file.path.split("/").pop()} diff`, () => {
        const box = el("div", "doc");
        box.append(this.diffNode(file));
        return box;
      });
    }
    openCommit(ws, commit) {
      this.openDoc(ws, `commit:${commit.hash}`, commit.hash, () => {
        const box = el("div", "doc");
        const head = el("div", "doc-commit");
        head.append(el("b", null, commit.msg), el("span", null, `${commit.hash} on ${commit.branch}`));
        box.append(head);
        commit.files.forEach((file) => box.append(this.diffNode(file)));
        if (!commit.files.length) box.append(el("p", "panel-empty", "This commit came in with the branch."));
        return box;
      });
    }

    /* ---------- Git, for whichever terminal you're in ---------- */
    focus(ws, term) {
      if (ws.focus === term && (!term.branch || ws.branch === term.branch)) return;
      ws.focus?.pane.classList.remove("is-focus");
      ws.focus = term;
      term.pane.classList.add("is-focus");
      if (term.branch) this.setBranch(ws, term.branch);
    }
    setBranch(ws, branch) {
      ws.branch = branch;
      const agent = ws.agents.find((a) => a.branch === branch);
      if (agent && ws.focus !== agent) this.focus(ws, agent);
      this.renderPanel(ws);
    }
    commit(agent, hash, msg) {
      const { ws } = agent;
      ws.commits.unshift({ hash, msg, branch: agent.branch, files: [...agent.changes.values()] });
      agent.changes.clear();
      this.renderPanel(ws);
    }

    /* ---------- Right: Files, Changes, Graph, Branches ---------- */
    renderPanel(ws) {
      if (!this.chrome || ws !== this.active || !this.viewButtons) return;
      // never pull the commit box out from under someone typing in it
      if (this.panelBody.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
      this.branchButton.replaceChildren(el("span", "branch-icon"), el("span", "branch-name", ws.branch), el("span", "branch-more", "▾"));
      const pending = ws.agents.find((a) => a.branch === ws.branch)?.changes.size || 0;
      for (const button of this.viewButtons) {
        const view = button.dataset.view;
        button.classList.toggle("is-on", view === this.view);
        button.textContent = view[0].toUpperCase() + view.slice(1);
        if (view === "changes" && pending) button.append(el("em", null, String(pending)));
      }
      const build = { files: this.fileTree, changes: this.changesView, graph: this.graphView, branches: this.branchesView }[this.view];
      this.panelBody.replaceChildren(build.call(this, ws));
    }

    fileTree(ws) {
      const changed = new Map();
      for (const agent of ws.agents) {
        for (const commit of ws.commits) if (commit.branch === agent.branch) commit.files.forEach((f) => changed.set(f.path, f.status));
        for (const [path, file] of agent.changes) changed.set(path, file.status);
      }
      const root = {};
      for (const path of new Set([...ws.files, ...changed.keys()])) {
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
          const status = isDir ? null : changed.get(dir[name]);
          const row = el("li");
          const line = el(isDir ? "span" : "button", "tree-row" + (isDir ? " is-dir" : status ? " is-changed" : ""));
          line.style.paddingLeft = `${depth * 12 + 14}px`;
          line.append(el("span", "tree-name", isDir ? `${name}/` : name));
          if (status) line.append(el("em", null, status));
          if (!isDir) {
            line.type = "button";
            line.addEventListener("click", () => this.openFile(ws, dir[name]));
            if (dir[name] === ws.fresh) line.classList.add("is-fresh");
            if (ws.surface === `file:${dir[name]}`) line.classList.add("is-open");
          }
          row.append(line);
          list.append(row);
          if (isDir) walk(dir[name], depth + 1);
        }
      };
      walk(root, 0);
      return list;
    }

    changesView(ws) {
      const agent = ws.agents.find((a) => a.branch === ws.branch);
      const files = agent ? [...agent.changes.values()] : [];
      const box = el("div", "changes");
      if (!files.length) {
        box.append(el("p", "panel-empty", agent ? "Nothing to commit on this branch." : "main is clean. Agents work on their own branches."));
        return box;
      }
      const add = files.reduce((n, f) => n + f.add, 0);
      const del = files.reduce((n, f) => n + f.del, 0);
      box.append(el("p", "panel-sum", `${files.length} ${files.length === 1 ? "file" : "files"} changed, +${add} −${del}`));
      const list = el("ul", "change-list");
      for (const file of files) {
        const button = el("button", "change-row");
        button.type = "button";
        const name = el("span", "change-name", file.path.split("/").pop());
        name.title = file.path;
        button.append(el("em", null, file.status), name, el("span", "change-num", `+${file.add} −${file.del}`));
        button.addEventListener("click", () => this.openDiff(ws, file));
        const row = el("li");
        row.append(button);
        list.append(row);
      }
      const form = el("form", "commit-box");
      const message = el("input");
      message.type = "text";
      message.placeholder = "Commit message";
      message.setAttribute("aria-label", "Commit message");
      const submit = el("button", null, "Commit");
      submit.type = "submit";
      form.append(message, submit);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const hash = Math.random().toString(16).slice(2, 9);
        this.commit(agent, hash, message.value.trim() || `Update ${files[0].path.split("/").pop()}`);
      });
      box.append(list, form);
      return box;
    }

    graphView(ws) {
      const ROW = 38;
      const lanes = new Map([["main", 12]]);
      const rows = [];
      for (const agent of ws.agents) {
        const asking = agent.state === "asking";
        if (!asking && !agent.changes.size) continue;
        const n = agent.changes.size;
        rows.push({ branch: agent.branch, title: agent.branch.split("/").pop(), text: asking ? "Waiting on you" : `${n} uncommitted ${n === 1 ? "file" : "files"}`, asking, open: () => this.openChanges(ws, agent) });
      }
      for (const commit of ws.commits) {
        const who = commit.branch === "main" ? "main" : commit.branch.split("/").pop();
        rows.push({ branch: commit.branch, title: commit.hash, who, text: commit.msg, done: true, open: () => this.openCommit(ws, commit) });
      }
      for (const row of rows) if (!lanes.has(row.branch)) lanes.set(row.branch, 12 + lanes.size * 14);
      const y = (i) => i * ROW + ROW / 2;
      const last = rows.length - 1;
      const width = 12 + lanes.size * 14 + 2;
      const paths = [`<path d="M12 0V${rows.length * ROW}" />`];
      const nodes = [];
      for (const [branch, x] of lanes) {
        if (branch === "main") continue;
        const top = rows.findIndex((r) => r.branch === branch);
        const red = rows[top].asking ? ' class="is-red"' : "";
        paths.push(`<path${red} d="M${x} ${y(top)}V${y(last) - 26}C${x} ${y(last) - 8} 12 ${y(last) - 14} 12 ${y(last)}" />`);
      }
      rows.forEach((row, i) => {
        const x = lanes.get(row.branch);
        if (row.asking) nodes.push(`<circle class="is-red-dot" cx="${x}" cy="${y(i)}" r="5" />`);
        else if (row.done) nodes.push(`<circle cx="${x}" cy="${y(i)}" r="4" />`);
        else nodes.push(`<circle class="is-open-dot" cx="${x}" cy="${y(i)}" r="4" />`);
      });
      const box = el("div", "graph");
      box.style.setProperty("--rail", `${width}px`);
      box.innerHTML = `<svg width="${width}" height="${rows.length * ROW}" aria-hidden="true"><g class="graph-lines">${paths.join("")}</g><g class="graph-nodes">${nodes.join("")}</g></svg>`;
      const list = el("ul");
      for (const row of rows) {
        const button = el("button", "graph-row" + (row.asking ? " is-red" : "") + (row.branch === ws.branch ? " is-current" : ""));
        button.type = "button";
        const head = el("span", "graph-head");
        head.append(el("b", null, row.title));
        if (row.who) head.append(el("i", null, row.who));
        button.append(head, el("span", "graph-text", row.text));
        button.addEventListener("click", row.open);
        const item = el("li");
        item.append(button);
        list.append(item);
      }
      box.append(list);
      return box;
    }
    openChanges(ws, agent) {
      this.setBranch(ws, agent.branch);
      this.showSurface(ws, "terminals");
      this.setView(agent.state === "asking" ? "graph" : "changes");
    }

    branchesView(ws) {
      const list = el("ul", "branches-list");
      const row = (name, detail, red, pick) => {
        const button = el("button", "branch-row" + (name === ws.branch ? " is-current" : "") + (red ? " is-red" : ""));
        button.type = "button";
        button.append(el("b", null, name), el("span", null, detail));
        button.addEventListener("click", pick);
        const item = el("li");
        item.append(button);
        list.append(item);
      };
      for (const agent of ws.agents) {
        const ahead = ws.commits.filter((c) => c.branch === agent.branch).length;
        const bits = [`${ahead} ahead`];
        if (agent.changes.size) bits.push(`${agent.changes.size} changed`);
        bits.push(agent.state === "asking" ? "needs you" : agent.state === "done" ? "done" : `${agent.spec.cli} working`);
        row(agent.branch, bits.join(", "), agent.state === "asking", () => this.setBranch(ws, agent.branch));
      }
      row("main", "base branch, no worktree", false, () => this.setBranch(ws, "main"));
      return list;
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
        this.setBranch(agent.ws, agent.branch);
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
        await this.clock.sleep(8000);
        if (this.touched) return;
        this.setView(VIEWS[(VIEWS.indexOf(this.view) + 1) % VIEWS.length]);
      }
    }
  }

  window.YienSim = Sim;
})();
