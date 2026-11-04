import { useEffect, useRef, useState } from "preact/hooks";
import { fileContents } from "../../data/fileContents";
import { heroWorkspaces } from "../../data/workspaces";
import { Simulation } from "../../sim/simulation";
import { TERMINALS_SURFACE, type PanelView } from "../../sim/types";
import { AppWindow } from "../AppWindow";
import styles from "./GitDemo.module.css";

const VIEWS: { id: PanelView; title: string; text: string }[] = [
  {
    id: "files",
    title: "Files",
    text: "The whole tree, with what's been touched marked. Open a file and edit it yourself.",
  },
  {
    id: "changes",
    title: "Changes",
    text: "What's on this branch and not committed yet. Open a diff, then commit it from here.",
  },
  {
    id: "graph",
    title: "Graph",
    text: "Every commit on every branch in the tab. Open one to read what it did. Work waiting on your answer shows up in red.",
  },
  {
    id: "branches",
    title: "Branches",
    text: "One per agent, each in its own worktree. Pick one and the panel follows it.",
  },
];
const FIRST_VIEW: PanelView = "graph";
const CYCLE_MS = 6000;

/* Each view also opens what you'd reach for from it. */
function showView(sim: Simulation, view: PanelView) {
  const ws = sim.getState().workspaces[0];
  const waiting = ws.git.agents.find((agent) => agent.status === "asking");
  if (waiting) sim.selectBranch(ws.id, waiting.branch);
  sim.setPanelView(view);
  if (view === "graph") {
    const commit = ws.git.commits.find((c) => c.branch !== "main");
    if (commit) sim.openCommit(ws.id, commit);
  } else if (view === "changes") {
    const file = waiting && ws.git.changes[waiting.branch]?.[0];
    if (file) sim.openDiff(ws.id, file);
  } else if (view === "files") {
    sim.openFile(ws.id, "src/cart/coupon.ts");
  } else {
    sim.showSurface(ws.id, TERMINALS_SURFACE);
  }
}

export function GitDemo() {
  const [sim] = useState(
    () =>
      new Simulation(heroWorkspaces.slice(0, 1), {
        panelView: FIRST_VIEW,
        fileContents,
        still: true,
      }),
  );
  const [view, setView] = useState(FIRST_VIEW);
  const root = useRef<HTMLDivElement>(null);
  const picked = useRef(false);

  const select = (next: PanelView) => {
    setView(next);
    showView(sim, next);
  };

  useEffect(() => {
    // the script settles in microtasks, so it's done by the next task
    const settle = setTimeout(() => select(FIRST_VIEW));
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => clearTimeout(settle);

    let visible = false;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(root.current!);
    let index = VIEWS.findIndex(({ id }) => id === FIRST_VIEW);
    const timer = setInterval(() => {
      if (picked.current || !visible || document.hidden) return;
      index = (index + 1) % VIEWS.length;
      select(VIEWS[index].id);
    }, CYCLE_MS);
    return () => {
      clearTimeout(settle);
      clearInterval(timer);
      observer.disconnect();
    };
  }, [sim]);

  return (
    <div
      ref={root}
      onPointerDownCapture={() => {
        picked.current = true;
      }}
    >
      <div class={styles.nav} role="group" aria-label="The right panel's views">
        {VIEWS.map(({ id, title, text }) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => select(id)}>
            <b>{title}</b>
            <span>{text}</span>
          </button>
        ))}
      </div>
      <AppWindow
        sim={sim}
        variant="review"
        label="The YIEN window with its code, diff and commit tabs in the center and the Git panel on the right. The buttons above switch between its views."
      />
    </div>
  );
}
