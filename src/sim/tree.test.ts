import { describe, expect, it } from "vitest";
import { buildTree } from "./tree";

describe("buildTree", () => {
  it("lists folders before files, each sorted, at the right depth", () => {
    const rows = buildTree(["package.json", "src/b.ts", "src/a.ts", "docs/x.md"], new Map());
    expect(rows.map((row) => `${row.depth} ${row.name}`)).toEqual([
      "0 docs",
      "1 x.md",
      "0 src",
      "1 a.ts",
      "1 b.ts",
      "0 package.json",
    ]);
  });

  it("marks changed files and adds the ones that are new", () => {
    const rows = buildTree(
      ["a.ts"],
      new Map([
        ["a.ts", "M"],
        ["new.ts", "A"],
      ] as const),
    );
    expect(rows).toEqual([
      { kind: "file", name: "a.ts", depth: 0, path: "a.ts", status: "M" },
      { kind: "file", name: "new.ts", depth: 0, path: "new.ts", status: "A" },
    ]);
  });
});
