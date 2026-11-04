import { memo } from "preact/compat";
import { useEffect, useRef } from "preact/hooks";
import { CLIS } from "../../sim/agentRunner";
import { SHELL_PROMPT } from "../../sim/shell";
import type { Simulation } from "../../sim/simulation";
import type { AgentTerminal, ShellTerminal, Terminal } from "../../sim/types";
import { Spinner } from "../Spinner";
import { Scrollback } from "./Scrollback";
import styles from "./Panes.module.css";

interface PaneProps<T extends Terminal> {
  sim: Simulation;
  wsId: string;
  terminal: T;
  focused: boolean;
  splittable: boolean;
}

function DraftInput({
  sim,
  wsId,
  terminal,
  label,
  placeholder,
}: {
  sim: Simulation;
  wsId: string;
  terminal: Terminal;
  label: string;
  placeholder?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (terminal.autoFocus) input.current?.focus({ preventScroll: true });
  }, [terminal.autoFocus]);

  return (
    <input
      ref={input}
      class={styles.field}
      type="text"
      spellcheck={false}
      autocomplete="off"
      aria-label={label}
      placeholder={placeholder}
      value={terminal.draft}
      onInput={(event) => sim.setDraft(wsId, terminal.id, event.currentTarget.value)}
      onKeyDown={(event) => event.key === "Enter" && sim.submitDraft(wsId, terminal.id)}
      onFocus={() => {
        sim.setDraftFocused(wsId, terminal.id, true);
        sim.focusTerminal(wsId, terminal.id);
      }}
      onBlur={() => sim.setDraftFocused(wsId, terminal.id, false)}
    />
  );
}

function SplitButton({ sim, wsId }: { sim: Simulation; wsId: string }) {
  return (
    <button
      type="button"
      class={`${styles.headButton} ${styles.split}`}
      title="Split terminal (Ctrl D)"
      aria-label="Split terminal"
      onClick={() => sim.splitTerminal(wsId)}
    />
  );
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function AgentStatusLine({ terminal }: { terminal: AgentTerminal }) {
  const time = formatTime(terminal.seconds);
  if (terminal.status === "done") return <p class={styles.status}>✓ Finished in {time}</p>;
  if (terminal.status === "asking") {
    return <p class={`${styles.status} ${styles.statusAsking}`}>■ Waiting for your answer</p>;
  }
  return (
    <p class={styles.status}>
      <Spinner /> {terminal.verb}… ({time}, esc to stop)
    </p>
  );
}

export const AgentPane = memo(
  ({ sim, wsId, terminal, focused, splittable }: PaneProps<AgentTerminal>) => {
    const asking = terminal.status === "asking";
    return (
      <section
        class={`${styles.pane} ${focused ? styles.focused : ""} ${asking ? styles.asking : ""}`}
        onPointerDown={() => sim.focusTerminal(wsId, terminal.id)}
      >
        <header class={styles.head}>
          <span class={styles.glyph}>
            {terminal.status === "working" ? <Spinner /> : asking ? "■" : "✓"}
          </span>
          <b class={styles.title}>{terminal.cli}</b>
          <span class={styles.detail}>{terminal.task}</span>
          {splittable && <SplitButton sim={sim} wsId={wsId} />}
        </header>
        <Scrollback entries={terminal.entries} terminalId={terminal.id} sim={sim} />
        <AgentStatusLine terminal={terminal} />
        <label class={styles.input}>
          <span class={styles.caret}>❯</span>
          <DraftInput
            sim={sim}
            wsId={wsId}
            terminal={terminal}
            label={`Type to ${terminal.cli}`}
            placeholder={`Message ${terminal.cli}`}
          />
        </label>
        <p class={styles.foot}>
          <span>⏵⏵ {CLIS[terminal.cli].mode}</span>
          <span class={styles.meter}>{(terminal.tokens / 1000).toFixed(1)}k tokens</span>
        </p>
      </section>
    );
  },
);

export const ShellPane = memo(
  ({ sim, wsId, terminal, focused, splittable }: PaneProps<ShellTerminal>) => {
    const pane = useRef<HTMLElement>(null);
    const focusInput = (event: MouseEvent) => {
      if ((event.target as Element).closest("button") || getSelection()?.toString()) return;
      pane.current?.querySelector("input")?.focus({ preventScroll: true });
    };

    return (
      <section
        ref={pane}
        class={`${styles.pane} ${focused ? styles.focused : ""}`}
        onPointerDown={() => sim.focusTerminal(wsId, terminal.id)}
        onClick={focusInput}
      >
        <header class={styles.head}>
          <span class={styles.glyph}>$</span>
          <b class={styles.title}>zsh</b>
          <span class={styles.detail}>{terminal.detail}</span>
          {splittable && <SplitButton sim={sim} wsId={wsId} />}
          {splittable && !terminal.pinned && (
            <button
              type="button"
              class={styles.headButton}
              title="Close terminal"
              aria-label="Close terminal"
              onClick={() => sim.closeTerminal(wsId, terminal.id)}
            >
              ×
            </button>
          )}
        </header>
        <Scrollback entries={terminal.entries} terminalId={terminal.id} sim={sim} shell>
          <label class={styles.shellRow}>
            <span class={styles.prompt}>{SHELL_PROMPT}</span>
            <DraftInput sim={sim} wsId={wsId} terminal={terminal} label="Type a shell command" />
          </label>
        </Scrollback>
      </section>
    );
  },
);
