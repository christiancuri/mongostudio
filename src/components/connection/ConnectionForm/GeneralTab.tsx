import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConnectionConfig, HostPort } from "@/types/connection";
import { CONNECTION_COLORS } from "@/types/connection";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface GeneralTabProps {
  config: ConnectionConfig;
  onChange: (updates: Partial<ConnectionConfig>) => void;
}

export function GeneralTab({ config, onChange }: GeneralTabProps) {
  const updateUri = (updates: Partial<ConnectionConfig["uri"]>) => {
    onChange({ uri: { ...config.uri, ...updates } });
  };

  const updateHost = (index: number, updates: Partial<HostPort>) => {
    const hosts = [...config.uri.hosts];
    hosts[index] = { ...hosts[index], ...updates };
    updateUri({ hosts });
  };

  const addHost = () => {
    updateUri({
      hosts: [...config.uri.hosts, { host: "localhost", port: 27017 }],
    });
  };

  const removeHost = (index: number) => {
    if (config.uri.hosts.length <= 1) return;
    updateUri({ hosts: config.uri.hosts.filter((_, i) => i !== index) });
  };

  const connectionString = buildConnectionString(config);

  const copyUri = () => {
    navigator.clipboard.writeText(connectionString);
    toast.success("Connection string copied");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Connection Name</Label>
          <Input
            className="h-8 text-sm"
            value={config.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="My Connection"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Color</Label>
          <div className="flex gap-1 h-8 items-center">
            {CONNECTION_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`h-5 w-5 rounded-full border-2 transition-transform ${
                  config.colorFlag === color ? "border-foreground scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: getColorHex(color) }}
                onClick={() => onChange({ colorFlag: color })}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Scheme</Label>
        <Select
          value={config.uri.scheme}
          onValueChange={(v) => updateUri({ scheme: v as "mongodb" | "mongodb+srv" })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mongodb">mongodb</SelectItem>
            <SelectItem value="mongodb+srv">mongodb+srv</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Hosts</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 gap-1 px-1.5 text-[10px]"
            onClick={addHost}
          >
            <Plus className="h-3 w-3" />
            Add Host
          </Button>
        </div>
        {config.uri.hosts.map((host, i) => (
          <div key={`${host.host}:${host.port}-${i}`} className="flex gap-2">
            <div className="flex-1">
              <Input
                className="h-8 text-sm"
                value={host.host}
                onChange={(e) => updateHost(i, { host: e.target.value })}
                placeholder="localhost"
              />
            </div>
            <div className="w-24">
              <Input
                className="h-8 text-sm"
                type="number"
                value={host.port}
                onChange={(e) =>
                  updateHost(i, {
                    port: Number.parseInt(e.target.value, 10) || 27017,
                  })
                }
                placeholder="27017"
              />
            </div>
            {config.uri.hosts.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => removeHost(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Default Database</Label>
        <Input
          className="h-8 text-sm"
          value={config.uri.database ?? ""}
          onChange={(e) => updateUri({ database: e.target.value || undefined })}
          placeholder="(optional)"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Connection String</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 gap-1 px-1.5 text-[10px]"
            onClick={copyUri}
          >
            <Copy className="h-3 w-3" />
            Copy
          </Button>
        </div>
        <div className="rounded border border-border bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground break-all">
          {connectionString}
        </div>
      </div>
    </div>
  );
}

function buildConnectionString(config: ConnectionConfig): string {
  const hostStr = config.uri.hosts.map((h) => `${h.host}:${h.port}`).join(",");
  const auth =
    config.uri.username && config.uri.password
      ? `${encodeURIComponent(config.uri.username)}:${encodeURIComponent(config.uri.password)}@`
      : config.uri.username
        ? `${encodeURIComponent(config.uri.username)}@`
        : "";
  const db = config.uri.database ?? "";
  return `${config.uri.scheme}://${auth}${hostStr}/${db}`;
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
