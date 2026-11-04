import { TICK_MS, type Clock } from "./clock";
import type {
  AgentSpec,
  AgentStatus,
  AgentTerminal,
  AskAnswer,
  Entry,
  EntryOf,
  Step,
} from "./types";

export const CLIS = {
  claude: { title: "Claude Code", mode: "auto-accept edits on" },
  codex: { title: "Codex", mode: "workspace write" },
  agy: { title: "Antigravity", mode: "agent mode" },
  opencode: { title: "OpenCode", mode: "build mode" },
  aider: { title: "aider", mode: "code mode" },
};

/* What a running agent needs from the simulation around it. */
export interface AgentHost {
  clock: Clock;
  update(patch: (terminal: AgentTerminal) => AgentTerminal): void;
  read(): AgentTerminal;
  nextEntryId(): number;
  setStatus(status: AgentStatus): void;
  addChange(step: Extract<Step, { type: "edit" }>): void;
  addCommit(hash: string, message: string): void;
  onAsk(): void;
}

type EntryInput = Entry extends infer E ? (E extends Entry ? Omit<E, "id"> : never) : never;

const VERBS: Record<string, string> = { Bash: "Running", Grep: "Searching" };
const SECONDS_PER_TICK = 2;

export class AgentRunner {
  private run = 0;
  private skipNext = false;
  private planEntryId: number | null = null;
  private resolveAsk: ((answer: AskAnswer) => void) | null = null;

  constructor(
    private host: AgentHost,
    private spec: AgentSpec,
  ) {}

  get isAsking() {
    return this.resolveAsk !== null;
  }

  answer(answer: AskAnswer) {
    this.resolveAsk?.(answer);
  }

  pressYes() {
    this.patchEntries((entry) =>
      entry.kind === "ask" && !entry.answer ? { ...entry, pressed: true } : entry,
    );
  }

  async start(): Promise<void> {
    const run = ++this.run;
    this.skipNext = false;
    this.planEntryId = null;
    this.host.update((terminal) => ({
      ...terminal,
      entries: [],
      seconds: 0,
      tokens: 800,
      verb: "Starting",
    }));
    this.add({
      kind: "banner",
      title: CLIS[this.spec.cli].title,
      path: `~/shop/.yien/${this.host.read().branch.replace("/", "-")}`,
    });
    this.host.setStatus("working");
    void this.tickMeter(run);

    await this.host.clock.sleep(this.spec.delay ?? 0);
    for (const step of this.spec.script) {
      if (this.skipNext) {
        this.skipNext = false;
        continue;
      }
      await this.perform(step);
      if ("completes" in step && step.completes !== undefined) this.completeTask(step.completes);
      if (this.host.clock.fast) {
        this.host.update((t) => ({ ...t, seconds: t.seconds + 14, tokens: t.tokens + 1300 }));
      }
    }
    this.host.setStatus("done");
  }

  /* Whatever you type gets an answer in the agent's own scrollback. */
  async submit(text: string): Promise<void> {
    this.add({ kind: "prompt", text });
    const { status } = this.host.read();
    if (text === "/clear") {
      this.host.update((terminal) => ({ ...terminal, entries: [] }));
    } else if (text === "/help") {
      this.say("/clear wipes this scrollback. Anything else goes to the agent.");
    } else if (status === "asking") {
      this.say("Answer the question above first, and I'll pick this up after.");
    } else if (status === "working") {
      this.say("Got it. I'll do that after this step.");
    } else {
      this.setVerb("Thinking");
      this.host.setStatus("working");
      await this.host.clock.sleep(1500);
      this.say("Done. Nothing else needed changing on this branch.");
      this.host.setStatus("done");
    }
  }

  private perform(step: Step): Promise<void> {
    switch (step.type) {
      case "prompt":
        return this.prompt(step.text);
      case "think":
        return this.think(step.text);
      case "plan":
        return this.plan(step.tasks);
      case "tool":
        return this.tool(step);
      case "edit":
        return this.edit(step);
      case "progress":
        return this.progress(step);
      case "ask":
        return this.ask(step);
      case "commit":
        return this.commit(step);
      case "message":
        return this.message(step.text);
    }
  }

  /* The prompt is typed where you'd type it, then sent. */
  private async prompt(text: string) {
    if (!this.host.read().draftFocused) {
      await this.stream(text, 1, 3, (shown) => this.setDraft(shown));
      await this.host.clock.sleep(380);
      if (!this.host.read().draftFocused) this.setDraft("");
    }
    this.add({ kind: "prompt", text });
    this.setVerb("Thinking");
    await this.host.clock.sleep(350);
  }

  private async think(text: string) {
    this.setVerb("Thinking");
    this.add({ kind: "think", text });
    await this.host.clock.sleep(1100);
  }

  private async plan(tasks: string[]) {
    this.planEntryId = this.add({
      kind: "plan",
      tasks: tasks.map((task) => ({ text: task, done: false })),
    });
    await this.host.clock.sleep(650);
  }

  private async tool(step: Extract<Step, { type: "tool" }>) {
    this.setVerb(VERBS[step.name] ?? "Reading");
    const id = this.add({ kind: "tool", name: step.name, arg: step.arg, running: true });
    await this.host.clock.sleep(450 + Math.min(step.ms, 1400) * 0.6 + Math.random() * 300);
    this.finishTool(id, step.result);
    await this.host.clock.sleep(220);
  }

  private async edit(step: Extract<Step, { type: "edit" }>) {
    this.setVerb("Editing");
    const name = step.status === "A" ? "Write" : "Edit";
    const id = this.add({ kind: "tool", name, arg: step.file, running: true });
    await this.host.clock.sleep(700 + Math.random() * 400);
    this.finishTool(id, `+${step.add} −${step.del}`, step.lines);
    this.host.addChange(step);
    await this.host.clock.sleep(650);
  }

  private async progress(step: Extract<Step, { type: "progress" }>) {
    this.setVerb("Running");
    const id = this.add({
      kind: "tool",
      name: step.name,
      arg: step.arg,
      running: true,
      progress: { current: 0, total: step.total },
    });
    const parts = 30;
    for (let part = 1; part <= parts && !this.host.clock.fast; part++) {
      await this.host.clock.sleep(step.duration / parts);
      const current = Math.round((step.total * part) / parts);
      this.patchEntry<"tool">(id, (entry) => ({
        ...entry,
        progress: { current, total: step.total },
      }));
    }
    this.finishTool(id, step.result);
    await this.host.clock.sleep(260);
  }

  private async ask(step: Extract<Step, { type: "ask" }>) {
    const id = this.add({ kind: "ask", text: step.text, cmd: step.cmd });
    this.host.setStatus("asking");
    const answer = await new Promise<AskAnswer>((resolve) => {
      this.resolveAsk = resolve;
      this.host.onAsk();
    });
    this.resolveAsk = null;
    this.patchEntry<"ask">(id, (entry) => ({ ...entry, answer }));
    this.host.setStatus("working");
    if (answer === "deny") {
      this.say(step.denied);
      this.skipNext = true;
    }
    await this.host.clock.sleep(350);
  }

  private async commit(step: Extract<Step, { type: "commit" }>) {
    this.setVerb("Committing");
    const id = this.add({
      kind: "tool",
      name: "Bash",
      arg: `git commit -m "${step.message}"`,
      running: true,
    });
    await this.host.clock.sleep(500);
    this.finishTool(id, step.hash);
    this.host.addCommit(step.hash, step.message);
    await this.host.clock.sleep(320);
  }

  private async message(text: string) {
    const id = this.add({ kind: "message", text: "" });
    this.setVerb("Writing");
    await this.stream(text, 3, 4, (shown) =>
      this.patchEntry<"message">(id, (entry) => ({ ...entry, text: shown })),
    );
  }

  private async stream(text: string, min: number, spread: number, write: (shown: string) => void) {
    if (!this.host.clock.fast) {
      for (let i = 0; i < text.length; i += min + Math.floor(Math.random() * spread)) {
        write(text.slice(0, i));
        await this.host.clock.sleep(TICK_MS);
      }
    }
    write(text);
  }

  private async tickMeter(run: number) {
    if (this.host.clock.fast) return;
    while (this.run === run && this.host.read().status !== "done") {
      await this.host.clock.sleep(1000);
      if (this.run !== run || this.host.read().status !== "working") continue;
      this.host.update((terminal) => ({
        ...terminal,
        seconds: terminal.seconds + SECONDS_PER_TICK,
        tokens: terminal.tokens + 90 + Math.floor(Math.random() * 420),
      }));
    }
  }

  private add(entry: EntryInput): number {
    const id = this.host.nextEntryId();
    this.host.update((terminal) => ({
      ...terminal,
      entries: [...terminal.entries, { ...entry, id } as Entry],
    }));
    return id;
  }

  private say(text: string) {
    this.add({ kind: "message", text });
  }

  private setVerb(verb: string) {
    this.host.update((terminal) => ({ ...terminal, verb }));
  }

  private setDraft(draft: string) {
    this.host.update((terminal) => ({ ...terminal, draft }));
  }

  private finishTool(id: number, result: string, diff?: string[]) {
    this.patchEntry<"tool">(id, (entry) => ({
      ...entry,
      running: false,
      progress: undefined,
      result,
      diff,
    }));
  }

  private completeTask(index: number) {
    if (this.planEntryId === null) return;
    this.patchEntry<"plan">(this.planEntryId, (entry) => ({
      ...entry,
      tasks: entry.tasks.map((task, i) => (i === index ? { ...task, done: true } : task)),
    }));
  }

  private patchEntry<K extends Entry["kind"]>(
    id: number,
    patch: (entry: EntryOf<K>) => EntryOf<K>,
  ) {
    this.patchEntries((entry) => (entry.id === id ? patch(entry as EntryOf<K>) : entry));
  }

  private patchEntries(patch: (entry: Entry) => Entry) {
    this.host.update((terminal) => ({ ...terminal, entries: terminal.entries.map(patch) }));
  }
}
