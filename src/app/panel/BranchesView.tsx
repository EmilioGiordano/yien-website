import type { Simulation } from "../../sim/simulation";
import type { AgentInfo, GitState } from "../../sim/types";
import styles from "./BranchesView.module.css";

interface Props {
  sim: Simulation;
  wsId: string;
  git: GitState;
}

function describeAgent(agent: AgentInfo, git: GitState) {
  const ahead = git.commits.filter((commit) => commit.branch === agent.branch).length;
  const changed = git.changes[agent.branch]?.length ?? 0;
  const state = { asking: "needs you", done: "done", working: `${agent.cli} working` }[
    agent.status
  ];
  return [`${ahead} ahead`, changed ? `${changed} changed` : null, state]
    .filter(Boolean)
    .join(", ");
}

export function BranchesView({ sim, wsId, git }: Props) {
  const rows = [
    ...git.agents.map((agent) => ({
      name: agent.branch,
      detail: describeAgent(agent, git),
      asking: agent.status === "asking",
    })),
    { name: "main", detail: "base branch, no worktree", asking: false },
  ];

  return (
    <ul>
      {rows.map(({ name, detail, asking }) => (
        <li key={name}>
          <button
            type="button"
            class={[styles.row, name === git.branch && styles.current, asking && styles.asking]
              .filter(Boolean)
              .join(" ")}
            onClick={() => sim.selectBranch(wsId, name)}
          >
            <b>{name}</b>
            <span>{detail}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
