import { useConnectionStore } from "@/stores/connectionStore";
import { useEditorStore } from "@/stores/editorStore";
import { useTabStore } from "@/stores/tabStore";
import type { Tab } from "@/types/tab";
import { load } from "@tauri-apps/plugin-store";

const SESSION_FILE = "session.json";
const SESSION_KEY = "session";

export interface SessionData {
  activeConnectionIds: string[];
  tabs: Tab[];
  activeTabId: string | null;
  editorContents: Record<string, string>; // tabId -> content
  expandedPaths: Record<string, string[]>; // connectionId -> expanded path strings
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let restoring = false;

/** Flag to suppress auto-save during session restore */
export function setRestoring(value: boolean): void {
  restoring = value;
}

export function isRestoring(): boolean {
  return restoring;
}

async function saveSession(data: SessionData): Promise<void> {
  try {
    const store = await load(SESSION_FILE);
    await store.set(SESSION_KEY, data);
    await store.save();
  } catch (e) {
    console.error("Failed to save session:", e);
  }
}

export async function loadSession(): Promise<SessionData | null> {
  try {
    const store = await load(SESSION_FILE);
    const data = await store.get<SessionData>(SESSION_KEY);
    if (!data) return null;

    // Validate basic shape
    if (!Array.isArray(data.tabs) || !Array.isArray(data.activeConnectionIds)) {
      console.warn("Invalid session data, ignoring");
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/** Debounced save -- collects current state from all stores and persists */
export function scheduleSaveSession(): void {
  if (restoring) return;

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    collectAndSave();
  }, 1000);
}

async function collectAndSave(): Promise<void> {
  const tabState = useTabStore.getState();
  const editorState = useEditorStore.getState();
  const connState = useConnectionStore.getState();

  // Collect active connection IDs
  const activeConnectionIds = Array.from(connState.activeConnections.keys());

  // Collect editor contents
  const editorContents: Record<string, string> = {};
  for (const [tabId, editor] of editorState.editors.entries()) {
    editorContents[tabId] = editor.content;
  }

  // Merge editor content into tabs for persistence
  const tabs = tabState.tabs.map((tab) => ({
    ...tab,
    content: editorContents[tab.id] ?? tab.content ?? "",
  }));

  // Collect expanded paths per connection
  const expandedPaths: Record<string, string[]> = {};
  for (const [connId, conn] of connState.activeConnections.entries()) {
    expandedPaths[connId] = Array.from(conn.expanded);
  }

  await saveSession({
    activeConnectionIds,
    tabs,
    activeTabId: tabState.activeTabId,
    editorContents,
    expandedPaths,
  });
}
