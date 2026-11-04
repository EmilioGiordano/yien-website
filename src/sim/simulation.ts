import { AgentRunner, type AgentHost } from "./agentRunner";
import { attachClock, Clock, TICK_MS } from "./clock";
import { runShellCommand, SHELL_PROMPT } from "./shell";
import {
  TERMINALS_SURFACE,
  type AgentStatus,
  type AgentTerminal,
  type AskAnswer,
  type Commit,
  type Doc,
  type FileChange,
  type GitState,
  type PanelView,
  type ShellSpec,
  type ShellTerminal,
  type SimState,
  type Terminal,
  type TerminalSpec,
  type Workspace,
  type WorkspaceSpec,
} from "./types";

export const PANEL_VIEWS: PanelView[] = ["files", "changes", "graph", "branches"];
const MAX_TERMINALS = 4;
const MAX_WORKSPACES = 8;
const DEFAULT_BASE_COMMIT = { hash: "f0c1e2a", message: "Release 2.3" };

export interface SimulationOptions {
  panelView?: PanelView;
  fileContents?: Record<string, string>;
  still?: boolean;
  driver?: boolean;
}

const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const fileName = (path: string) => path.split("/").pop() ?? path;

export class Simulation {
  readonly clock = new Clock();
  private state: SimState;
  private listeners = new Set<() => void>();
  private specs = new Map<string, WorkspaceSpec>();
  private runners = new Map<string, AgentRunner>();
  private nextId = 0;
  private tabCount: number;
  private detachClock: (() => void) | null = null;
  private started = false;
  private touched = false;
  private driverQueue = Promise.resolve();
  private drives = false;
  private homeId: string;

  constructor(
    specs: WorkspaceSpec[],
    private options: SimulationOptions = {},
  ) {
    const workspaces = specs.map((spec) => this.createWorkspace(spec));
    this.homeId = workspaces[0].id;
    this.tabCount = specs.length;
    this.state = {
      workspaces,
      activeId: this.homeId,
      panelView: options.panelView ?? "files",
    };
  }

  /* ---------- Store ---------- */

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = () => this.state;

  private setState(state: SimState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  private workspace(id: string): Workspace {
    return this.state.workspaces.find((ws) => ws.id === id)!;
  }

  private patchWorkspace(id: string, patch: (ws: Workspace) => Workspace) {
    this.setState({
      ...this.state,
      workspaces: this.state.workspaces.map((ws) => (ws.id === id ? patch(ws) : ws)),
    });
  }

  private patchTerminal(wsId: string, terminalId: string, patch: (t: Terminal) => Terminal) {
    this.patchWorkspace(wsId, (ws) => ({
      ...ws,
      terminals: ws.terminals.map((t) => (t.id === terminalId ? patch(t) : t)),
    }));
  }

  private patchGit(wsId: string, patch: (git: GitState) => GitState) {
    this.patchWorkspace(wsId, (ws) => ({ ...ws, git: patch(ws.git) }));
  }

  /* ---------- Lifecycle ---------- */

  start() {
    this.detachClock = attachClock(this.clock);
    if (this.started) return;
    this.started = true;
    this.clock.fast = this.options.still === true || prefersReducedMotion();
    this.drives = this.options.driver === true && !this.clock.fast;
    this.state.workspaces.forEach((ws) => void this.runWorkspace(ws.id));
    if (this.drives) void this.cyclePanel();
  }

  stop() {
    this.detachClock?.();
  }

  private async runWorkspace(wsId: string) {
    const spec = this.specs.get(wsId)!;
    await this.clock.sleep(spec.delay ?? 0);
    const { terminals } = this.workspace(wsId);
    spec.terminals.forEach((terminalSpec, index) => {
      if (terminalSpec.kind === "shell")
        void this.runShell(wsId, terminals[index].id, terminalSpec);
    });
    const agents = terminals.filter((t) => t.kind === "agent");
    if (!agents.length) return;
    for (;;) {
      this.patchGit(wsId, (git) => ({
        ...git,
        changes: {},
        commits: spec.commits.length
          ? spec.commits.map((c) => ({ ...c, branch: "main", files: [] }))
          : [{ ...DEFAULT_BASE_COMMIT, branch: "main", files: [] }],
        freshPath: null,
      }));
      await Promise.all(agents.map((agent) => this.runners.get(agent.id)!.start()));
      if (this.clock.fast) return;
      await this.clock.sleep(spec.pause ?? 7000);
    }
  }

  private async runShell(wsId: string, id: string, spec: ShellSpec) {
    await this.clock.sleep(spec.delay ?? 0);
    if (!spec.command) return;
    const isFocused = () => this.terminal(wsId, id).draftFocused;
    if (!this.clock.fast) {
      for (let i = 1; i <= spec.command.length; i++) {
        if (!isFocused()) this.setDraft(wsId, id, spec.command.slice(0, i));
        await this.clock.sleep(TICK_MS * 2);
      }
      await this.clock.sleep(300);
    }
    if (!isFocused()) this.setDraft(wsId, id, "");
    this.printCommand(wsId, id, spec.command);
    for (const line of spec.output ?? []) {
      await this.clock.sleep(420);
      this.printOutput(wsId, id, [line]);
    }
  }

  /* ---------- Building workspaces ---------- */

  private createWorkspace(spec: WorkspaceSpec): Workspace {
    const id = `ws${++this.nextId}`;
    this.specs.set(id, spec);
    const terminals = spec.terminals.map((terminal) => this.createTerminal(id, spec, terminal));
    const agents = terminals.filter((t): t is AgentTerminal => t.kind === "agent");
    const base = spec.commits.length ? spec.commits : [DEFAULT_BASE_COMMIT];
    return {
      id,
      name: spec.name,
      layout: spec.layout ?? terminals.length,
      files: spec.files,
      terminals,
      docs: [],
      surface: TERMINALS_SURFACE,
      focusedTerminalId: terminals[0].id,
      git: {
        branch: agents[0]?.branch ?? "main",
        commits: base.map((commit) => ({ ...commit, branch: "main", files: [] })),
        changes: {},
        freshPath: null,
        agents: agents.map((agent) => ({
          terminalId: agent.id,
          cli: agent.cli,
          branch: agent.branch,
          status: agent.status,
        })),
      },
    };
  }

  private createTerminal(wsId: string, spec: WorkspaceSpec, terminal: TerminalSpec): Terminal {
    const id = `t${++this.nextId}`;
    const base = { id, entries: [], draft: "", draftFocused: false, autoFocus: false };
    if (terminal.kind === "shell") {
      return {
        ...base,
        kind: "shell",
        detail: terminal.detail ?? "~/shop",
        pinned: !!terminal.pinned,
      };
    }
    this.runners.set(id, new AgentRunner(this.agentHost(wsId, id), terminal));
    return {
      ...base,
      kind: "agent",
      cli: terminal.cli,
      task: terminal.task,
      branch: `${spec.name}/${terminal.cli}`,
      status: "working",
      verb: "Starting",
      seconds: 0,
      tokens: 800,
    };
  }

  private agentHost(wsId: string, id: string): AgentHost {
    return {
      clock: this.clock,
      read: () => this.terminal(wsId, id) as AgentTerminal,
      update: (patch) => this.patchTerminal(wsId, id, (t) => patch(t as AgentTerminal)),
      nextEntryId: () => ++this.nextId,
      setStatus: (status) => this.setAgentStatus(wsId, id, status),
      addChange: ({ file, status, add, del, lines }) =>
        this.addChange(wsId, (this.terminal(wsId, id) as AgentTerminal).branch, {
          path: file,
          status,
          add,
          del,
          lines,
        }),
      addCommit: (hash, message) =>
        this.addCommit(wsId, (this.terminal(wsId, id) as AgentTerminal).branch, hash, message),
      onAsk: () => this.driveAsk(wsId, id),
    };
  }

  private terminal(wsId: string, id: string): Terminal {
    return this.workspace(wsId).terminals.find((t) => t.id === id)!;
  }

  private setAgentStatus(wsId: string, id: string, status: AgentStatus) {
    this.patchTerminal(wsId, id, (t) => ({ ...t, status }) as AgentTerminal);
    this.patchGit(wsId, (git) => ({
      ...git,
      agents: git.agents.map((a) => (a.terminalId === id ? { ...a, status } : a)),
    }));
  }

  /* ---------- Tabs and terminals ---------- */

  selectWorkspace = (id: string) => this.setState({ ...this.state, activeId: id });

  newWorkspace = () => {
    if (this.state.workspaces.length >= MAX_WORKSPACES) return;
    const ws = this.createWorkspace({
      name: `tab-${++this.tabCount}`,
      files: [],
      commits: [],
      terminals: [{ kind: "shell", pinned: true }],
    });
    ws.terminals[0].autoFocus = true;
    this.setState({ ...this.state, workspaces: [...this.state.workspaces, ws], activeId: ws.id });
  };

  splitTerminal = (wsId: string) => {
    const ws = this.workspace(wsId);
    if (ws.terminals.length >= MAX_TERMINALS) return;
    const shell = this.createTerminal(wsId, this.specs.get(wsId)!, {
      kind: "shell",
    }) as ShellTerminal;
    this.patchWorkspace(wsId, (current) => ({
      ...current,
      terminals: [...current.terminals, { ...shell, autoFocus: true }],
      layout: current.terminals.length + 1,
    }));
  };

  closeTerminal = (wsId: string, id: string) => {
    this.patchWorkspace(wsId, (ws) => {
      if (ws.terminals.length === 1) return ws;
      const terminals = ws.terminals.filter((t) => t.id !== id);
      const focusedTerminalId =
        ws.focusedTerminalId === id ? terminals[0].id : ws.focusedTerminalId;
      return { ...ws, terminals, layout: terminals.length, focusedTerminalId };
    });
  };

  setLayout = (wsId: string, layout: number) =>
    this.patchWorkspace(wsId, (ws) => ({ ...ws, layout }));

  focusTerminal = (wsId: string, id: string) => {
    const terminal = this.terminal(wsId, id);
    this.patchWorkspace(wsId, (ws) => ({
      ...ws,
      focusedTerminalId: id,
      git: terminal.kind === "agent" ? { ...ws.git, branch: terminal.branch } : ws.git,
    }));
  };

  /* ---------- Typing ---------- */

  setDraft = (wsId: string, id: string, draft: string) =>
    this.patchTerminal(wsId, id, (t) => ({ ...t, draft }));

  setDraftFocused = (wsId: string, id: string, draftFocused: boolean) =>
    this.patchTerminal(wsId, id, (t) => ({ ...t, draftFocused }));

  submitDraft = (wsId: string, id: string) => {
    const terminal = this.terminal(wsId, id);
    const text = terminal.draft.trim();
    this.setDraft(wsId, id, "");
    if (!text) return;
    if (terminal.kind === "agent") void this.runners.get(id)!.submit(text);
    else this.runInShell(wsId, id, text);
  };

  private runInShell(wsId: string, id: string, text: string) {
    if (text === "clear") {
      this.patchTerminal(wsId, id, (t) => ({ ...t, entries: [] }));
      return;
    }
    const { files, git } = this.workspace(wsId);
    this.printCommand(wsId, id, text);
    this.printOutput(wsId, id, runShellCommand(text, files, git));
  }

  private printCommand(wsId: string, id: string, text: string) {
    this.patchTerminal(wsId, id, (t) => ({
      ...t,
      entries: [
        ...t.entries,
        { id: ++this.nextId, kind: "command", text: `${SHELL_PROMPT} ${text}` },
      ],
    }));
  }

  private printOutput(wsId: string, id: string, lines: string[]) {
    this.patchTerminal(wsId, id, (t) => ({
      ...t,
      entries: [
        ...t.entries,
        ...lines.map((text) => ({ id: ++this.nextId, kind: "output" as const, text })),
      ],
    }));
  }

  answerAsk = (id: string, answer: AskAnswer) => this.runners.get(id)?.answer(answer);

  /* ---------- Center tabs ---------- */

  showSurface = (wsId: string, surface: string) =>
    this.patchWorkspace(wsId, (ws) => ({ ...ws, surface }));

  private openDoc(wsId: string, doc: Doc) {
    this.patchWorkspace(wsId, (ws) => ({
      ...ws,
      surface: doc.id,
      docs: ws.docs.some((d) => d.id === doc.id) ? ws.docs : [...ws.docs, doc],
    }));
  }

  openFile = (wsId: string, path: string, autoFocus = false) => {
    const text = this.options.fileContents?.[path] ?? this.stubFor(wsId, path);
    this.openDoc(wsId, {
      id: `file:${path}`,
      kind: "file",
      title: fileName(path),
      path,
      text,
      savedText: text,
      autoFocus,
    });
  };

  openDiff = (wsId: string, file: FileChange) =>
    this.openDoc(wsId, {
      id: `diff:${file.path}`,
      kind: "diff",
      title: `${fileName(file.path)} diff`,
      file,
    });

  openCommit = (wsId: string, commit: Commit) =>
    this.openDoc(wsId, { id: `commit:${commit.hash}`, kind: "commit", title: commit.hash, commit });

  closeDoc = (wsId: string, docId: string) =>
    this.patchWorkspace(wsId, (ws) => ({
      ...ws,
      docs: ws.docs.filter((doc) => doc.id !== docId),
      surface: ws.surface === docId ? TERMINALS_SURFACE : ws.surface,
    }));

  editDoc = (wsId: string, docId: string, text: string) =>
    this.patchWorkspace(wsId, (ws) => ({
      ...ws,
      docs: ws.docs.map((doc) =>
        doc.id === docId && doc.kind === "file" ? { ...doc, text } : doc,
      ),
    }));

  /* Saving lands on the branch you're on, as a change. */
  saveDoc = (wsId: string, docId: string) => {
    const ws = this.workspace(wsId);
    const doc = ws.docs.find((d) => d.id === docId);
    if (doc?.kind !== "file" || doc.text === doc.savedText) return;
    const before = doc.savedText.split("\n");
    const after = doc.text.split("\n");
    const removed = before.filter((line) => !after.includes(line));
    const added = after.filter((line) => !before.includes(line));
    this.patchWorkspace(wsId, (current) => ({
      ...current,
      docs: current.docs.map((d) => (d.id === docId ? { ...doc, savedText: doc.text } : d)),
    }));
    if (!ws.git.agents.some((agent) => agent.branch === ws.git.branch)) return;
    this.addChange(wsId, ws.git.branch, {
      path: doc.path,
      status: "M",
      add: added.length,
      del: removed.length,
      lines: [...removed.map((line) => `-${line}`), ...added.map((line) => `+${line}`)],
    });
  };

  private stubFor(wsId: string, path: string): string {
    const change = Object.values(this.workspace(wsId).git.changes)
      .flat()
      .find((file) => file.path === path);
    const body = change?.lines.filter((l) => l[0] === "+").map((l) => l.slice(1)) ?? [];
    return [`// ${path}`, "", ...body, ""].join("\n");
  }

  /* ---------- Git ---------- */

  setPanelView = (panelView: PanelView) => this.setState({ ...this.state, panelView });

  selectBranch = (wsId: string, branch: string) => {
    const agent = this.workspace(wsId).git.agents.find((a) => a.branch === branch);
    this.patchWorkspace(wsId, (ws) => ({
      ...ws,
      focusedTerminalId: agent?.terminalId ?? ws.focusedTerminalId,
      git: { ...ws.git, branch },
    }));
  };

  /* A row for pending work leads to the terminal if it's waiting, or to its changes. */
  openPending = (wsId: string, branch: string, asking: boolean) => {
    this.selectBranch(wsId, branch);
    this.showSurface(wsId, TERMINALS_SURFACE);
    this.setPanelView(asking ? "graph" : "changes");
  };

  commitChanges = (wsId: string, message: string) => {
    const { git } = this.workspace(wsId);
    const files = git.changes[git.branch] ?? [];
    if (!files.length) return;
    const fallback = `Update ${fileName(files[0].path)}`;
    this.addCommit(wsId, git.branch, Math.random().toString(16).slice(2, 9), message || fallback);
  };

  private addChange(wsId: string, branch: string, file: FileChange) {
    this.patchGit(wsId, (git) => ({
      ...git,
      freshPath: file.path,
      changes: {
        ...git.changes,
        [branch]: [...(git.changes[branch] ?? []).filter((f) => f.path !== file.path), file],
      },
    }));
  }

  private addCommit(wsId: string, branch: string, hash: string, message: string) {
    this.patchGit(wsId, (git) => ({
      ...git,
      commits: [{ hash, message, branch, files: git.changes[branch] ?? [] }, ...git.commits],
      changes: { ...git.changes, [branch]: [] },
    }));
  }

  /* ---------- The demo that plays itself until someone touches it ---------- */

  markTouched = () => {
    this.touched = true;
  };

  private driveAsk(wsId: string, id: string) {
    if (!this.drives) return;
    const runner = this.runners.get(id)!;
    const canContinue = () => !this.touched && runner.isAsking;
    this.driverQueue = this.driverQueue.then(async () => {
      const away = wsId !== this.state.activeId;
      await this.clock.sleep(away ? 4200 : 6500);
      if (!canContinue()) return;
      if (wsId !== this.state.activeId) {
        this.selectWorkspace(wsId);
        await this.clock.sleep(3000);
        if (!canContinue()) return;
      }
      this.focusTerminal(wsId, id);
      runner.pressYes();
      await this.clock.sleep(260);
      if (!canContinue()) return;
      runner.answer("allow");
      if (away) {
        await this.clock.sleep(3600);
        if (!this.touched) this.selectWorkspace(this.homeId);
      }
    });
  }

  private async cyclePanel() {
    for (;;) {
      await this.clock.sleep(8000);
      if (this.touched) return;
      const next = (PANEL_VIEWS.indexOf(this.state.panelView) + 1) % PANEL_VIEWS.length;
      this.setPanelView(PANEL_VIEWS[next]);
    }
  }
}
