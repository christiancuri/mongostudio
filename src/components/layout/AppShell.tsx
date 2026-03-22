import { CommandPalette } from "@/components/common/CommandPalette";
import { ConnectionListDialog } from "@/components/connection/ConnectionListDialog";
import { TabBar } from "@/components/tabs/TabBar";
import { TabPanel } from "@/components/tabs/TabPanel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTabStore } from "@/stores/tabStore";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);
  const addTab = useTabStore((s) => s.addTab);
  // Listen for Cmd+W (close tab) from Tauri menu
  useEffect(() => {
    const unlisten = listen("close-active-tab", () => {
      const { activeTabId } = useTabStore.getState();
      if (activeTabId) {
        useTabStore.getState().removeTab(activeTabId);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useKeyboardShortcuts([
    { key: "b", ctrl: true, handler: toggleSidebar },
    { key: "p", ctrl: true, handler: () => setCommandPaletteOpen(true) },
    {
      key: "t",
      ctrl: true,
      handler: () =>
        addTab({
          id: crypto.randomUUID(),
          title: "Untitled",
          type: "query",
          dirty: false,
          content: "",
        }),
    },
  ]);

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col bg-background text-foreground">
        <Toolbar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          onNewConnection={() => setConnectionDialogOpen(true)}
          onCommandPalette={() => setCommandPaletteOpen(true)}
        />
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal" autoSaveId="main-layout">
            {!sidebarCollapsed && (
              <>
                <Panel
                  id="sidebar"
                  order={1}
                  defaultSize={20}
                  minSize={15}
                  maxSize={40}
                  className="bg-sidebar"
                >
                  <Sidebar />
                </Panel>
                <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
              </>
            )}
            <Panel id="main" order={2} minSize={40}>
              <div className="flex h-full flex-col">
                <TabBar />
                <TabPanel />
              </div>
            </Panel>
          </PanelGroup>
        </div>
        <StatusBar />
      </div>
      <ConnectionListDialog open={connectionDialogOpen} onOpenChange={setConnectionDialogOpen} />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNewConnection={() => {
          setCommandPaletteOpen(false);
          setConnectionDialogOpen(true);
        }}
        onToggleSidebar={toggleSidebar}
      />
    </TooltipProvider>
  );
}
