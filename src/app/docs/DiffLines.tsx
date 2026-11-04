import styles from "./DiffLines.module.css";

export function DiffLines({ lines, class: className }: { lines: string[]; class?: string }) {
  return (
    <pre class={`${styles.diff} ${className ?? ""}`}>
      {lines.map((line) => (
        <span class={line[0] === "+" ? styles.add : styles.del}>{line}</span>
      ))}
    </pre>
  );
}
