import type { ConnectionConfig } from "@/types/connection";
import { createDefaultConnection } from "@/types/connection";

export function parseMongoUri(uri: string): ConnectionConfig {
  const config = createDefaultConnection();
  const trimmed = uri.trim();

  try {
    // Determine scheme
    let scheme: "mongodb" | "mongodb+srv" = "mongodb";
    let rest = trimmed;

    if (rest.startsWith("mongodb+srv://")) {
      scheme = "mongodb+srv";
      rest = rest.slice("mongodb+srv://".length);
    } else if (rest.startsWith("mongodb://")) {
      scheme = "mongodb";
      rest = rest.slice("mongodb://".length);
    } else {
      // No scheme, assume mongodb://
      rest = trimmed;
    }

    config.uri.scheme = scheme;

    // Split off options after ?
    let optionsStr = "";
    const qIdx = rest.indexOf("?");
    if (qIdx !== -1) {
      optionsStr = rest.slice(qIdx + 1);
      rest = rest.slice(0, qIdx);
    }

    // Split off database after /
    let database = "";
    const slashIdx = rest.indexOf("/");
    if (slashIdx !== -1) {
      database = rest.slice(slashIdx + 1);
      rest = rest.slice(0, slashIdx);
    }
    if (database) config.uri.database = database;

    // Split auth from hosts
    const atIdx = rest.lastIndexOf("@");
    let hostsPart = rest;
    if (atIdx !== -1) {
      const authPart = rest.slice(0, atIdx);
      hostsPart = rest.slice(atIdx + 1);

      const colonIdx = authPart.indexOf(":");
      if (colonIdx !== -1) {
        config.uri.username = decodeURIComponent(authPart.slice(0, colonIdx));
        config.uri.password = decodeURIComponent(authPart.slice(colonIdx + 1));
      } else {
        config.uri.username = decodeURIComponent(authPart);
      }
      config.authMode = "scramSha256";
    }

    // Parse hosts
    const hosts = hostsPart.split(",").map((h) => {
      const [host, portStr] = h.split(":");
      return {
        host: host || "localhost",
        port: portStr ? Number.parseInt(portStr, 10) : 27017,
      };
    });
    config.uri.hosts = hosts;

    // Parse options
    if (optionsStr) {
      const options: Record<string, string> = {};
      for (const pair of optionsStr.split("&")) {
        const [key, val] = pair.split("=");
        if (key && val) options[decodeURIComponent(key)] = decodeURIComponent(val);
      }
      config.uri.options = options;

      // Check for SSL/TLS
      if (options.ssl === "true" || options.tls === "true") {
        config.sslConfig = { enabled: true, allowInvalidCertificates: false };
      }

      // Auth mechanism
      if (options.authMechanism) {
        const mech = options.authMechanism.toUpperCase();
        if (mech === "SCRAM-SHA-1") config.authMode = "scramSha1";
        else if (mech === "SCRAM-SHA-256") config.authMode = "scramSha256";
        else if (mech.includes("X509")) config.authMode = "x509";
      }

      // Auth source
      if (options.authSource) {
        config.uri.options = {
          ...config.uri.options,
          authSource: options.authSource,
        };
      }

      // Replica set
      if (options.replicaSet) {
        config.connectionType = "replica";
      }
    }

    // Generate a name from host
    config.name = hosts[0].host;
    if (config.uri.database) config.name += `/${config.uri.database}`;
  } catch {
    // If parsing fails, just return defaults
  }

  return config;
}

export function buildConnectionString(config: ConnectionConfig): string {
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
