import { useEffect, useRef } from "preact/hooks";
import type { Simulation } from "../sim/simulation";
import styles from "./AppWindow.module.css";
import { RightPanel } from "./panel/RightPanel";
import { Sidebar } from "./Sidebar";
import { Stage } from "./Stage";
import { TitleBar } from "./TitleBar";

export type WindowVariant = "hero" | "review" | "splits" | "install";

const FEATURES: Record<WindowVariant, { sidebar: boolean; panel: boolean; paper: boolean }> = {
  hero: { sidebar: true, panel: true, paper: false },
  review: { sidebar: false, panel: true, paper: true },
  splits: { sidebar: false, panel: false, paper: false },
  install: { sidebar: false, panel: false, paper: false },
};

interface Props {
  sim: Simulation;
  variant: WindowVariant;
  label: string;
}

export function AppWindow({ sim, variant, label }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const { sidebar, panel, paper } = FEATURES[variant];

  useEffect(() => {
    sim.start();
    const observer = new IntersectionObserver(([entry]) => {
      sim.clock.awake = entry.isIntersecting;
    });
    observer.observe(root.current!);
    return () => {
      observer.disconnect();
      sim.stop();
    };
  }, [sim]);

  const handOver = (event: PointerEvent) => {
    if ((event.target as Element).closest("button, input, textarea")) sim.markTouched();
  };

  return (
    <div
      ref={root}
      class={`${styles.window} ${styles[variant]} ${paper ? styles.paper : ""}`}
      role="group"
      aria-label={label}
      onPointerDownCapture={handOver}
    >
      <TitleBar sim={sim} />
      <div class={styles.body}>
        {sidebar && <Sidebar sim={sim} />}
        <Stage sim={sim} withTabs={panel} splittable={panel} />
        {panel && <RightPanel sim={sim} class={styles.panel} />}
      </div>
    </div>
  );
}
