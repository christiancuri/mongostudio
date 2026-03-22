import * as queryApi from "@/api/query";
import { useResultStore } from "@/stores/resultStore";
import type { QueryRequest } from "@/types/query";

export function useQuery() {
  const resultStore = useResultStore();

  const runQuery = async (tabId: string, request: QueryRequest) => {
    resultStore.setLoading(tabId, true);
    resultStore.clearError(tabId);
    try {
      const result = await queryApi.executeQuery(request);
      resultStore.setResult(tabId, result);
    } catch (error) {
      resultStore.setError(tabId, error instanceof Error ? error.message : String(error));
    } finally {
      resultStore.setLoading(tabId, false);
    }
  };

  const explainCurrentQuery = async (tabId: string, request: QueryRequest) => {
    try {
      return await queryApi.explainQuery(request);
    } catch (error) {
      resultStore.setError(tabId, error instanceof Error ? error.message : String(error));
      return null;
    }
  };

  return {
    ...resultStore,
    runQuery,
    explainCurrentQuery,
  };
}
