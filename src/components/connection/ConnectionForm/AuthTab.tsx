import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuthMode, ConnectionConfig } from "@/types/connection";

interface AuthTabProps {
  config: ConnectionConfig;
  onChange: (updates: Partial<ConnectionConfig>) => void;
}

export function AuthTab({ config, onChange }: AuthTabProps) {
  const updateUri = (updates: Partial<ConnectionConfig["uri"]>) => {
    onChange({ uri: { ...config.uri, ...updates } });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Authentication Method</Label>
        <Select
          value={config.authMode}
          onValueChange={(v) => onChange({ authMode: v as AuthMode })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Authentication</SelectItem>
            <SelectItem value="scramSha1">SCRAM-SHA-1</SelectItem>
            <SelectItem value="scramSha256">SCRAM-SHA-256</SelectItem>
            <SelectItem value="x509">X.509 Certificate</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.authMode !== "none" && config.authMode !== "x509" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Username</Label>
            <Input
              className="h-8 text-sm"
              value={config.uri.username ?? ""}
              onChange={(e) => updateUri({ username: e.target.value || undefined })}
              placeholder="Username"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Password</Label>
            <Input
              className="h-8 text-sm"
              type="password"
              value={config.uri.password ?? ""}
              onChange={(e) => updateUri({ password: e.target.value || undefined })}
              placeholder="Password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Authentication Database</Label>
            <Input
              className="h-8 text-sm"
              value={config.uri.options?.authSource ?? "admin"}
              onChange={(e) =>
                updateUri({
                  options: {
                    ...config.uri.options,
                    authSource: e.target.value,
                  },
                })
              }
              placeholder="admin"
            />
          </div>
        </>
      )}
    </div>
  );
}
