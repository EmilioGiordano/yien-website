import { describe, expect, it } from "vitest";
import { paneGrid } from "./paneGrid";

describe("paneGrid", () => {
  it.each([
    [1, 1, 1, 1],
    [2, 2, 1, 1],
    [3, 2, 2, 2],
    [4, 2, 2, 1],
    [5, 3, 2, 2],
    [6, 3, 2, 1],
    [7, 3, 3, 3],
    [9, 3, 3, 1],
  ])("lays out %i panes in %i columns and %i rows", (panes, columns, rows, firstPaneRows) => {
    expect(paneGrid(panes)).toEqual({ columns, rows, firstPaneRows });
  });

  it("fills every cell, however many panes there are", () => {
    for (let panes = 1; panes <= 40; panes++) {
      const { columns, rows, firstPaneRows } = paneGrid(panes);
      expect(firstPaneRows).toBeLessThanOrEqual(rows);
      expect(panes - 1 + firstPaneRows).toBe(columns * rows);
    }
  });
});
