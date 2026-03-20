export interface DatabaseInfo {
  name: string;
  sizeOnDisk?: number;
  empty?: boolean;
  accessible: boolean;
}

export interface CollectionInfo {
  name: string;
  collectionType: string;
  docCount?: number;
  size?: number;
}

export interface CollectionStats {
  ns: string;
  count: number;
  size: number;
  avgObjSize?: number;
  storageSize: number;
  indexes: number;
  indexSize: number;
}

export interface DatabaseStats {
  db: string;
  collections: number;
  dataSize: number;
  storageSize: number;
  indexes: number;
  indexSize: number;
}

export interface IndexInfo {
  name: string;
  keys: Record<string, number>;
  size?: number;
  unique?: boolean;
}
