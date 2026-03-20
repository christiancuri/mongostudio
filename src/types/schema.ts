export interface SchemaField {
  name: string;
  path: string;
  types: Record<string, TypeInfo>;
  totalCount: number;
  children: SchemaField[];
}

export interface TypeInfo {
  count: number;
  percentage: number;
  sampleValues: unknown[];
}

export interface SchemaAnalysisResult {
  collection: string;
  documentsSampled: number;
  fields: SchemaField[];
}
