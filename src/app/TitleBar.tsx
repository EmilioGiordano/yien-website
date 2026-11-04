import type { Simulation } from "../sim/simulation";
import type { AgentStatus, SimState } from "../sim/types";
import styles from "./TitleBar.module.css";
import { useSim } from "./useSim";

const agentsWith = (status: AgentStatus) => (state: SimState) =>
  state.workspaces.flatMap((ws) => ws.git.agents).filter((agent) => agent.status === status).length;

export function TitleBar({ sim }: { sim: Simulation }) {
  const title = useSim(sim, (s) => s.workspaces.find((ws) => ws.id === s.activeId)!.name);
  const working = useSim(sim, agentsWith("working"));
  const asking = useSim(sim, agentsWith("asking"));

  return (
    <div class={styles.bar}>
      <span class={styles.lights} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span class={styles.title}>{title}</span>
      <span class={styles.count}>
        {working > 0 && `${working} working`}
        {asking > 0 && <b>{`${asking} ${asking === 1 ? "needs" : "need"} you`}</b>}
      </span>
    </div>
  );
}
