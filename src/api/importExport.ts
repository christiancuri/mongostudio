import { invoke } from "@tauri-apps/api/core";

export async function importData(
  connectionId: string,
  database: string,
  collection: string,
  filePath: string,
  format: string,
): Promise<{ imported: number }> {
  return invoke("import_data", { connectionId, database, collection, filePath, format });
}

export async function exportData(
  connectionId: string,
  database: string,
  collection: string,
  filePath: string,
  format: string,
): Promise<{ exported: number }> {
  return invoke("export_data", { connectionId, database, collection, filePath, format });
}
