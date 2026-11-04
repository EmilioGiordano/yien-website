import type { Step, WorkspaceSpec } from "../sim/types";

function stepText(step: Step): string[] {
  switch (step.type) {
    case "prompt":
      return [`> ${step.text}`];
    case "think":
    case "message":
      return [step.text];
    case "plan":
      return step.tasks.map((task) => `[ ] ${task}`);
    case "tool":
    case "progress":
      return [`${step.name}(${step.arg}) ${step.result}`];
    case "edit":
      return [`Edit(${step.file}) +${step.add} -${step.del}`, ...step.lines];
    case "ask":
      return [step.text, `$ ${step.cmd}`];
    case "commit":
      return [`${step.hash} ${step.message}`];
  }
}

/** Everything each agent prints, run together. One string per agent. */
export function agentTranscripts(workspaces: WorkspaceSpec[]): string[] {
  return workspaces
    .flatMap((workspace) => workspace.terminals)
    .flatMap((terminal) =>
      terminal.kind === "agent" ? [terminal.script.flatMap(stepText).join("  ")] : [],
    );
}

/** Cuts text into rows of exactly `width` characters, dropping the unfinished last row. */
export function toRows(text: string, width: number): string[] {
  return Array.from({ length: Math.floor(text.length / width) }, (_, row) =>
    text.slice(row * width, (row + 1) * width),
  );
}
