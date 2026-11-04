import { useEffect, useRef } from "preact/hooks";
import { FIRST_FRAME, spin } from "./spinnerFrames";

export function Spinner({ class: className }: { class?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => spin(ref.current!), []);
  return (
    <span ref={ref} class={className}>
      {FIRST_FRAME}
    </span>
  );
}
