use crate::models::LogEntry;
use chrono::Utc;
use std::collections::HashMap;
use tokio::sync::{RwLock, broadcast};

pub struct LogService {
    logs: RwLock<HashMap<String, Vec<LogEntry>>>,
    broadcaster: Option<broadcast::Sender<String>>,
}

impl LogService {
    pub fn new() -> Self {
        Self {
            logs: RwLock::new(HashMap::new()),
            broadcaster: None,
        }
    }

    pub fn with_broadcaster(broadcaster: broadcast::Sender<String>) -> Self {
        Self {
            logs: RwLock::new(HashMap::new()),
            broadcaster: Some(broadcaster),
        }
    }

    pub async fn add_log(&self, service: &str, level: &str, message: &str) {
        let mut logs = self.logs.write().await;
        let service_logs = logs.entry(service.to_string()).or_insert_with(Vec::new);
        
        let log_entry = LogEntry {
            timestamp: Utc::now(),
            level: level.to_string(),
            service: service.to_string(),
            message: message.to_string(),
        };

        service_logs.push(log_entry.clone());

        // 保持最新的 2000 条日志
        if service_logs.len() > 2000 {
            service_logs.drain(..service_logs.len() - 2000);
        }

        // 通过WebSocket广播日志
        if let Some(broadcaster) = &self.broadcaster {
            let log_json = serde_json::json!({
                "timestamp": log_entry.timestamp,
                "level": log_entry.level,
                "service": log_entry.service,
                "message": log_entry.message
            });
            let _ = broadcaster.send(log_json.to_string());
        }
    }

    pub async fn get_logs(&self, service: &str) -> Vec<LogEntry> {
        let logs = self.logs.read().await;
        logs.get(service).cloned().unwrap_or_default()
    }

    pub async fn clear_logs(&self, service: &str) {
        let mut logs = self.logs.write().await;
        logs.remove(service);
    }
}
