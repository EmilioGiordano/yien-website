export const TICK_MS = 40;

interface Sleeper {
  at: number;
  wake: () => void;
}

/* Time only passes while the window is on screen, so no agent finishes unseen. */
export class Clock {
  fast = false;
  awake = false;
  private now = 0;
  private sleepers: Sleeper[] = [];

  sleep(ms: number): Promise<void> {
    if (this.fast) return Promise.resolve();
    return new Promise((wake) => this.sleepers.push({ at: this.now + ms, wake }));
  }

  advance(ms: number): void {
    if (!this.awake) return;
    this.now += ms;
    const due = this.sleepers.filter((sleeper) => sleeper.at <= this.now);
    this.sleepers = this.sleepers.filter((sleeper) => sleeper.at > this.now);
    due.forEach((sleeper) => sleeper.wake());
  }
}

const clocks = new Set<Clock>();
let timer: ReturnType<typeof setInterval> | undefined;

export function attachClock(clock: Clock): () => void {
  clocks.add(clock);
  timer ??= setInterval(() => {
    if (!document.hidden) clocks.forEach((attached) => attached.advance(TICK_MS));
  }, TICK_MS);
  return () => {
    clocks.delete(clock);
    if (clocks.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
