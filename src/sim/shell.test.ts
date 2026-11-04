import { describe, expect, it } from "vitest";
import { runShellCommand } from "./shell";
import type { GitState } from "./types";

const git: GitState = {
  branch: "main",
  commits: [{ hash: "abc1234", message: "First", branch: "main", files: [] }],
  changes: {},
  agents: [{ terminalId: "t1", cli: "codex", branch: "tab/codex", status: "working" }],
  freshPath: null,
};

describe("runShellCommand", () => {
  it("lists top-level entries once", () => {
    expect(runShellCommand("ls", ["src/a.ts", "src/b.ts", "package.json"], git)).toEqual([
      "package.json",
      "src",
    ]);
  });

  it("answers from the tab's git state", () => {
    expect(runShellCommand("git log", [], git)).toEqual(["abc1234 First"]);
    expect(runShellCommand("git branch", [], git)).toEqual(["* main", "  tab/codex"]);
  });

  it("says when it doesn't know a command", () => {
    expect(runShellCommand("nope --flag", [], git)).toEqual(["zsh: command not found: nope"]);
  });
});
