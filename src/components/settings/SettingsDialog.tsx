import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type ThemeId, useSettingsStore } from "@/stores/settingsStore";
import { Check, Gem, Laptop, Monitor, Moon, Sun } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const THEMES: {
  id: ThemeId;
  name: string;
  icon: React.ElementType;
  preview?: { sidebar: string; editor: string; status: string; text: string };
}[] = [
  {
    id: "system",
    name: "System",
    icon: Laptop,
  },
  {
    id: "dark",
    name: "Dark",
    icon: Moon,
    preview: {
      sidebar: "#252526",
      editor: "#1e1e1e",
      status: "#207986",
      text: "#cccccc",
    },
  },
  {
    id: "light",
    name: "Light",
    icon: Sun,
    preview: {
      sidebar: "#f0f0f0",
      editor: "#f8f8f8",
      status: "#2563eb",
      text: "#1e1e1e",
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    icon: Gem,
    preview: {
      sidebar: "#1d1d1d",
      editor: "#1e1e1e",
      status: "#2a6e4e",
      text: "#d4d4d4",
    },
  },
  {
    id: "vscode-dark",
    name: "VS Code Dark",
    icon: Monitor,
    preview: {
      sidebar: "#252526",
      editor: "#1e1e1e",
      status: "#007acc",
      text: "#cccccc",
    },
  },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const theme = useSettingsStore((s) => s.settings.theme);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-sm font-medium">Settings</DialogTitle>
        </DialogHeader>

        <div className="p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Appearance
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Choose your preferred color theme</p>

          <div className="grid grid-cols-2 gap-3">
            {THEMES.map((t) => {
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`group relative rounded-lg border-2 p-1.5 text-left transition-all ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                  onClick={() => updateSettings({ theme: t.id })}
                >
                  {/* Mini preview or system icon */}
                  {t.preview ? (
                    <div className="flex h-20 overflow-hidden rounded-md border border-border/50">
                      <div
                        className="w-8 flex flex-col gap-1 p-1"
                        style={{ backgroundColor: t.preview.sidebar }}
                      >
                        <div
                          className="h-1 w-full rounded-sm opacity-40"
                          style={{ backgroundColor: t.preview.text }}
                        />
                        <div
                          className="h-1 w-3/4 rounded-sm opacity-30"
                          style={{ backgroundColor: t.preview.text }}
                        />
                        <div
                          className="h-1 w-full rounded-sm opacity-20"
                          style={{ backgroundColor: t.preview.text }}
                        />
                        <div
                          className="h-1 w-2/3 rounded-sm opacity-30"
                          style={{ backgroundColor: t.preview.text }}
                        />
                      </div>
                      <div className="flex flex-1 flex-col">
                        <div className="flex-1 p-1.5" style={{ backgroundColor: t.preview.editor }}>
                          <div
                            className="h-1 w-3/4 rounded-sm opacity-30 mb-1"
                            style={{ backgroundColor: t.preview.text }}
                          />
                          <div
                            className="h-1 w-1/2 rounded-sm opacity-20 mb-1"
                            style={{ backgroundColor: t.preview.text }}
                          />
                          <div
                            className="h-1 w-2/3 rounded-sm opacity-25"
                            style={{ backgroundColor: t.preview.text }}
                          />
                        </div>
                        <div
                          className="h-2.5 w-full"
                          style={{ backgroundColor: t.preview.status }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-20 items-center justify-center rounded-md border border-border/50 bg-muted/30">
                      <div className="flex gap-1">
                        <Sun className="h-5 w-5 text-muted-foreground" />
                        <Moon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  )}

                  {/* Label */}
                  <div className="mt-1.5 flex items-center gap-1.5 px-0.5">
                    <t.icon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium">{t.name}</span>
                    {isActive && <Check className="ml-auto h-3 w-3 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
