export interface Tab {
  id: string;
  title: string;
  type: TabType;
  connectionId?: string;
  database?: string;
  collection?: string;
  content?: string;
  dirty: boolean;
  colorFlag?: string;
}

export type TabType = "query" | "document" | "schema" | "monitoring" | "welcome";
