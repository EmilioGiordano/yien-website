import { useState } from "preact/hooks";
import { installWorkspaces } from "../../data/workspaces";
import { Simulation } from "../../sim/simulation";
import { AppWindow } from "../AppWindow";

export function InstallTerminal() {
  const [sim] = useState(() => new Simulation(installWorkspaces));
  return (
    <AppWindow
      sim={sim}
      variant="install"
      label="A terminal installing YIEN. You can type in it."
    />
  );
}
