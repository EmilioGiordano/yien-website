import type { Commit, GitState } from "./types";

export const GRAPH_ROW_HEIGHT = 38;
const MAIN_X = 12;
const LANE_GAP = 14;

export type GraphRow =
  | { kind: "commit"; branch: string; title: string; author: string; text: string; commit: Commit }
  | { kind: "pending"; branch: string; title: string; text: string; asking: boolean };

export interface GraphLine {
  d: string;
  asking: boolean;
}

export interface GraphNode {
  x: number;
  y: number;
  kind: "commit" | "pending" | "asking";
}

export interface Graph {
  rows: GraphRow[];
  lines: GraphLine[];
  nodes: GraphNode[];
  width: number;
  height: number;
}

const shortName = (branch: string) => branch.split("/").pop() ?? branch;
const rowY = (index: number) => index * GRAPH_ROW_HEIGHT + GRAPH_ROW_HEIGHT / 2;

/* Waiting agents and uncommitted work on top, then every commit, with one lane per branch. */
export function buildGraph(git: GitState): Graph {
  const rows: GraphRow[] = [];
  for (const agent of git.agents) {
    const asking = agent.status === "asking";
    const count = git.changes[agent.branch]?.length ?? 0;
    if (!asking && !count) continue;
    rows.push({
      kind: "pending",
      branch: agent.branch,
      title: shortName(agent.branch),
      text: asking ? "Waiting on you" : `${count} uncommitted ${count === 1 ? "file" : "files"}`,
      asking,
    });
  }
  for (const commit of git.commits) {
    rows.push({
      kind: "commit",
      branch: commit.branch,
      title: commit.hash,
      author: shortName(commit.branch),
      text: commit.message,
      commit,
    });
  }

  const lanes = new Map<string, number>([["main", MAIN_X]]);
  for (const { branch } of rows) {
    if (!lanes.has(branch)) lanes.set(branch, MAIN_X + lanes.size * LANE_GAP);
  }

  const base = rowY(rows.length - 1);
  const height = rows.length * GRAPH_ROW_HEIGHT;
  const lines: GraphLine[] = [{ d: `M${MAIN_X} 0V${height}`, asking: false }];
  for (const [branch, x] of lanes) {
    if (branch === "main") continue;
    const top = rows.findIndex((row) => row.branch === branch);
    const first = rows[top];
    lines.push({
      d: `M${x} ${rowY(top)}V${base - 26}C${x} ${base - 8} ${MAIN_X} ${base - 14} ${MAIN_X} ${base}`,
      asking: first.kind === "pending" && first.asking,
    });
  }

  const nodes = rows.map((row, index): GraphNode => {
    const position = { x: lanes.get(row.branch)!, y: rowY(index) };
    if (row.kind === "commit") return { ...position, kind: "commit" };
    return { ...position, kind: row.asking ? "asking" : "pending" };
  });

  return { rows, lines, nodes, width: MAIN_X + lanes.size * LANE_GAP + 2, height };
}
