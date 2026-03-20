export const SHORTCUTS = {
  runQuery: { key: "Enter", ctrl: true, label: "Run Query" },
  runAll: { key: "Enter", ctrl: true, shift: true, label: "Run All" },
  newTab: { key: "t", ctrl: true, label: "New Tab" },
  closeTab: { key: "w", ctrl: true, label: "Close Tab" },
  saveQuery: { key: "s", ctrl: true, label: "Save Query" },
  commandPalette: { key: "p", ctrl: true, label: "Command Palette" },
  toggleSidebar: { key: "b", ctrl: true, label: "Toggle Sidebar" },
  find: { key: "f", ctrl: true, label: "Find" },
} as const;
