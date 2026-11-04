import { useSyncExternalStore } from "preact/compat";
import type { Simulation } from "../sim/simulation";
import type { SimState } from "../sim/types";

/* Select only what a component shows: state updates keep the identity of what didn't change. */
export function useSim<T>(sim: Simulation, select: (state: SimState) => T): T {
  return useSyncExternalStore(sim.subscribe, () => select(sim.getState()));
}
