import type { ExplainResult, QueryRequest, QueryResult } from "@/types/query";
import { invoke } from "@tauri-apps/api/core";

export async function executeQuery(request: QueryRequest): Promise<QueryResult> {
  return invoke("execute_query", { request });
}

export async function explainQuery(request: QueryRequest): Promise<ExplainResult> {
  return invoke("explain_query", { request });
}

export async function cancelExecution(connectionId: string): Promise<boolean> {
  return invoke("cancel_execution", { connectionId });
}
