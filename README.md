# YIEN

A concept page for a product that doesn't exist: a terminal workspace that runs your coding agents side by side and only calls you when one of them needs you.

The app on the page is a simulation written for the web. Nothing here is a real IDE, and the agents follow scripts.

## Run it locally

```bash
node serve.mjs
```

Open <http://localhost:5518/>.

## Structure

```
index.html      the page
css/site.css    styles, including the app's dark and paper themes
js/data.js      what each simulated agent says and does
js/sim.js       the window: tabs, split terminals, files and git panel
js/site.js      starts the windows, the red thread and the closing question
serve.mjs       static server for local development
```

To change what the agents do, edit `js/data.js`. Each agent is a list of steps: `prompt`, `think`, `plan`, `tool`, `edit`, `progress`, `ask`, `commit` and `msg`.

Red means one thing here: something needs you. With reduced motion turned on, the window shows its finished state and stops at the first question.
