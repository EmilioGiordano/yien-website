import { describe, expect, it } from "vitest";
import { fileContents } from "./fileContents";
import { heroWorkspaces } from "./workspaces";

describe("fileContents", () => {
  it("has code for every file the hero's tabs can open", () => {
    const paths = heroWorkspaces.flatMap((workspace) => [
      ...workspace.files,
      ...workspace.terminals.flatMap((terminal) =>
        terminal.kind === "agent"
          ? terminal.script.flatMap((step) => (step.type === "edit" ? [step.file] : []))
          : [],
      ),
    ]);
    expect(paths.filter((path) => !fileContents[path])).toEqual([]);
  });

  it("keeps package.json valid", () => {
    expect(() => JSON.parse(fileContents["package.json"])).not.toThrow();
  });
});
