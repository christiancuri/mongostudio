export interface ConnectionConfig {
  id: string;
  name: string;
  connectionType: "direct" | "replica";
  uri: ConnectionUri;
  authMode: AuthMode;
  sslConfig?: SslConfig;
  sshTunnel?: SshTunnelConfig;
  colorFlag: string;
  editable: boolean;
  lastAccessed?: string;
}

export interface ConnectionUri {
  scheme: "mongodb" | "mongodb+srv";
  hosts: HostPort[];
  username?: string;
  password?: string;
  database?: string;
  options: Record<string, string>;
}

export interface HostPort {
  host: string;
  port: number;
}

export type AuthMode = "none" | "scramSha1" | "scramSha256" | "x509";

export interface SslConfig {
  enabled: boolean;
  caFile?: string;
  certFile?: string;
  keyFile?: string;
  allowInvalidCertificates: boolean;
}

export interface SshTunnelConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export const CONNECTION_COLORS = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
] as const;

export type ConnectionColor = (typeof CONNECTION_COLORS)[number];

export function getConnectionServer(config: ConnectionConfig): string {
  return config.uri.hosts.map((h) => `${h.host}:${h.port}`).join(",");
}

export function getConnectionSecurity(config: ConnectionConfig): string {
  const parts: string[] = [];
  if (config.sslConfig?.enabled) parts.push("[SSL]");
  if (config.uri.username) {
    const authDb = config.uri.options?.authSource ?? config.uri.database ?? "";
    parts.push(`${config.uri.username} @ ${authDb}`);
  } else {
    parts.push("none");
  }
  return parts.join(" ");
}

export function createDefaultConnection(): ConnectionConfig {
  return {
    id: crypto.randomUUID(),
    name: "New Connection",
    connectionType: "direct",
    uri: {
      scheme: "mongodb",
      hosts: [{ host: "localhost", port: 27017 }],
      options: {},
    },
    authMode: "none",
    colorFlag: "gray",
    editable: true,
  };
}
