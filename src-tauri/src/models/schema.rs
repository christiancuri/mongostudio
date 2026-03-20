use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaField {
    pub name: String,
    pub path: String,
    pub types: HashMap<String, TypeInfo>,
    pub total_count: u64,
    #[serde(default)]
    pub children: Vec<SchemaField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeInfo {
    pub count: u64,
    pub percentage: f64,
    #[serde(default)]
    pub sample_values: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaAnalysisResult {
    pub collection: String,
    pub documents_sampled: u64,
    pub fields: Vec<SchemaField>,
}
