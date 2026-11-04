export type CliId = "claude" | "codex" | "agy" | "opencode" | "aider";
export type AgentStatus = "working" | "asking" | "done";
export type AskAnswer = "allow" | "deny";
export type PanelView = "files" | "changes" | "graph" | "branches";
export type ChangeStatus = "A" | "M";

export interface FileChange {
  path: string;
  status: ChangeStatus;
  add: number;
  del: number;
  lines: string[];
}

export interface Commit {
  hash: string;
  message: string;
  branch: string;
  files: FileChange[];
}

/* ---------- Scripts: what the agents are told to do ---------- */

export type Step =
  | { type: "prompt"; text: string }
  | { type: "think"; text: string }
  | { type: "plan"; tasks: string[] }
  | { type: "tool"; name: string; arg: string; result: string; ms: number; completes?: number }
  | {
      type: "edit";
      file: string;
      status: ChangeStatus;
      add: number;
      del: number;
      lines: string[];
      completes?: number;
    }
  | {
      type: "progress";
      name: string;
      arg: string;
      total: number;
      result: string;
      duration: number;
      completes?: number;
    }
  | { type: "ask"; text: string; cmd: string; denied: string }
  | { type: "commit"; hash: string; message: string }
  | { type: "message"; text: string };

export interface AgentSpec {
  kind: "agent";
  cli: CliId;
  task: string;
  delay?: number;
  script: Step[];
}

export interface ShellSpec {
  kind: "shell";
  detail?: string;
  pinned?: boolean;
  delay?: number;
  command?: string;
  output?: string[];
}

export type TerminalSpec = AgentSpec | ShellSpec;

export interface WorkspaceSpec {
  name: string;
  layout?: number;
  delay?: number;
  pause?: number;
  files: string[];
  commits: { hash: string; message: string }[];
  terminals: TerminalSpec[];
}

/* ---------- State: what the window shows ---------- */

export type Entry = { id: number } & (
  | { kind: "banner"; title: string; path: string }
  | { kind: "prompt"; text: string }
  | { kind: "think"; text: string }
  | { kind: "plan"; tasks: { text: string; done: boolean }[] }
  | {
      kind: "tool";
      name: string;
      arg: string;
      running: boolean;
      result?: string;
      progress?: { current: number; total: number };
      diff?: string[];
    }
  | { kind: "ask"; text: string; cmd: string; answer?: AskAnswer; pressed?: boolean }
  | { kind: "message"; text: string }
  | { kind: "command"; text: string }
  | { kind: "output"; text: string }
);

export type EntryOf<K extends Entry["kind"]> = Extract<Entry, { kind: K }>;

interface TerminalBase {
  id: string;
  entries: Entry[];
  draft: string;
  draftFocused: boolean;
  autoFocus: boolean;
}

export interface AgentTerminal extends TerminalBase {
  kind: "agent";
  cli: CliId;
  task: string;
  branch: string;
  status: AgentStatus;
  verb: string;
  seconds: number;
  tokens: number;
}

export interface ShellTerminal extends TerminalBase {
  kind: "shell";
  detail: string;
  pinned: boolean;
}

export type Terminal = AgentTerminal | ShellTerminal;

export interface AgentInfo {
  terminalId: string;
  cli: CliId;
  branch: string;
  status: AgentStatus;
}

/* Kept apart from the terminals, so typing in one doesn't redraw the panel. */
export interface GitState {
  branch: string;
  commits: Commit[];
  changes: Record<string, FileChange[]>;
  agents: AgentInfo[];
  freshPath: string | null;
}

export type Doc = { id: string; title: string } & (
  | { kind: "file"; path: string; text: string; savedText: string; autoFocus: boolean }
  | { kind: "diff"; file: FileChange }
  | { kind: "commit"; commit: Commit }
);

export const TERMINALS_SURFACE = "terminals";

export interface Workspace {
  id: string;
  name: string;
  layout: number;
  files: string[];
  terminals: Terminal[];
  git: GitState;
  docs: Doc[];
  surface: string;
  focusedTerminalId: string;
}

export interface SimState {
  workspaces: Workspace[];
  activeId: string;
  panelView: PanelView;
}
