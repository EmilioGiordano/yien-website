import type { ChangeStatus, GitState } from "./types";

export type TreeRow =
  | { kind: "dir"; name: string; depth: number }
  | { kind: "file"; name: string; depth: number; path: string; status?: ChangeStatus };

interface Dir {
  dirs: Map<string, Dir>;
  files: Map<string, string>;
}

/* Everything the tab's branches have touched, committed or not. */
export function changedFiles(git: GitState): Map<string, ChangeStatus> {
  const changed = new Map<string, ChangeStatus>();
  for (const { branch } of git.agents) {
    for (const commit of git.commits) {
      if (commit.branch === branch) commit.files.forEach((f) => changed.set(f.path, f.status));
    }
    git.changes[branch]?.forEach((f) => changed.set(f.path, f.status));
  }
  return changed;
}

export function buildTree(files: string[], changed: Map<string, ChangeStatus>): TreeRow[] {
  const root: Dir = { dirs: new Map(), files: new Map() };
  for (const path of new Set([...files, ...changed.keys()])) {
    const parts = path.split("/");
    const name = parts.pop()!;
    let dir = root;
    for (const part of parts) {
      if (!dir.dirs.has(part)) dir.dirs.set(part, { dirs: new Map(), files: new Map() });
      dir = dir.dirs.get(part)!;
    }
    dir.files.set(name, path);
  }

  const rows: TreeRow[] = [];
  const walk = (dir: Dir, depth: number) => {
    for (const [name, child] of sorted(dir.dirs)) {
      rows.push({ kind: "dir", name, depth });
      walk(child, depth + 1);
    }
    for (const [name, path] of sorted(dir.files)) {
      rows.push({ kind: "file", name, depth, path, status: changed.get(path) });
    }
  };
  walk(root, 0);
  return rows;
}

function sorted<T>(entries: Map<string, T>): [string, T][] {
  return [...entries].sort(([a], [b]) => a.localeCompare(b));
}
