import type { GitState } from "./types";

export const SHELL_PROMPT = "~/shop %";

function gitCommand(args: string[], git: GitState): string[] {
  switch (args[0]) {
    case "log":
      return git.commits.map((commit) => `${commit.hash} ${commit.message}`);
    case "branch":
      return ["* main", ...git.agents.map((agent) => `  ${agent.branch}`)];
    case "status":
      return ["On branch main", "nothing to commit, working tree clean"];
    default:
      return [`git: '${args[0] ?? ""}' isn't set up in this shell`];
  }
}

/* The commands a shell on this page can answer. `clear` is handled by the terminal itself. */
export function runShellCommand(input: string, files: string[], git: GitState): string[] {
  const [command, ...args] = input.split(/\s+/);
  switch (command) {
    case "pwd":
      return ["/Users/you/shop"];
    case "whoami":
      return ["you"];
    case "echo":
      return [args.join(" ")];
    case "ls":
      return [...new Set(files.map((path) => path.split("/")[0]))].sort();
    case "help":
      return ["Try ls, pwd, git status, git log, git branch, or clear."];
    case "git":
      return gitCommand(args, git);
    default:
      return [`zsh: command not found: ${command}`];
  }
}
