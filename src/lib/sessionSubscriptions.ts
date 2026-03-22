import { useConnectionStore } from "@/stores/connectionStore";
import { useEditorStore } from "@/stores/editorStore";
import { useTabStore } from "@/stores/tabStore";
import { scheduleSaveSession } from "./sessionPersistence";

export function setupSessionSubscriptions(): void {
  // Save when tabs change
  useTabStore.subscribe(() => {
    scheduleSaveSession();
  });

  // Save when editor content changes
  useEditorStore.subscribe(() => {
    scheduleSaveSession();
  });

  // Save when active connections change (connect/disconnect, expanded state)
  useConnectionStore.subscribe((state, prevState) => {
    if (state.activeConnections !== prevState.activeConnections) {
      scheduleSaveSession();
    }
  });
}
