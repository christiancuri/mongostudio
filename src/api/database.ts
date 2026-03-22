import type {
  CollectionInfo,
  CollectionStats,
  DatabaseInfo,
  DatabaseStats,
} from "@/types/database";
import { invoke } from "@tauri-apps/api/core";

export async function listDatabases(connectionId: string): Promise<DatabaseInfo[]> {
  return invoke("list_databases", { connectionId });
}

export async function listCollections(
  connectionId: string,
  database: string,
): Promise<CollectionInfo[]> {
  return invoke("list_collections", { connectionId, database });
}

export async function listCollectionsWithStats(
  connectionId: string,
  database: string,
): Promise<CollectionInfo[]> {
  return invoke("list_collections_with_stats", { connectionId, database });
}

export async function getCollectionStats(
  connectionId: string,
  database: string,
  collection: string,
): Promise<CollectionStats> {
  return invoke("collection_stats", { connectionId, database, collection });
}

export async function getDatabaseStats(
  connectionId: string,
  database: string,
): Promise<DatabaseStats> {
  return invoke("database_stats", { connectionId, database });
}

export async function listIndexes(
  connectionId: string,
  database: string,
  collection: string,
): Promise<Record<string, unknown>[]> {
  return invoke("list_indexes", { connectionId, database, collection });
}

export async function getIndexesDetail(
  connectionId: string,
  database: string,
  collection: string,
): Promise<Record<string, unknown>[]> {
  return invoke("get_indexes_detail", { connectionId, database, collection });
}

export async function getIndexInfo(
  connectionId: string,
  database: string,
  collection: string,
  indexName: string,
): Promise<Record<string, unknown>> {
  return invoke("get_index_info", { connectionId, database, collection, indexName });
}
