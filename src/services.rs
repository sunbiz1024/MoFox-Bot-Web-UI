use crate::models::LogEntry;
use chrono::Utc;
use std::collections::HashMap;
use tokio::sync::RwLock;

pub struct LogService {
    logs: RwLock<HashMap<String, Vec<LogEntry>>>,
}

impl LogService {
    pub fn new() -> Self {
        Self {
            logs: RwLock::new(HashMap::new()),
        }
    }

    pub async fn add_log(&self, service: &str, level: &str, message: &str) {
        let mut logs = self.logs.write().await;
        let service_logs = logs.entry(service.to_string()).or_insert_with(Vec::new);
        
        service_logs.push(LogEntry {
            timestamp: Utc::now(),
            level: level.to_string(),
            service: service.to_string(),
            message: message.to_string(),
        });

        // 保持最新的 2000 条日志
        if service_logs.len() > 2000 {
            service_logs.drain(..service_logs.len() - 2000);
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
