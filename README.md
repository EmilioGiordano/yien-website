# YIEN

The website for a product that doesn't exist: a workspace that runs your coding agents side by side in real terminals and only calls you when one of them needs you.

The app on the page is a simulation written for the web. Nothing here is a real IDE, and the agents follow scripts.

## Run it locally

```bash
npm install
npm run dev
```

Open <http://localhost:5518/>.

| Command           | What it does                     |
| ----------------- | -------------------------------- |
| `npm run dev`     | Dev server with hot reload       |
| `npm run build`   | Static site in `dist/`           |
| `npm run preview` | Serves the built site            |
| `npm run check`   | Type checks TypeScript and Astro |
| `npm test`        | Runs the simulation's tests      |
| `npm run format`  | Formats everything with Prettier |

## Structure

```
src/
  pages/        the page
  layouts/      the document shell
  components/   the page's sections, static Astro with small scripts
  app/          the simulated window, in Preact
    islands/    what each section mounts on the page
    terminal/   panes and their scrollback
    panel/      Files, Changes, Graph and Branches
    docs/       the editor, diffs and commits in the center tabs
  sim/          the simulation engine, plain TypeScript with no UI
  data/         what each agent does, and the contents of its files
  styles/       design tokens and global rules
```

The engine holds all the state and exposes `subscribe` and `getState`. Components read from it with `useSim(sim, selector)` and change it by calling its methods, so everything that happens in the window can be tested without a browser.

Only the windows ship as interactive islands. Everything else on the page is static HTML.

To change what the agents do, edit `src/data/workspaces.ts`. Each agent is a list of steps: `prompt`, `think`, `plan`, `tool`, `edit`, `progress`, `ask`, `commit` and `message`.

Red means one thing here: something needs you. With reduced motion turned on, the window shows its finished state and stops at the first question.

## Working on it

One branch per feature, reviewed before it's merged. Code, comments and commits are in English.
