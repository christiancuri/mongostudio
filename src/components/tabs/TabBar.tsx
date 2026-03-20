import { X, Plus } from "lucide-react";
import { useTabStore } from "@/stores/tabStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, removeTab, addTab } = useTabStore();

  const handleNewTab = () => {
    addTab({
      id: crypto.randomUUID(),
      title: "Untitled",
      type: "query",
      dirty: false,
      content: "",
    });
  };

  if (tabs.length === 0) {
    return (
      <div className="flex h-9 items-center border-b border-border bg-background px-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-xs"
          onClick={handleNewTab}
        >
          <Plus className="h-3 w-3" />
          New Tab
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-9 items-center border-b border-border bg-background">
      <div className="flex flex-1 items-center overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              "group relative flex h-9 min-w-[120px] max-w-[250px] items-center gap-1.5 border-r border-border px-3 text-xs transition-colors",
              activeTabId === tab.id
                ? "bg-background"
                : "bg-muted/50 hover:bg-muted",
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.dirty && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
            )}
            <span
              className="truncate"
              style={tab.colorFlag ? { color: getColorHex(tab.colorFlag) } : undefined}
            >
              {tab.title}
            </span>
            <button
              type="button"
              className="ml-auto shrink-0 rounded p-0.5 opacity-0 hover:bg-accent group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                removeTab(tab.id);
              }}
            >
              <X className="h-3 w-3" />
            </button>
            {activeTabId === tab.id && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: tab.colorFlag ? getColorHex(tab.colorFlag) : "var(--color-primary)" }}
              />
            )}
          </button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mx-1 h-6 w-6 shrink-0 p-0"
        onClick={handleNewTab}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

function getColorHex(color: string): string {
  const colors: Record<string, string> = {
    gray: "#6b7280",
    red: "#ef4444",
    orange: "#f97316",
    yellow: "#eab308",
    green: "#22c55e",
    blue: "#3b82f6",
    purple: "#a855f7",
    pink: "#ec4899",
  };
  return colors[color] ?? colors.gray;
}
