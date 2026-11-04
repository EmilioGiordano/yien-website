import { describe, expect, it } from "vitest";
import { Simulation } from "./simulation";
import type { WorkspaceSpec } from "./types";

const spec: WorkspaceSpec = {
  name: "test",
  files: [],
  commits: [],
  terminals: [
    {
      kind: "agent",
      cli: "claude",
      task: "Commit once",
      script: [{ type: "commit", hash: "abc1234", message: "Do the thing" }],
    },
  ],
};

const settle = () => new Promise((resolve) => setTimeout(resolve));

describe("Simulation", () => {
  it("runs its scripts once, however many times it is started", async () => {
    const sim = new Simulation([spec], { still: true });
    sim.start();
    sim.stop();
    sim.start();
    await settle();
    sim.stop();

    const { commits } = sim.getState().workspaces[0].git;
    expect(commits.filter((commit) => commit.hash === "abc1234")).toHaveLength(1);
  });

  it("splits into as many terminals as you ask for", () => {
    const sim = new Simulation([spec], { still: true });
    const wsId = sim.getState().workspaces[0].id;
    for (let split = 0; split < 11; split++) sim.splitTerminal(wsId);

    const ws = sim.getState().workspaces[0];
    expect(ws.terminals).toHaveLength(12);
    expect(ws.layout).toBe(12);
  });
});
