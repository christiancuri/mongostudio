import { invoke } from "@tauri-apps/api/core";
import type { ConnectionConfig } from "@/types/connection";

export async function connect(config: ConnectionConfig): Promise<string> {
  return invoke("connect", { config });
}

export async function disconnect(connectionId: string): Promise<void> {
  return invoke("disconnect", { connectionId });
}

export async function testConnection(config: ConnectionConfig): Promise<string> {
  return invoke("test_connection", { config });
}

export async function listSavedConnections(): Promise<ConnectionConfig[]> {
  return invoke("list_saved_connections");
}

export async function saveConnection(config: ConnectionConfig): Promise<void> {
  return invoke("save_connection", { config });
}

export async function deleteConnection(connectionId: string): Promise<void> {
  return invoke("delete_connection", { connectionId });
}
