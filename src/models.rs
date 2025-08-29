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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatisticsData {
    pub total_messages: u64,
    pub total_requests: u64,
    pub total_cost: f64,
    pub online_time: String,
    pub model_stats: Vec<ModelStat>,
    pub module_stats: Vec<ModuleStat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStat {
    pub name: String,
    pub calls: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cost: f64,
    pub avg_time: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleStat {
    pub name: String,
    pub calls: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cost: f64,
    pub avg_time: f64,
}
