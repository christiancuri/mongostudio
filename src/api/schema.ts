import { invoke } from "@tauri-apps/api/core";
import type { SchemaAnalysisResult } from "@/types/schema";

export async function analyzeSchema(
  connectionId: string,
  database: string,
  collection: string,
  sampleSize?: number,
): Promise<SchemaAnalysisResult> {
  return invoke("analyze_schema", { connectionId, database, collection, sampleSize });
}
