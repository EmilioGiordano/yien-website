import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";
import type { Simulation } from "../../sim/simulation";
import type { Entry, EntryOf } from "../../sim/types";
import { DiffLines } from "../docs/DiffLines";
import { Spinner } from "../Spinner";
import styles from "./Scrollback.module.css";

function ToolEntry({ entry }: { entry: EntryOf<"tool"> }) {
  const { running, name, arg, progress, result, diff } = entry;
  const shown = (n: number) => n.toLocaleString("en-US");
  return (
    <div class={styles.tool}>
      <p class={styles.call}>
        <span class={styles.toolGlyph}>{running ? <Spinner /> : "●"}</span>
        <b>{name}</b>
        <span class={styles.arg}>{arg}</span>
        {progress && (
          <span class={styles.count}>
            {shown(progress.current)}/{shown(progress.total)}
          </span>
        )}
      </p>
      {progress && (
        <span class={styles.bar}>
          <i style={{ width: `${(progress.current / progress.total) * 100}%` }} />
        </span>
      )}
      {result && <p class={styles.out}>└ {result}</p>}
      {diff && <DiffLines lines={diff} class={styles.diff} />}
    </div>
  );
}

function AskEntry({
  entry,
  terminalId,
  sim,
}: {
  entry: EntryOf<"ask">;
  terminalId: string;
  sim: Simulation;
}) {
  const { answer, pressed, text, cmd } = entry;
  return (
    <div class={`${styles.ask} ${answer ? styles.answered : ""}`}>
      <p class={styles.askText}>{text}</p>
      <code>{cmd}</code>
      {answer ? (
        <p class={styles.said}>└ {answer === "allow" ? "Allowed" : "Denied"} by you</p>
      ) : (
        <div class={styles.options}>
          <button
            type="button"
            class={`${styles.option} ${styles.yes} ${pressed ? styles.pressed : ""}`}
            onClick={() => sim.answerAsk(terminalId, "allow")}
          >
            1. Yes
          </button>
          <button
            type="button"
            class={styles.option}
            onClick={() => sim.answerAsk(terminalId, "allow")}
          >
            2. Yes, and don't ask again
          </button>
          <button
            type="button"
            class={styles.option}
            onClick={() => sim.answerAsk(terminalId, "deny")}
          >
            3. No, do something else
          </button>
        </div>
      )}
    </div>
  );
}

function EntryView({
  entry,
  terminalId,
  sim,
}: {
  entry: Entry;
  terminalId: string;
  sim: Simulation;
}) {
  switch (entry.kind) {
    case "banner":
      return (
        <div class={styles.banner}>
          <b>{entry.title}</b>
          <span>{entry.path}</span>
        </div>
      );
    case "prompt":
      return <p class={styles.prompt}>❯ {entry.text}</p>;
    case "think":
      return <p class={styles.think}>✻ {entry.text}</p>;
    case "plan":
      return (
        <ul class={styles.plan}>
          {entry.tasks.map((task) => (
            <li class={task.done ? styles.done : ""}>{task.text}</li>
          ))}
        </ul>
      );
    case "tool":
      return <ToolEntry entry={entry} />;
    case "ask":
      return <AskEntry entry={entry} terminalId={terminalId} sim={sim} />;
    case "message":
      return <p class={styles.message}>{entry.text}</p>;
    case "command":
      return <p class={styles.command}>{entry.text}</p>;
    case "output":
      return <p class={styles.output}>{entry.text}</p>;
  }
}

interface Props {
  entries: Entry[];
  terminalId: string;
  sim: Simulation;
  shell?: boolean;
  children?: ComponentChildren;
}

export function Scrollback({ entries, terminalId, sim, shell, children }: Props) {
  const log = useRef<HTMLDivElement>(null);
  const follow = () => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  };

  useLayoutEffect(follow, [entries]);
  useEffect(() => {
    const observer = new ResizeObserver(follow);
    observer.observe(log.current!);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={log} class={`${styles.log} ${shell ? styles.shell : ""}`}>
      {entries.map((entry) => (
        <EntryView key={entry.id} entry={entry} terminalId={terminalId} sim={sim} />
      ))}
      {children}
    </div>
  );
}
