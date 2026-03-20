import { useState, useCallback } from "react";
import { analyzeSchema } from "@/api/schema";
import type { SchemaAnalysisResult } from "@/types/schema";

const schemaCache = new Map<string, SchemaAnalysisResult>();

function getCacheKey(
  connectionId: string,
  database: string,
  collection: string,
): string {
  return `${connectionId}:${database}:${collection}`;
}

export function useSchema() {
  const [loading, setLoading] = useState(false);

  const getSchema = useCallback(
    async (
      connectionId: string,
      database: string,
      collection: string,
      sampleSize = 1000,
      forceRefresh = false,
    ): Promise<SchemaAnalysisResult | null> => {
      const key = getCacheKey(connectionId, database, collection);
      if (!forceRefresh) {
        const cached = schemaCache.get(key);
        if (cached) return cached;
      }

      setLoading(true);
      try {
        const result = await analyzeSchema(
          connectionId,
          database,
          collection,
          sampleSize,
        );
        schemaCache.set(key, result);
        return result;
      } catch {
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const getFieldNames = useCallback(
    (
      connectionId: string,
      database: string,
      collection: string,
    ): string[] => {
      const key = getCacheKey(connectionId, database, collection);
      const cached = schemaCache.get(key);
      if (!cached) return [];
      return extractFieldNames(cached.fields);
    },
    [],
  );

  return { loading, getSchema, getFieldNames };
}

function extractFieldNames(
  fields: SchemaAnalysisResult["fields"],
  prefix = "",
): string[] {
  const names: string[] = [];
  for (const field of fields) {
    const fullPath = prefix ? `${prefix}.${field.name}` : field.name;
    names.push(fullPath);
    if (field.children.length > 0) {
      names.push(...extractFieldNames(field.children, fullPath));
    }
  }
  return names;
}
