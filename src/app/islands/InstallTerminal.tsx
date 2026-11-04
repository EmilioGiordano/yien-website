import { useState } from "preact/hooks";
import type { Platform } from "../../data/platforms";
import { Simulation } from "../../sim/simulation";
import { AppWindow } from "../AppWindow";

export function InstallTerminal({ platform }: { platform: Platform }) {
  const [sim] = useState(
    () =>
      new Simulation([
        {
          name: "install",
          layout: 1,
          files: ["README.md", "package.json"],
          commits: [],
          terminals: [
            {
              kind: "shell",
              pinned: true,
              command: platform.command,
              output: platform.output,
            },
          ],
        },
      ]),
  );
  return (
    <AppWindow
      sim={sim}
      variant="install"
      label={`A terminal installing YIEN on ${platform.os}. You can type in it.`}
    />
  );
}
