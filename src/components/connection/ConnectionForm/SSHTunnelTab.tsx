import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConnectionConfig, SshTunnelConfig } from "@/types/connection";
import { FileSearch } from "lucide-react";

interface SSHTunnelTabProps {
  config: ConnectionConfig;
  onChange: (updates: Partial<ConnectionConfig>) => void;
}

export function SSHTunnelTab({ config, onChange }: SSHTunnelTabProps) {
  const enabled = !!config.sshTunnel;
  const ssh = config.sshTunnel ?? {
    host: "",
    port: 22,
    username: "",
  };

  const updateSsh = (updates: Partial<SshTunnelConfig>) => {
    onChange({ sshTunnel: { ...ssh, ...updates } });
  };

  const toggleSsh = (checked: boolean) => {
    if (checked) {
      onChange({ sshTunnel: { host: "", port: 22, username: "" } });
    } else {
      onChange({ sshTunnel: undefined });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="ssh-enabled"
          checked={enabled}
          onChange={(e) => toggleSsh(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <Label htmlFor="ssh-enabled" className="text-xs">
          Use SSH Tunnel
        </Label>
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-[1fr_100px] gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">SSH Host</Label>
              <Input
                className="h-8 text-sm"
                value={ssh.host}
                onChange={(e) => updateSsh({ host: e.target.value })}
                placeholder="ssh.example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Port</Label>
              <Input
                className="h-8 text-sm"
                type="number"
                value={ssh.port}
                onChange={(e) =>
                  updateSsh({
                    port: Number.parseInt(e.target.value, 10) || 22,
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Username</Label>
            <Input
              className="h-8 text-sm"
              value={ssh.username}
              onChange={(e) => updateSsh({ username: e.target.value })}
              placeholder="username"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Password</Label>
            <Input
              className="h-8 text-sm"
              type="password"
              value={ssh.password ?? ""}
              onChange={(e) => updateSsh({ password: e.target.value || undefined })}
              placeholder="(optional if using key)"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Private Key File</Label>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm flex-1"
                value={ssh.privateKey ?? ""}
                onChange={(e) => updateSsh({ privateKey: e.target.value || undefined })}
                placeholder="/path/to/private_key"
              />
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <FileSearch className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
