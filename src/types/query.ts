export interface QueryRequest {
  connectionId: string;
  database: string;
  collection?: string;
  queryText: string;
  page?: number;
  pageSize?: number;
}

export interface QueryResult {
  documents: Record<string, unknown>[];
  totalCount?: number;
  executionTimeMs: number;
  page: number;
  pageSize: number;
  printOutput?: string[];
  isRawOutput?: boolean;
}

export interface ExplainResult {
  plan: Record<string, unknown>;
  executionTimeMs: number;
}
