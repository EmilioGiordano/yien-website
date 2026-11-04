import type { Simulation } from "../sim/simulation";
import { TERMINALS_SURFACE, type Workspace } from "../sim/types";
import styles from "./CenterTabs.module.css";

export function CenterTabs({ sim, ws }: { sim: Simulation; ws: Workspace }) {
  const tabClass = (id: string) => `${styles.tab} ${ws.surface === id ? styles.on : ""}`;
  return (
    <div class={styles.tabs}>
      <span class={tabClass(TERMINALS_SURFACE)}>
        <button type="button" onClick={() => sim.showSurface(ws.id, TERMINALS_SURFACE)}>
          Terminals {ws.terminals.length}
        </button>
      </span>
      {ws.docs.map((doc) => {
        const dirty = doc.kind === "file" && doc.text !== doc.savedText;
        return (
          <span key={doc.id} class={tabClass(doc.id)}>
            <button type="button" onClick={() => sim.showSurface(ws.id, doc.id)}>
              {dirty ? `● ${doc.title}` : doc.title}
            </button>
            <button
              type="button"
              class={styles.close}
              aria-label={`Close ${doc.title}`}
              onClick={() => sim.closeDoc(ws.id, doc.id)}
            >
              ×
            </button>
          </span>
        );
      })}
    </div>
  );
}
