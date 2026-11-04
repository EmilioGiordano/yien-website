const FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
const FRAME_MS = 80;

export const FIRST_FRAME = FRAMES[0];

const nodes = new Set<HTMLElement>();
let timer: ReturnType<typeof setInterval> | undefined;
let frame = 0;

/* One shared timer writes to the DOM directly, so spinners never cause a render. */
export function spin(node: HTMLElement): () => void {
  node.textContent = FIRST_FRAME;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  nodes.add(node);
  timer ??= setInterval(() => {
    if (document.hidden) return;
    frame = (frame + 1) % FRAMES.length;
    nodes.forEach((spinning) => (spinning.textContent = FRAMES[frame]));
  }, FRAME_MS);
  return () => {
    nodes.delete(node);
    if (nodes.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
