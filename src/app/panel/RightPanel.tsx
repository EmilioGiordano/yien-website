import { PANEL_VIEWS, type Simulation } from "../../sim/simulation";
import type { PanelView, Workspace } from "../../sim/types";
import { useSim } from "../useSim";
import { BranchesView } from "./BranchesView";
import { ChangesView } from "./ChangesView";
import { FilesView } from "./FilesView";
import { GraphView } from "./GraphView";
import styles from "./RightPanel.module.css";

const LABELS: Record<PanelView, string> = {
  files: "Files",
  changes: "Changes",
  graph: "Graph",
  branches: "Branches",
};

function View({ sim, ws, view }: { sim: Simulation; ws: Workspace; view: PanelView }) {
  switch (view) {
    case "files":
      return (
        <FilesView sim={sim} wsId={ws.id} files={ws.files} git={ws.git} surface={ws.surface} />
      );
    case "changes":
      return <ChangesView sim={sim} wsId={ws.id} git={ws.git} />;
    case "graph":
      return <GraphView sim={sim} wsId={ws.id} git={ws.git} />;
    case "branches":
      return <BranchesView sim={sim} wsId={ws.id} git={ws.git} />;
  }
}

export function RightPanel({ sim, class: className }: { sim: Simulation; class?: string }) {
  const ws = useSim(sim, (s) => s.workspaces.find((w) => w.id === s.activeId)!);
  const view = useSim(sim, (s) => s.panelView);
  const pending = ws.git.changes[ws.git.branch]?.length ?? 0;

  return (
    <div class={`${styles.panel} ${className ?? ""}`}>
      <button
        type="button"
        class={styles.branch}
        title="Switch branch"
        onClick={() => sim.setPanelView("branches")}
      >
        <span class={styles.branchIcon} />
        <span class={styles.branchName}>{ws.git.branch}</span>
        <span class={styles.branchMore}>▾</span>
      </button>
      <div class={styles.views}>
        {PANEL_VIEWS.map((id) => (
          <button
            key={id}
            type="button"
            class={id === view ? styles.on : ""}
            onClick={() => sim.setPanelView(id)}
          >
            {LABELS[id]}
            {id === "changes" && pending > 0 && <em>{pending}</em>}
          </button>
        ))}
      </div>
      <div class={styles.body}>
        <View sim={sim} ws={ws} view={view} />
      </div>
    </div>
  );
}
