use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryRequest {
    pub connection_id: String,
    pub database: String,
    pub collection: String,
    pub query_text: String,
    #[serde(default)]
    pub page: Option<u64>,
    #[serde(default = "default_page_size")]
    pub page_size: Option<u64>,
}

fn default_page_size() -> Option<u64> {
    Some(50)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub documents: Vec<serde_json::Value>,
    pub total_count: Option<i64>,
    pub execution_time_ms: u128,
    pub page: u64,
    pub page_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplainResult {
    pub plan: serde_json::Value,
    pub execution_time_ms: u128,
}
