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
});
