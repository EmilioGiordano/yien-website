import { describe, expect, it, vi } from "vitest";
import { Clock } from "./clock";

describe("Clock", () => {
  it("wakes sleepers once enough time has passed", async () => {
    const clock = new Clock();
    clock.awake = true;
    const woken = vi.fn();
    clock.sleep(100).then(woken);

    clock.advance(60);
    await Promise.resolve();
    expect(woken).not.toHaveBeenCalled();

    clock.advance(40);
    await Promise.resolve();
    expect(woken).toHaveBeenCalledOnce();
  });

  it("doesn't pass time while off screen", async () => {
    const clock = new Clock();
    const woken = vi.fn();
    clock.sleep(10).then(woken);

    clock.advance(1000);
    await Promise.resolve();
    expect(woken).not.toHaveBeenCalled();
  });

  it("resolves immediately in fast mode", async () => {
    const clock = new Clock();
    clock.fast = true;
    await expect(clock.sleep(10_000)).resolves.toBeUndefined();
  });
});
