import { useMemo } from "preact/hooks";
import type { Simulation } from "../../sim/simulation";
import { buildTree, changedFiles } from "../../sim/tree";
import type { GitState } from "../../sim/types";
import styles from "./FilesView.module.css";

interface Props {
  sim: Simulation;
  wsId: string;
  files: string[];
  git: GitState;
  surface: string;
}

export function FilesView({ sim, wsId, files, git, surface }: Props) {
  const rows = useMemo(() => buildTree(files, changedFiles(git)), [files, git]);
  return (
    <ul>
      {rows.map((row) => {
        const indent = { paddingLeft: `${row.depth * 12 + 14}px` };
        if (row.kind === "dir") {
          return (
            <li key={`dir:${row.depth}:${row.name}`}>
              <span class={`${styles.row} ${styles.dir}`} style={indent}>
                {row.name}/
              </span>
            </li>
          );
        }
        const classes = [
          styles.row,
          row.status && styles.changed,
          row.path === git.freshPath && styles.fresh,
          surface === `file:${row.path}` && styles.open,
        ];
        return (
          <li key={row.path}>
            <button
              type="button"
              class={classes.filter(Boolean).join(" ")}
              style={indent}
              onClick={() => sim.openFile(wsId, row.path, true)}
            >
              <span class={styles.name}>{row.name}</span>
              {row.status && <em>{row.status}</em>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
