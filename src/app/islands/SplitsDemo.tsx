import { useEffect, useRef, useState } from "preact/hooks";
import { splitsWorkspaces } from "../../data/workspaces";
import { Simulation } from "../../sim/simulation";
import { AppWindow } from "../AppWindow";
import styles from "./SplitsDemo.module.css";

const LAYOUTS = [
  { count: 1, label: "One terminal", icon: styles.grid1 },
  { count: 2, label: "Two terminals", icon: styles.grid2 },
  { count: 3, label: "Three terminals", icon: styles.grid3 },
  { count: 4, label: "Four terminals", icon: styles.grid4 },
  { count: 6, label: "Six terminals", icon: styles.grid6 },
];
const CYCLE_MS = 5200;

export function SplitsDemo() {
  const [sim] = useState(() => new Simulation(splitsWorkspaces));
  const [layout, setLayout] = useState(4);
  const picked = useRef(false);

  useEffect(() => {
    const wsId = sim.getState().activeId;
    sim.setLayout(wsId, layout);
  }, [sim, layout]);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const narrow = matchMedia("(max-width: 760px)").matches;
    const order = narrow ? [1, 2] : LAYOUTS.map(({ count }) => count);
    let index = narrow ? 1 : order.indexOf(4);
    if (narrow) setLayout(2);
    let running = true;
    void (async () => {
      while (running) {
        await sim.clock.sleep(CYCLE_MS);
        if (!running || picked.current) return;
        index = (index + 1) % order.length;
        setLayout(order[index]);
      }
    })();
    return () => {
      running = false;
    };
  }, [sim]);

  return (
    <>
      <div class={styles.bar}>
        <div class={styles.picker} role="group" aria-label="Number of terminals">
          {LAYOUTS.map(({ count, label, icon }) => (
            <button
              key={count}
              type="button"
              data-count={count}
              aria-label={label}
              aria-pressed={layout === count}
              onClick={() => {
                picked.current = true;
                setLayout(count);
              }}
            >
              <i class={icon}>
                {Array.from({ length: count }, (_, cell) => (
                  <b key={cell} />
                ))}
              </i>
            </button>
          ))}
        </div>
        <p class={styles.keys}>
          <kbd>Ctrl D</kbd> split right <kbd>Ctrl Shift D</kbd> split down
        </p>
      </div>
      <AppWindow
        sim={sim}
        variant="splits"
        label="Agents working in split terminals. The buttons above change how many are shown."
      />
    </>
  );
}
