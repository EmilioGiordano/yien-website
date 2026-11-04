import { describe, expect, it } from "vitest";
import { buildGraph } from "./graph";
import type { FileChange, GitState } from "./types";

const file: FileChange = { path: "a.ts", status: "M", add: 1, del: 0, lines: ["+a"] };

const git = (overrides: Partial<GitState> = {}): GitState => ({
  branch: "tab/claude",
  commits: [{ hash: "base", message: "Base", branch: "main", files: [] }],
  changes: {},
  agents: [{ terminalId: "t1", cli: "claude", branch: "tab/claude", status: "working" }],
  freshPath: null,
  ...overrides,
});

describe("buildGraph", () => {
  it("draws only main while no agent has anything to show", () => {
    const graph = buildGraph(git());
    expect(graph.rows.map((row) => row.title)).toEqual(["base"]);
    expect(graph.lines).toHaveLength(1);
  });

  it("puts uncommitted work above the commits, on its own lane", () => {
    const graph = buildGraph(git({ changes: { "tab/claude": [file] } }));
    expect(graph.rows[0]).toMatchObject({ kind: "pending", text: "1 uncommitted file" });
    expect(graph.lines).toHaveLength(2);
    expect(graph.nodes[0].x).toBeGreaterThan(graph.nodes[1].x);
  });

  it("marks a waiting agent's lane and node", () => {
    const graph = buildGraph(
      git({
        agents: [{ terminalId: "t1", cli: "claude", branch: "tab/claude", status: "asking" }],
      }),
    );
    expect(graph.rows[0]).toMatchObject({ text: "Waiting on you", asking: true });
    expect(graph.nodes[0].kind).toBe("asking");
    expect(graph.lines[1].asking).toBe(true);
  });
});
