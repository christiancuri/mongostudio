import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { CodeGenerator } from "@/components/tools/CodeGenerator";
import { DataGenerator } from "@/components/tools/DataGenerator";
import { ExportDialog } from "@/components/tools/ExportDialog";
import { ImportDialog } from "@/components/tools/ImportDialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConnectionStore } from "@/stores/connectionStore";
import { useEditorStore } from "@/stores/editorStore";
import { useTabStore } from "@/stores/tabStore";
import {
  Activity,
  Bug,
  Code2,
  Command,
  Database,
  FileOutput,
  Import,
  PanelLeft,
  PanelLeftClose,
  Play,
  Settings,
  Sparkles,
  Square,
} from "lucide-react";
import { useState } from "react";

interface ToolbarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onNewConnection?: () => void;
  onCommandPalette?: () => void;
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onClick}
          disabled={disabled}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Toolbar({
  sidebarCollapsed,
  onToggleSidebar,
  onNewConnection,
  onCommandPalette,
}: ToolbarProps) {
  const activeConnections = useConnectionStore((s) => s.activeConnections);
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const addTab = useTabStore((s) => s.addTab);
  const editors = useEditorStore((s) => s.editors);

  const hasConnection = activeConnections.size > 0;
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const hasActiveQuery = !!activeTab?.connectionId && !!activeTab?.database;

  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [dataGenOpen, setDataGenOpen] = useState(false);
  const [codeGenOpen, setCodeGenOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleOpenMonitoring = () => {
    if (!activeTab?.connectionId) return;
    addTab({
      id: crypto.randomUUID(),
      title: "Monitoring",
      type: "monitoring",
      connectionId: activeTab.connectionId,
      dirty: false,
    });
  };

  const currentQuery = activeTabId
    ? (editors.get(activeTabId)?.content ?? activeTab?.content ?? "")
    : "";

  return (
    <>
      <div className="flex h-10 items-center gap-1 border-b border-border bg-background px-2">
        <ToolbarButton
          icon={sidebarCollapsed ? PanelLeft : PanelLeftClose}
          label={sidebarCollapsed ? "Show Sidebar (Ctrl+B)" : "Hide Sidebar (Ctrl+B)"}
          onClick={onToggleSidebar}
        />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolbarButton icon={Database} label="Connect" onClick={onNewConnection} />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolbarButton icon={Play} label="Run Query (Ctrl+Enter)" disabled={!hasActiveQuery} />
        <ToolbarButton icon={Bug} label="Debug" disabled={!hasActiveQuery} />
        <ToolbarButton icon={Square} label="Stop" disabled />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolbarButton
          icon={Import}
          label="Import"
          disabled={!hasActiveQuery}
          onClick={() => setImportOpen(true)}
        />
        <ToolbarButton
          icon={FileOutput}
          label="Export"
          disabled={!hasActiveQuery || !activeTab?.collection}
          onClick={() => setExportOpen(true)}
        />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolbarButton
          icon={Activity}
          label="Monitoring"
          disabled={!hasConnection}
          onClick={handleOpenMonitoring}
        />
        <ToolbarButton
          icon={Code2}
          label="Code Generator"
          disabled={!hasActiveQuery}
          onClick={() => setCodeGenOpen(true)}
        />
        <ToolbarButton
          icon={Sparkles}
          label="Data Generator"
          disabled={!hasConnection}
          onClick={() => setDataGenOpen(true)}
        />
        <div className="flex-1" />
        <ToolbarButton icon={Command} label="Command Palette (Ctrl+P)" onClick={onCommandPalette} />
        <ToolbarButton icon={Settings} label="Settings" onClick={() => setSettingsOpen(true)} />
      </div>

      {/* Dialogs */}
      {activeTab?.connectionId && activeTab?.database && (
        <>
          <ImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            connectionId={activeTab.connectionId}
            database={activeTab.database}
            collection={activeTab.collection}
          />
          {activeTab.collection && (
            <ExportDialog
              open={exportOpen}
              onOpenChange={setExportOpen}
              connectionId={activeTab.connectionId}
              database={activeTab.database}
              collection={activeTab.collection}
            />
          )}
          <CodeGenerator
            open={codeGenOpen}
            onOpenChange={setCodeGenOpen}
            query={currentQuery}
            collection={activeTab.collection ?? ""}
            database={activeTab.database}
          />
        </>
      )}
      <DataGenerator
        open={dataGenOpen}
        onOpenChange={setDataGenOpen}
        connectionId={activeTab?.connectionId}
        database={activeTab?.database}
        collection={activeTab?.collection}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
