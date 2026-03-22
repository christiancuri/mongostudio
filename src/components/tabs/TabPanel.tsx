import { QueryEditor } from "@/components/editor/QueryEditor";
import { ResultsPanel } from "@/components/results/ResultsPanel";
import { MonitoringPanel } from "@/components/tools/MonitoringPanel";
import { SchemaAnalysis } from "@/components/tools/SchemaAnalysis";
import { useTabStore } from "@/stores/tabStore";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

export function TabPanel() {
  const { tabs, activeTabId } = useTabStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (!activeTab) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <img src="/favicon.png" alt="MongoStudio" className="h-8 w-8" />
            <p className="text-lg font-medium">MongoStudio</p>
          </div>
          <p className="mt-1 text-sm">Connect to a server or open a new tab to get started</p>
          <div className="mt-4 space-y-1 text-xs text-muted-foreground/70">
            <p>Ctrl+N — New Connection</p>
            <p>Ctrl+T — New Tab</p>
            <p>Ctrl+P — Command Palette</p>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab.type === "monitoring" && activeTab.connectionId) {
    return <MonitoringPanel key={activeTab.id} connectionId={activeTab.connectionId} />;
  }

  if (
    activeTab.type === "schema" &&
    activeTab.connectionId &&
    activeTab.database &&
    activeTab.collection
  ) {
    return (
      <SchemaAnalysis
        key={activeTab.id}
        connectionId={activeTab.connectionId}
        database={activeTab.database}
        collection={activeTab.collection}
      />
    );
  }

  if (activeTab.type === "query" || activeTab.type === "document") {
    return (
      <PanelGroup key={activeTab.id} direction="vertical" autoSaveId={`editor-${activeTab.id}`}>
        <Panel id="editor" order={1} defaultSize={50} minSize={20}>
          <QueryEditor tab={activeTab} />
        </Panel>
        <PanelResizeHandle className="h-1 bg-border hover:bg-primary/50 transition-colors" />
        <Panel id="results" order={2} defaultSize={50} minSize={20}>
          <ResultsPanel tab={activeTab} />
        </Panel>
      </PanelGroup>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <p className="text-sm">Unsupported tab type: {activeTab.type}</p>
    </div>
  );
}
