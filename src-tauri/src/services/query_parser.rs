use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedQuery {
    pub collection: String,
    pub operation: QueryOperation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum QueryOperation {
    Find {
        filter: serde_json::Value,
        projection: Option<serde_json::Value>,
        sort: Option<serde_json::Value>,
        limit: Option<i64>,
        skip: Option<u64>,
    },
    Aggregate {
        pipeline: Vec<serde_json::Value>,
    },
    InsertOne {
        document: serde_json::Value,
    },
    InsertMany {
        documents: Vec<serde_json::Value>,
    },
    UpdateOne {
        filter: serde_json::Value,
        update: serde_json::Value,
    },
    UpdateMany {
        filter: serde_json::Value,
        update: serde_json::Value,
    },
    DeleteOne {
        filter: serde_json::Value,
    },
    DeleteMany {
        filter: serde_json::Value,
    },
    CountDocuments {
        filter: serde_json::Value,
    },
    Distinct {
        field: String,
        filter: Option<serde_json::Value>,
    },
    CreateIndex {
        keys: serde_json::Value,
        options: Option<serde_json::Value>,
    },
    DropCollection,
}

#[allow(dead_code)]
pub fn parse_query(input: &str) -> Result<ParsedQuery, String> {
    // TODO: Implement full query parser
    let _ = input;
    Err("Query parser not yet implemented".to_string())
}
