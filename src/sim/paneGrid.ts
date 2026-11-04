export interface PaneGrid {
  columns: number;
  rows: number;
  firstPaneRows: number;
}

/* As square as it can be. The first pane stretches down to fill any cells left over. */
export function paneGrid(panes: number): PaneGrid {
  const columns = Math.ceil(Math.sqrt(panes));
  const rows = Math.ceil(panes / columns);
  return { columns, rows, firstPaneRows: 1 + columns * rows - panes };
}
