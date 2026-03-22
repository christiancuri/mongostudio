import { Command } from "cmdk";
import {
  Activity,
  Code2,
  Database,
  FileOutput,
  Import,
  PanelLeft,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewConnection: () => void;
  onToggleSidebar: () => void;
  onSettings: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onNewConnection,
  onToggleSidebar,
  onSettings,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (open) {
      setSearch("");
      document.addEventListener("keydown", handleKeyDown, true);
      return () => document.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  const runAction = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => onOpenChange(false)}>
      <div
        className="fixed left-1/2 top-[20%] z-50 w-[500px] -translate-x-1/2 rounded-lg border border-border bg-popover shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="rounded-lg" shouldFilter={true}>
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command..."
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found
            </Command.Empty>

            <Command.Group
              heading="Connection"
              className="px-1 py-1.5 text-xs text-muted-foreground"
            >
              <CommandItem
                icon={Database}
                label="New Connection"
                shortcut="Ctrl+N"
                onSelect={() => runAction(onNewConnection)}
              />
            </Command.Group>

            <Command.Group heading="Editor" className="px-1 py-1.5 text-xs text-muted-foreground">
              <CommandItem
                icon={Plus}
                label="New Tab"
                shortcut="Ctrl+T"
                onSelect={() => runAction(() => {})}
              />
              <CommandItem
                icon={Play}
                label="Run Query"
                shortcut="Ctrl+Enter"
                onSelect={() => runAction(() => {})}
              />
            </Command.Group>

            <Command.Group heading="Tools" className="px-1 py-1.5 text-xs text-muted-foreground">
              <CommandItem
                icon={Activity}
                label="Monitoring"
                onSelect={() => runAction(() => {})}
              />
              <CommandItem
                icon={Code2}
                label="Code Generator"
                onSelect={() => runAction(() => {})}
              />
              <CommandItem
                icon={Sparkles}
                label="Data Generator"
                onSelect={() => runAction(() => {})}
              />
              <CommandItem icon={Import} label="Import Data" onSelect={() => runAction(() => {})} />
              <CommandItem
                icon={FileOutput}
                label="Export Data"
                onSelect={() => runAction(() => {})}
              />
            </Command.Group>

            <Command.Group heading="View" className="px-1 py-1.5 text-xs text-muted-foreground">
              <CommandItem
                icon={PanelLeft}
                label="Toggle Sidebar"
                shortcut="Ctrl+B"
                onSelect={() => runAction(onToggleSidebar)}
              />
              <CommandItem
                icon={Settings}
                label="Settings"
                onSelect={() => runAction(onSettings)}
              />
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function CommandItem({
  icon: Icon,
  label,
  shortcut,
  onSelect,
}: {
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
      onSelect={onSelect}
      value={label}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[10px] text-muted-foreground">{shortcut}</span>}
    </Command.Item>
  );
}
