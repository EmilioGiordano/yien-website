import { memo } from "preact/compat";
import type { Simulation } from "../sim/simulation";
import { paneGrid } from "../sim/paneGrid";
import { TERMINALS_SURFACE, type Workspace } from "../sim/types";
import { CenterTabs } from "./CenterTabs";
import { DocView } from "./docs/DocView";
import { AgentPane, ShellPane } from "./terminal/Panes";
import styles from "./Stage.module.css";
import { useSim } from "./useSim";

interface WorkspaceProps {
  sim: Simulation;
  ws: Workspace;
  active: boolean;
  withTabs: boolean;
  splittable: boolean;
}

const WorkspaceView = memo(({ sim, ws, active, withTabs, splittable }: WorkspaceProps) => {
  const showTerminals = ws.surface === TERMINALS_SURFACE;
  const grid = paneGrid(ws.layout);
  return (
    <div class={styles.workspace} hidden={!active}>
      {withTabs && <CenterTabs sim={sim} ws={ws} />}
      <div
        class={styles.panes}
        data-layout={ws.layout}
        hidden={!showTerminals}
        style={{
          "--columns": grid.columns,
          "--rows": grid.rows,
          "--first-pane-rows": grid.firstPaneRows,
        }}
      >
        {ws.terminals.map((terminal, index) => {
          const pane = {
            sim,
            wsId: ws.id,
            focused: ws.focusedTerminalId === terminal.id,
            splittable,
            hidden: index >= ws.layout,
          };
          return terminal.kind === "agent" ? (
            <AgentPane key={terminal.id} terminal={terminal} {...pane} />
          ) : (
            <ShellPane key={terminal.id} terminal={terminal} {...pane} />
          );
        })}
      </div>
      {!showTerminals && (
        <div class={styles.docs}>
          {ws.docs.map((doc) => (
            <DocView
              key={doc.id}
              sim={sim}
              wsId={ws.id}
              doc={doc}
              visible={doc.id === ws.surface}
            />
          ))}
        </div>
      )}
    </div>
  );
});

interface StageProps {
  sim: Simulation;
  withTabs: boolean;
  splittable: boolean;
}

export function Stage({ sim, withTabs, splittable }: StageProps) {
  const workspaces = useSim(sim, (s) => s.workspaces);
  const activeId = useSim(sim, (s) => s.activeId);
  return (
    <div class={styles.stage}>
      {workspaces.map((ws) => (
        <WorkspaceView
          key={ws.id}
          sim={sim}
          ws={ws}
          active={ws.id === activeId}
          withTabs={withTabs}
          splittable={splittable}
        />
      ))}
    </div>
  );
}
