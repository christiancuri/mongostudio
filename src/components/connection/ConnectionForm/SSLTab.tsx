import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConnectionConfig, SslConfig } from "@/types/connection";
import { FileSearch } from "lucide-react";

interface SSLTabProps {
  config: ConnectionConfig;
  onChange: (updates: Partial<ConnectionConfig>) => void;
}

export function SSLTab({ config, onChange }: SSLTabProps) {
  const ssl = config.sslConfig ?? {
    enabled: false,
    allowInvalidCertificates: false,
  };

  const updateSsl = (updates: Partial<SslConfig>) => {
    onChange({ sslConfig: { ...ssl, ...updates } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="ssl-enabled"
          checked={ssl.enabled}
          onChange={(e) => updateSsl({ enabled: e.target.checked })}
          className="h-4 w-4 rounded border-border"
        />
        <Label htmlFor="ssl-enabled" className="text-xs">
          Enable SSL/TLS
        </Label>
      </div>

      {ssl.enabled && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">CA Certificate</Label>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm flex-1"
                value={ssl.caFile ?? ""}
                onChange={(e) => updateSsl({ caFile: e.target.value || undefined })}
                placeholder="/path/to/ca.pem"
              />
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <FileSearch className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Client Certificate</Label>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm flex-1"
                value={ssl.certFile ?? ""}
                onChange={(e) => updateSsl({ certFile: e.target.value || undefined })}
                placeholder="/path/to/cert.pem"
              />
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <FileSearch className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Client Key</Label>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm flex-1"
                value={ssl.keyFile ?? ""}
                onChange={(e) => updateSsl({ keyFile: e.target.value || undefined })}
                placeholder="/path/to/key.pem"
              />
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <FileSearch className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ssl-invalid"
              checked={ssl.allowInvalidCertificates}
              onChange={(e) => updateSsl({ allowInvalidCertificates: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="ssl-invalid" className="text-xs">
              Allow invalid certificates
            </Label>
          </div>
        </>
      )}
    </div>
  );
}
