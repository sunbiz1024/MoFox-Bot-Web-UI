use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotStatus {
    pub bot_running: bool,
    pub adapter_running: bool,
    pub matcha_adapter_running: bool,
    pub uptime: Option<DateTime<Utc>>,
    pub message_count: u64,
    pub request_count: u64,
    pub total_cost: f64,
}

impl Default for BotStatus {
    fn default() -> Self {
        Self {
            bot_running: false,
            adapter_running: false,
            matcha_adapter_running: false,
            uptime: None,
            message_count: 0,
            request_count: 0,
            total_cost: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub level: String,
    pub service: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceResponse {
    pub success: bool,
    pub message: String,
}
