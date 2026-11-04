import { useState } from "preact/hooks";
import type { Simulation } from "../../sim/simulation";
import type { GitState } from "../../sim/types";
import styles from "./ChangesView.module.css";

interface Props {
  sim: Simulation;
  wsId: string;
  git: GitState;
}

export function ChangesView({ sim, wsId, git }: Props) {
  const [message, setMessage] = useState("");
  const files = git.changes[git.branch] ?? [];
  const hasAgent = git.agents.some((agent) => agent.branch === git.branch);

  if (!files.length) {
    return (
      <p class={styles.empty}>
        {hasAgent
          ? "Nothing to commit on this branch."
          : "main is clean. Agents work on their own branches."}
      </p>
    );
  }

  const add = files.reduce((total, file) => total + file.add, 0);
  const del = files.reduce((total, file) => total + file.del, 0);
  const commit = (event: SubmitEvent) => {
    event.preventDefault();
    sim.commitChanges(wsId, message.trim());
    setMessage("");
  };

  return (
    <div>
      <p class={styles.sum}>
        {files.length} {files.length === 1 ? "file" : "files"} changed, +{add} −{del}
      </p>
      <ul>
        {files.map((file) => (
          <li key={file.path}>
            <button type="button" class={styles.row} onClick={() => sim.openDiff(wsId, file)}>
              <em>{file.status}</em>
              <span class={styles.name} title={file.path}>
                {file.path.split("/").pop()}
              </span>
              <span class={styles.count}>
                +{file.add} −{file.del}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <form class={styles.commit} onSubmit={commit}>
        <input
          type="text"
          placeholder="Commit message"
          aria-label="Commit message"
          value={message}
          onInput={(event) => setMessage(event.currentTarget.value)}
        />
        <button type="submit">Commit</button>
      </form>
    </div>
  );
}
