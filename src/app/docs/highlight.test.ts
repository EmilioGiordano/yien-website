import { describe, expect, it } from "vitest";
import { fileContents } from "../../data/fileContents";
import { highlight, type TokenKind } from "./highlight";

const kindOf = (path: string, text: string, word: string): TokenKind | undefined =>
  highlight(path, text).find((token) => token.text === word)?.kind;

describe("highlight", () => {
  it("adds back up to the exact text of every file", () => {
    for (const [path, text] of Object.entries(fileContents)) {
      expect(
        highlight(path, text)
          .map((token) => token.text)
          .join(""),
      ).toBe(text);
    }
  });

  it("colors a script", () => {
    const text = 'export function go(id: Cart) { return "x" + 1; } // done';
    expect(kindOf("a.ts", text, "export")).toBe("keyword");
    expect(kindOf("a.ts", text, "go")).toBe("call");
    expect(kindOf("a.ts", text, "Cart")).toBe("type");
    expect(kindOf("a.ts", text, '"x"')).toBe("string");
    expect(kindOf("a.ts", text, "1")).toBe("number");
    expect(kindOf("a.ts", text, "// done")).toBe("comment");
  });

  it("doesn't read keywords inside strings or comments", () => {
    const tokens = highlight("a.ts", '"return" // const');
    expect(tokens.filter((token) => token.kind === "keyword")).toEqual([]);
  });

  it("colors SQL whatever its case", () => {
    expect(kindOf("a.sql", "CREATE table x (id uuid);", "CREATE")).toBe("keyword");
    expect(kindOf("a.sql", "CREATE table x (id uuid);", "uuid")).toBe("type");
  });

  it("tells JSON keys from values", () => {
    const text = '{ "name": "shop" }';
    expect(kindOf("a.json", text, '"name"')).toBe("keyword");
    expect(kindOf("a.json", text, '"shop"')).toBe("string");
  });

  it("colors Markdown headings and code", () => {
    const text = "## Start\n\nRun `pnpm dev`.\n";
    expect(kindOf("a.md", text, "## Start")).toBe("keyword");
    expect(kindOf("a.md", text, "`pnpm dev`")).toBe("string");
  });

  it("leaves unknown files alone", () => {
    expect(highlight("LICENSE", "const x")).toEqual([{ text: "const x" }]);
  });
});
