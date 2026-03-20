use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseInfo {
    pub name: String,
    pub size_on_disk: Option<i64>,
    pub empty: Option<bool>,
    pub accessible: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionInfo {
    pub name: String,
    pub collection_type: String,
    pub doc_count: Option<i64>,
    pub size: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionStats {
    pub ns: String,
    pub count: i64,
    pub size: i64,
    pub avg_obj_size: Option<i64>,
    pub storage_size: i64,
    pub indexes: i64,
    pub index_size: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseStats {
    pub db: String,
    pub collections: i64,
    pub data_size: i64,
    pub storage_size: i64,
    pub indexes: i64,
    pub index_size: i64,
}
