use anyhow::Result;
use axum::{
    extract::State,
    http::StatusCode,
    response::{Html, Json},
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tera::{Context, Tera};
use tokio::sync::RwLock;
use tokio::process::Command as TokioCommand;
use tokio::io::{AsyncBufReadExt, BufReader};
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, services::ServeDir};
use tracing::{error, info};

pub mod models;
pub mod services;

use models::*;
use services::*;

#[derive(Clone)]
pub struct AppState {
    pub tera: Tera,
    pub bot_status: Arc<RwLock<BotStatus>>,
    pub log_service: Arc<LogService>,
}

pub async fn create_app() -> Result<Router> {
    // 初始化模板引擎
    let mut tera = Tera::new("templates/**/*")?;
    tera.autoescape_on(vec!["html"]);

    // 创建应用状态
    let app_state = AppState {
        tera,
        bot_status: Arc::new(RwLock::new(BotStatus::default())),
        log_service: Arc::new(LogService::new()),
    };

    // 创建路由
    let app = Router::new()
        .route("/", get(index_handler))
        .route("/api/status", get(get_status))
        .route("/api/status", post(update_status))
        .route("/api/logs/:service", get(get_logs))
        .route("/api/start/:service", post(start_service))
        .route("/api/stop/:service", post(stop_service))
        .nest_service("/static", ServeDir::new("static"))
        .layer(
            ServiceBuilder::new()
                .layer(CorsLayer::permissive())
        )
        .with_state(app_state);

    Ok(app)
}

async fn index_handler(State(state): State<AppState>) -> Result<Html<String>, StatusCode> {
    let mut context = Context::new();
    context.insert("title", "MoFox-UI");
    
    match state.tera.render("index.html", &context) {
        Ok(html) => Ok(Html(html)),
        Err(e) => {
            error!("模板渲染失败: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_status(State(state): State<AppState>) -> Json<BotStatus> {
    let status = state.bot_status.read().await;
    Json(status.clone())
}

async fn update_status(
    State(state): State<AppState>,
    Json(new_status): Json<BotStatus>,
) -> StatusCode {
    let mut status = state.bot_status.write().await;
    *status = new_status;
    StatusCode::OK
}

async fn get_logs(
    State(state): State<AppState>,
    axum::extract::Path(service): axum::extract::Path<String>,
) -> Json<Vec<LogEntry>> {
    let logs = state.log_service.get_logs(&service).await;
    Json(logs)
}

async fn start_service(
    State(state): State<AppState>,
    axum::extract::Path(service): axum::extract::Path<String>,
) -> Json<ServiceResponse> {
    info!("启动服务: {}", service);
    
    let result = match service.as_str() {
        "bot" => {
            // 启动 MoFox-Bot (bot.py)
            spawn_service_with_logging(state.clone(), service.clone(), "python", "bot.py", "../Bot").await
        },
        "adapter" => {
            // 启动 Adapter (main.py)
            spawn_service_with_logging(state.clone(), service.clone(), "python", "main.py", "../Adapter").await
        },
        "matcha" => {
            // 启动 Matcha-Adapter (main.py)
            spawn_service_with_logging(state.clone(), service.clone(), "python", "main.py", "../Matcha-Adapter").await
        },
        _ => {
            let error_msg = "未知服务".to_string();
            state.log_service.add_log(&service, "ERROR", &error_msg).await;
            (false, error_msg)
        }
    };
    
    Json(ServiceResponse {
        success: result.0,
        message: result.1,
    })
}

// 启动服务并捕获日志
async fn spawn_service_with_logging(
    state: AppState,
    service_name: String,
    command: &str,
    script: &str,
    working_dir: &str,
) -> (bool, String) {
    let service_display_name = match service_name.as_str() {
        "bot" => "MoFox-Bot",
        "adapter" => "Adapter", 
        "matcha" => "Matcha-Adapter",
        _ => &service_name,
    };

    match TokioCommand::new(command)
        .arg(script)
        .current_dir(working_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
    {
        Ok(mut child) => {
            // 捕获 stdout
            if let Some(stdout) = child.stdout.take() {
                let state_clone = state.clone();
                let service_clone = service_name.clone();
                tokio::spawn(async move {
                    let reader = BufReader::new(stdout);
                    let mut lines = reader.lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        state_clone.log_service.add_log(&service_clone, "INFO", &line).await;
                    }
                });
            }

            // 捕获 stderr
            if let Some(stderr) = child.stderr.take() {
                let state_clone = state.clone();
                let service_clone = service_name.clone();
                tokio::spawn(async move {
                    let reader = BufReader::new(stderr);
                    let mut lines = reader.lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        state_clone.log_service.add_log(&service_clone, "ERROR", &line).await;
                    }
                });
            }

            let start_message = format!("{} 启动成功", service_display_name);
            state.log_service.add_log(&service_name, "INFO", &start_message).await;
            (true, start_message)
        }
        Err(e) => {
            let error_msg = format!("{} 启动失败: {}", service_display_name, e);
            state.log_service.add_log(&service_name, "ERROR", &error_msg).await;
            (false, error_msg)
        }
    }
}

async fn stop_service(
    State(state): State<AppState>,
    axum::extract::Path(service): axum::extract::Path<String>,
) -> Json<ServiceResponse> {
    info!("停止服务: {}", service);
    
    let result = match service.as_str() {
        "bot" => {
            state.log_service.add_log(&service, "INFO", "MoFox-Bot 停止成功").await;
            (true, "MoFox-Bot 停止成功".to_string())
        },
        "adapter" => {
            state.log_service.add_log(&service, "INFO", "Adapter 停止成功").await;
            (true, "Adapter 停止成功".to_string())
        },
        "matcha" => {
            state.log_service.add_log(&service, "INFO", "Matcha-Adapter 停止成功").await;
            (true, "Matcha-Adapter 停止成功".to_string())
        },
        _ => (false, "未知服务".to_string())
    };
    
    Json(ServiceResponse {
        success: result.0,
        message: result.1,
    })
}
