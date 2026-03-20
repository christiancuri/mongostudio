import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConnectionConfig } from "@/types/connection";

interface AdvancedTabProps {
  config: ConnectionConfig;
  onChange: (updates: Partial<ConnectionConfig>) => void;
}

export function AdvancedTab({ config, onChange }: AdvancedTabProps) {
  const options = config.uri.options ?? {};

  const updateOption = (key: string, value: string) => {
    const newOptions = { ...options };
    if (value) {
      newOptions[key] = value;
    } else {
      delete newOptions[key];
    }
    onChange({ uri: { ...config.uri, options: newOptions } });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Connection Type</Label>
        <Select
          value={config.connectionType}
          onValueChange={(v) => onChange({ connectionType: v as "direct" | "replica" })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="direct">Direct Connection</SelectItem>
            <SelectItem value="replica">Replica Set</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.connectionType === "replica" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Replica Set Name</Label>
          <Input
            className="h-8 text-sm"
            value={options.replicaSet ?? ""}
            onChange={(e) => updateOption("replicaSet", e.target.value)}
            placeholder="rs0"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Read Preference</Label>
        <Select
          value={options.readPreference ?? "primary"}
          onValueChange={(v) => updateOption("readPreference", v)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primary</SelectItem>
            <SelectItem value="primaryPreferred">Primary Preferred</SelectItem>
            <SelectItem value="secondary">Secondary</SelectItem>
            <SelectItem value="secondaryPreferred">Secondary Preferred</SelectItem>
            <SelectItem value="nearest">Nearest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Connection Timeout (ms)</Label>
        <Input
          className="h-8 text-sm"
          type="number"
          value={options.connectTimeoutMS ?? "10000"}
          onChange={(e) => updateOption("connectTimeoutMS", e.target.value)}
          placeholder="10000"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Socket Timeout (ms)</Label>
        <Input
          className="h-8 text-sm"
          type="number"
          value={options.socketTimeoutMS ?? "0"}
          onChange={(e) => updateOption("socketTimeoutMS", e.target.value)}
          placeholder="0 (unlimited)"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Application Name</Label>
        <Input
          className="h-8 text-sm"
          value={options.appName ?? "MongoStudio"}
          onChange={(e) => updateOption("appName", e.target.value)}
          placeholder="MongoStudio"
        />
      </div>
    </div>
  );
}
