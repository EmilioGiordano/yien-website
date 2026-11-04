import { useMemo } from "preact/hooks";
import { buildGraph, GRAPH_ROW_HEIGHT, type GraphRow } from "../../sim/graph";
import type { Simulation } from "../../sim/simulation";
import type { GitState } from "../../sim/types";
import styles from "./GraphView.module.css";

interface Props {
  sim: Simulation;
  wsId: string;
  git: GitState;
}

const NODE_CLASS = { commit: styles.commit, pending: styles.pending, asking: styles.waiting };

export function GraphView({ sim, wsId, git }: Props) {
  const graph = useMemo(() => buildGraph(git), [git]);

  const open = (row: GraphRow) => {
    if (row.kind === "commit") sim.openCommit(wsId, row.commit);
    else sim.openPending(wsId, row.branch, row.asking);
  };

  return (
    <div class={styles.graph} style={{ "--rail": `${graph.width}px` }}>
      <svg width={graph.width} height={graph.height} aria-hidden="true">
        {graph.lines.map((line) => (
          <path key={line.d} d={line.d} class={line.asking ? styles.lineWaiting : styles.line} />
        ))}
        {graph.nodes.map((node) => (
          <circle
            key={`${node.x}:${node.y}`}
            cx={node.x}
            cy={node.y}
            r={node.kind === "asking" ? 5 : 4}
            class={NODE_CLASS[node.kind]}
          />
        ))}
      </svg>
      <ul>
        {graph.rows.map((row) => {
          const waiting = row.kind === "pending" && row.asking;
          const classes = [
            styles.row,
            waiting && styles.rowWaiting,
            row.branch === git.branch && styles.current,
          ];
          return (
            <li key={`${row.kind}:${row.title}`}>
              <button
                type="button"
                class={classes.filter(Boolean).join(" ")}
                style={{ height: GRAPH_ROW_HEIGHT }}
                onClick={() => open(row)}
              >
                <span class={styles.head}>
                  <b>{row.title}</b>
                  {row.kind === "commit" && <i>{row.author}</i>}
                </span>
                <span class={styles.text}>{row.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
