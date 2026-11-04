import { useEffect, useMemo, useRef } from "preact/hooks";
import type { Simulation } from "../../sim/simulation";
import type { Doc, FileChange } from "../../sim/types";
import { DiffLines } from "./DiffLines";
import styles from "./DocView.module.css";
import { highlight } from "./highlight";

function FileDiff({ file }: { file: FileChange }) {
  return (
    <div>
      <p class={styles.path}>{`${file.path}  +${file.add} −${file.del}`}</p>
      <DiffLines lines={file.lines} class={styles.diff} />
    </div>
  );
}

function Editor({
  sim,
  wsId,
  doc,
}: {
  sim: Simulation;
  wsId: string;
  doc: Extract<Doc, { kind: "file" }>;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLPreElement>(null);
  const colored = useRef<HTMLPreElement>(null);
  const tokens = useMemo(() => highlight(doc.path, doc.text), [doc.path, doc.text]);

  useEffect(() => {
    if (doc.autoFocus) area.current?.focus({ preventScroll: true });
  }, [doc.autoFocus]);

  const save = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
    event.preventDefault();
    sim.saveDoc(wsId, doc.id);
  };

  return (
    <div class={styles.editor}>
      <p class={styles.path}>{doc.path}</p>
      <pre ref={gutter} class={styles.gutter}>
        {doc.text
          .split("\n")
          .map((_, index) => index + 1)
          .join("\n")}
      </pre>
      <div class={styles.code}>
        <pre ref={colored} class={styles.colored} aria-hidden="true">
          {tokens.map(({ kind, text }, index) =>
            kind ? (
              <span key={index} class={styles[kind]}>
                {text}
              </span>
            ) : (
              text
            ),
          )}
          {"\n"}
        </pre>
        <textarea
          ref={area}
          class={styles.text}
          spellcheck={false}
          wrap="off"
          aria-label={`Edit ${doc.path}`}
          value={doc.text}
          onInput={(event) => sim.editDoc(wsId, doc.id, event.currentTarget.value)}
          onKeyDown={save}
          onScroll={({ currentTarget: { scrollTop, scrollLeft } }) => {
            gutter.current!.scrollTop = scrollTop;
            colored.current!.scrollTop = scrollTop;
            colored.current!.scrollLeft = scrollLeft;
          }}
        />
      </div>
    </div>
  );
}

interface Props {
  sim: Simulation;
  wsId: string;
  doc: Doc;
  visible: boolean;
}

export function DocView({ sim, wsId, doc, visible }: Props) {
  if (!visible) return null;
  switch (doc.kind) {
    case "file":
      return <Editor sim={sim} wsId={wsId} doc={doc} />;
    case "diff":
      return (
        <div class={styles.doc}>
          <FileDiff file={doc.file} />
        </div>
      );
    case "commit":
      return (
        <div class={styles.doc}>
          <div class={styles.commit}>
            <b>{doc.commit.message}</b>
            <span>
              {doc.commit.hash} on {doc.commit.branch}
            </span>
          </div>
          {doc.commit.files.map((file) => (
            <FileDiff key={file.path} file={file} />
          ))}
          {doc.commit.files.length === 0 && (
            <p class={styles.empty}>This commit came in with the branch.</p>
          )}
        </div>
      );
  }
}
