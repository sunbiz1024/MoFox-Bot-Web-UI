/*
MoFox-UI的后端代码
*/
use anyhow::Result;
use axum::{
    extract::{State, WebSocketUpgrade, ws::{WebSocket, Message}},
    http::StatusCode,
    response::{Html, Json, Response},
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tera::{Context, Tera};
use tokio::sync::{RwLock, broadcast};
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
    pub log_broadcaster: Arc<broadcast::Sender<String>>,
}

pub async fn create_app() -> Result<Router> {
    // 初始化模板引擎
    let mut tera = Tera::new("templates/**/*")?;
    tera.autoescape_on(vec!["html"]);

    // 创建日志广播通道
    let (log_tx, _) = broadcast::channel(2000);  // 默认2000条日志

    // 创建应用状态
    let app_state = AppState {
        tera,
        bot_status: Arc::new(RwLock::new(BotStatus::default())),
        log_service: Arc::new(LogService::new()),
        log_broadcaster: Arc::new(log_tx),
    };

    // 创建路由
    let app = Router::new()
        .route("/", get(index_handler))
        .route("/api/status", get(get_status))
        .route("/api/status", post(update_status))
        .route("/api/logs/:service", get(get_logs))
        .route("/api/start/:service", post(start_service))
        .route("/api/stop/:service", post(stop_service))
        .route("/ws", get(websocket_handler))
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
            // 启动 MoFox-Bot (__main__.py)
            spawn_service_with_logging(state.clone(), service.clone(), "python", "__main__.py", "../Bot").await
        },
        "adapter" => {
            // 启动 Adapter (__main__.py)
            spawn_service_with_logging(state.clone(), service.clone(), "python", "__main__.py", "../Adapter").await
        },
        "matcha" => {
            // 启动 Matcha-Adapter (__main__.py)
            spawn_service_with_logging(state.clone(), service.clone(), "python", "__main__.py", "../Matcha-Adapter").await
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
    _command: &str,
    script: &str,
    working_dir: &str,
) -> (bool, String) {
    let service_display_name = match service_name.as_str() {
        "bot" => "MoFox-Bot",
        "adapter" => "Adapter", 
        "matcha" => "Matcha-Adapter",
        _ => &service_name,
    };

    // 使用内置Python环境
    let python_path = "../python_embedded/python.exe";
    
    match TokioCommand::new(python_path)
        .arg(script)
        .current_dir(working_dir)
        .env("EULA_AGREE", "55243b84ba00cd3d8774b17d30ee5b98")
        .env("PRIVACY_AGREE", "4264f89020356519cf4d2e840c5d8088") // 自动配置同意环境变量喵
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
    {
        Ok(mut child) => {
            let process_id = child.id();
            let start_message = format!("{} 正在启动... (PID: {:?})", service_display_name, process_id);
            state.log_service.add_log(&service_name, "INFO", &start_message).await;

            // 捕获 stdout（就是日志输出的其实，但是不知道为什么还有一点问题，在实际的面板上基本看不到日志这一块）
            if let Some(stdout) = child.stdout.take() {
                let state_clone = state.clone();
                let service_clone = service_name.clone();
                tokio::spawn(async move {
                    let reader = BufReader::new(stdout);
                    let mut lines = reader.lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        if !line.trim().is_empty() {
                            state_clone.log_service.add_log(&service_clone, "INFO", &line).await;
                        }
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
                        if !line.trim().is_empty() {
                            state_clone.log_service.add_log(&service_clone, "ERROR", &line).await;
                        }
                    }
                });
            }

            // 监控进程状态
            let state_clone = state.clone();
            let service_clone = service_name.clone();
            let service_display_clone = service_display_name.to_string();
            tokio::spawn(async move {
                match child.wait().await {
                    Ok(exit_status) => {
                        let msg = if exit_status.success() {
                            format!("{} 进程正常退出", service_display_clone)
                        } else {
                            format!("{} 进程异常退出，退出码: {:?}", service_display_clone, exit_status.code())
                        };
                        state_clone.log_service.add_log(&service_clone, "WARN", &msg).await;
                    }
                    Err(e) => {
                        let msg = format!("{} 进程监控失败: {}", service_display_clone, e);
                        state_clone.log_service.add_log(&service_clone, "ERROR", &msg).await;
                    }
                }
            });

            let success_message = format!("{} 启动命令已执行", service_display_name);  // 启动命令真的有吗？
            state.log_service.add_log(&service_name, "INFO", &success_message).await;
            (true, success_message)
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
    // 这里看起来像就只是输出了一个日志但是没有实际处理停止进程的功能欸
    
    Json(ServiceResponse {
        success: result.0,
        message: result.1,
    })
}

// WebSocket 处理函数
async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(|socket| websocket_connection(socket, state))
}

async fn websocket_connection(socket: WebSocket, state: AppState) {
    use futures_util::{SinkExt, StreamExt};
    
    let mut rx = state.log_broadcaster.subscribe();
    let (mut sender, mut receiver) = socket.split();

    // 发送WebSocket消息的任务
    let send_task = tokio::spawn(async move {
        while let Ok(log_msg) = rx.recv().await {
            if sender.send(Message::Text(log_msg)).await.is_err() {
                break;
            }
        }
    });

    // 接收WebSocket消息的任务（用于心跳等）
    let recv_task = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            if let Ok(msg) = msg {
                match msg {
                    Message::Close(_) => break,
                    Message::Pong(_) | Message::Ping(_) => {
                        // 处理心跳
                    },
                    _ => {}
                }
            }
        }
    });

    // 等待任意一个任务完成
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }
}
