use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub connection_type: ConnectionType,
    pub uri: ConnectionUri,
    pub auth_mode: AuthMode,
    #[serde(default)]
    pub ssl_config: Option<SslConfig>,
    #[serde(default)]
    pub ssh_tunnel: Option<SshTunnelConfig>,
    #[serde(default = "default_color")]
    pub color_flag: String,
    #[serde(default = "default_true")]
    pub editable: bool,
}

fn default_color() -> String {
    "gray".to_string()
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionType {
    Direct,
    Replica,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionUri {
    pub scheme: String,
    pub hosts: Vec<HostPort>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub database: Option<String>,
    #[serde(default)]
    pub options: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostPort {
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
}

fn default_port() -> u16 {
    27017
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AuthMode {
    None,
    ScramSha1,
    ScramSha256,
    X509,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SslConfig {
    pub enabled: bool,
    #[serde(default)]
    pub ca_file: Option<String>,
    #[serde(default)]
    pub cert_file: Option<String>,
    #[serde(default)]
    pub key_file: Option<String>,
    #[serde(default)]
    pub allow_invalid_certificates: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshTunnelConfig {
    pub host: String,
    #[serde(default = "default_ssh_port")]
    pub port: u16,
    pub username: String,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub private_key: Option<String>,
}

fn default_ssh_port() -> u16 {
    22
}

impl ConnectionConfig {
    pub fn to_connection_string(&self) -> String {
        let is_srv = self.uri.scheme == "mongodb+srv";

        let host_str = self
            .uri
            .hosts
            .iter()
            .map(|h| {
                if is_srv {
                    h.host.clone()
                } else {
                    format!("{}:{}", h.host, h.port)
                }
            })
            .collect::<Vec<_>>()
            .join(",");

        let auth = match (&self.uri.username, &self.uri.password) {
            (Some(u), Some(p)) => format!("{u}:{p}@"),
            (Some(u), None) => format!("{u}@"),
            _ => String::new(),
        };

        let db = self.uri.database.as_deref().unwrap_or("");

        // Append options from the options field if they exist
        let options_str = if let Some(obj) = self.uri.options.as_object() {
            let pairs: Vec<String> = obj
                .iter()
                .filter(|(_, v)| !v.is_null() && v.as_str() != Some(""))
                .map(|(k, v)| {
                    let binding = v.to_string();
                    let val = v.as_str().unwrap_or(&binding);
                    format!("{k}={val}")
                })
                .collect();
            if pairs.is_empty() {
                String::new()
            } else {
                format!("?{}", pairs.join("&"))
            }
        } else {
            String::new()
        };

        format!("{}://{auth}{host_str}/{db}{options_str}", self.uri.scheme)
    }
}
