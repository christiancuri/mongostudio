import { DatabaseBrowser } from "@/components/sidebar/DatabaseBrowser";
import { MyQueries } from "@/components/sidebar/MyQueries";
import { Samples } from "@/components/sidebar/Samples";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

export function Sidebar() {
  const [bottomTab, setBottomTab] = useState<"queries" | "samples">("queries");

  return (
    <PanelGroup direction="vertical" autoSaveId="sidebar-layout">
      {/* Top panel — Open Connections */}
      <Panel id="connections" order={1} defaultSize={75} minSize={30}>
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-sidebar-border shrink-0">
            <span className="text-[11px] font-semibold text-sidebar-foreground/70">
              Open Connections
            </span>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <DatabaseBrowser />
          </ScrollArea>
        </div>
      </Panel>

      <PanelResizeHandle className="h-0.5 bg-sidebar-border hover:bg-primary/50 transition-colors" />

      {/* Bottom panel — My Queries / Samples */}
      <Panel id="bottom" order={2} defaultSize={25} minSize={15}>
        <div className="flex h-full flex-col overflow-hidden">
          {/* Tab headers */}
          <div className="flex items-center border-b border-sidebar-border shrink-0">
            <button
              type="button"
              className={cn(
                "flex-1 px-3 py-1.5 text-[11px] font-medium transition-colors",
                bottomTab === "queries"
                  ? "text-sidebar-foreground border-b-2 border-primary"
                  : "text-sidebar-foreground/50 hover:text-sidebar-foreground/70",
              )}
              onClick={() => setBottomTab("queries")}
            >
              My Queries
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 px-3 py-1.5 text-[11px] font-medium transition-colors",
                bottomTab === "samples"
                  ? "text-sidebar-foreground border-b-2 border-primary"
                  : "text-sidebar-foreground/50 hover:text-sidebar-foreground/70",
              )}
              onClick={() => setBottomTab("samples")}
            >
              Samples
            </button>
          </div>

          {/* Tab content */}
          <ScrollArea className="flex-1 min-h-0">
            {bottomTab === "queries" ? <MyQueries /> : <Samples />}
          </ScrollArea>
        </div>
      </Panel>
    </PanelGroup>
  );
}
