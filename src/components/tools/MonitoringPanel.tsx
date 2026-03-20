import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Pause, Play, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";

interface MonitoringPanelProps {
  connectionId: string;
}

interface ServerStats {
  host?: string;
  version?: string;
  uptime?: number;
  connections?: { current?: number; available?: number; totalCreated?: number };
  opcounters?: Record<string, number>;
  mem?: { resident?: number; virtual?: number; mapped?: number };
  network?: { bytesIn?: number; bytesOut?: number; numRequests?: number };
  storageEngine?: { name?: string };
}

export function MonitoringPanel({ connectionId }: MonitoringPanelProps) {
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState("5");
  const timerRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await invoke<Record<string, unknown>>("server_status", { connectionId });
      setStats(raw as unknown as ServerStats);
    } catch (err) {
      toast.error("Failed to fetch server stats", {
        description: err instanceof Error ? err.message : String(err),
      });
      setAutoRefresh(false);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = globalThis.setInterval(fetchStats, Number(refreshInterval) * 1000);
    }
    return () => {
      if (timerRef.current) {
        globalThis.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, fetchStats]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-medium">Server Monitoring</h3>
          {stats?.version && (
            <Badge variant="secondary" className="text-[10px]">
              v{stats.version}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </Button>
          <Select value={refreshInterval} onValueChange={setRefreshInterval}>
            <SelectTrigger className="h-6 w-[70px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1s</SelectItem>
              <SelectItem value="5">5s</SelectItem>
              <SelectItem value="10">10s</SelectItem>
              <SelectItem value="30">30s</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={fetchStats}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {stats ? (
          <div className="grid grid-cols-2 gap-3 p-3">
            <StatCard title="Connections">
              <StatRow label="Current" value={stats.connections?.current} />
              <StatRow label="Available" value={stats.connections?.available} />
              <StatRow label="Total Created" value={stats.connections?.totalCreated} />
            </StatCard>

            <StatCard title="Operations">
              {stats.opcounters &&
                Object.entries(stats.opcounters).map(([op, count]) => (
                  <StatRow key={op} label={op} value={count} />
                ))}
            </StatCard>

            <StatCard title="Memory">
              <StatRow label="Resident" value={stats.mem?.resident} suffix="MB" />
              <StatRow label="Virtual" value={stats.mem?.virtual} suffix="MB" />
            </StatCard>

            <StatCard title="Network">
              <StatRow label="Bytes In" value={stats.network?.bytesIn} format="bytes" />
              <StatRow label="Bytes Out" value={stats.network?.bytesOut} format="bytes" />
              <StatRow label="Requests" value={stats.network?.numRequests} />
            </StatCard>

            <StatCard title="Server Info">
              <StatRow label="Host" value={stats.host} />
              <StatRow label="Storage Engine" value={stats.storageEngine?.name} />
              <StatRow
                label="Uptime"
                value={stats.uptime ? formatUptime(stats.uptime) : undefined}
              />
            </StatCard>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
            <p className="text-sm">Fetching server stats...</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-card p-3">
      <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function StatRow({
  label,
  value,
  suffix,
  format,
}: {
  label: string;
  value?: string | number | null;
  suffix?: string;
  format?: "bytes";
}) {
  let displayValue: string;
  if (value === undefined || value === null) {
    displayValue = "\u2014";
  } else if (format === "bytes" && typeof value === "number") {
    displayValue = formatBytes(value);
  } else if (typeof value === "number") {
    displayValue = value.toLocaleString() + (suffix ? ` ${suffix}` : "");
  } else {
    displayValue = String(value);
  }

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{displayValue}</span>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
