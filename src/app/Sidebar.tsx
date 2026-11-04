import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { Simulation } from "../sim/simulation";
import type { Workspace } from "../sim/types";
import styles from "./Sidebar.module.css";
import { Spinner } from "./Spinner";
import { useSim } from "./useSim";

function TabRow({ ws, sim, active }: { ws: Workspace; sim: Simulation; active: boolean }) {
  const asking = ws.git.agents.filter((agent) => agent.status === "asking").length;
  const working = ws.git.agents.filter((agent) => agent.status === "working").length;
  const shellOnly = ws.git.agents.length === 0;

  let glyph = <>✓</>;
  let detail = "Done";
  if (asking) {
    glyph = <>■</>;
    detail = "Needs you";
  } else if (working) {
    glyph = <Spinner />;
    detail = `${working} working`;
  } else if (shellOnly) {
    glyph = <>$</>;
    detail = "Shell";
  }

  return (
    <button
      type="button"
      class={`${styles.row} ${active ? styles.active : ""} ${asking ? styles.asking : ""}`}
      aria-current={active}
      data-asking={asking > 0 || undefined}
      onClick={() => sim.selectWorkspace(ws.id)}
    >
      <span class={styles.glyph}>{glyph}</span>
      <span class={styles.name}>{ws.name}</span>
      <span class={styles.detail}>{detail}</span>
    </button>
  );
}

/* The red thread runs down the window's edge, from the first tab that needs you. */
function useThreadTop(list: { current: HTMLDivElement | null }, askingId: string | undefined) {
  const [top, setTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    const row = list.current?.querySelector("[data-asking]");
    const window = list.current?.closest("[role=group]");
    if (!row || !window) return setTop(null);
    const { top: rowTop, height } = row.getBoundingClientRect();
    setTop(rowTop - window.getBoundingClientRect().top + height / 2);
  }, [askingId]);
  return top;
}

export function Sidebar({ sim }: { sim: Simulation }) {
  const workspaces = useSim(sim, (s) => s.workspaces);
  const activeId = useSim(sim, (s) => s.activeId);
  const list = useRef<HTMLDivElement>(null);
  const firstAsking = workspaces.find((ws) => ws.git.agents.some((a) => a.status === "asking"));
  const threadTop = useThreadTop(list, firstAsking?.id);

  return (
    <div class={styles.side}>
      <p class={styles.label}>Tabs</p>
      <div ref={list} class={styles.tabs}>
        {workspaces.map((ws) => (
          <TabRow key={ws.id} ws={ws} sim={sim} active={ws.id === activeId} />
        ))}
      </div>
      <button type="button" class={styles.newTab} onClick={sim.newWorkspace}>
        <span>New tab</span>
        <kbd>Ctrl T</kbd>
      </button>
      {threadTop !== null && <span class={styles.thread} style={{ top: threadTop }} />}
    </div>
  );
}
