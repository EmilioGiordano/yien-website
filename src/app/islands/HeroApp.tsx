import { useState } from "preact/hooks";
import { fileContents } from "../../data/fileContents";
import { heroWorkspaces } from "../../data/workspaces";
import { Simulation } from "../../sim/simulation";
import { AppWindow } from "../AppWindow";

export function HeroApp() {
  const [sim] = useState(() => new Simulation(heroWorkspaces, { fileContents, driver: true }));
  return (
    <AppWindow
      sim={sim}
      variant="hero"
      label="The YIEN window: tabs of coding agents at work in split terminals, with a panel for files and Git. Tabs can be opened, terminals can be typed in, and requests can be answered."
    />
  );
}
