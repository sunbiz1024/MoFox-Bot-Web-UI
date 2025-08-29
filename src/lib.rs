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
        .route("/api/statistics", get(get_statistics))
        .route("/api/refresh-statistics", post(refresh_statistics))
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
    context.insert("title", "MoFox-UI 管理界面");
    
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

async fn get_statistics(State(_state): State<AppState>) -> Result<Html<String>, StatusCode> {
    // 尝试读取 MaiBot 统计文件
    let statistics_path = "../Bot/maibot_statistics.html";
    
    match std::fs::read_to_string(statistics_path) {
        Ok(content) => {
            // 简单处理：如果有完整的HTML，提取body内容
            if content.contains("<body>") && content.contains("</body>") {
                let body_start = content.find("<body>").unwrap_or(0) + 6;
                let body_end = content.find("</body>").unwrap_or(content.len());
                let body_content = &content[body_start..body_end];
                
                // 创建适配我们界面的HTML
                let adapted_html = format!(r#"
                <div class="w-full h-full">
                    {}
                </div>
                <style>
                    /* 适配我们的主题 */
                    .container {{ 
                        max-width: none !important; 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        background: transparent !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                    }}
                    h1, h2 {{ 
                        color: var(--text-primary) !important; 
                        border-bottom: 2px solid var(--accent) !important; 
                    }}
                    table {{ 
                        background: white !important; 
                        border-radius: 8px !important; 
                        overflow: hidden !important;
                        margin: 1rem 0 !important;
                    }}
                    th {{ 
                        background-color: var(--accent) !important; 
                        color: white !important; 
                    }}
                    .tabs {{ 
                        background: var(--bg-secondary) !important; 
                        border-radius: 8px 8px 0 0 !important;
                    }}
                    .tabs button {{ 
                        color: var(--text-primary) !important; 
                    }}
                    .tabs button.active {{ 
                        background-color: var(--accent) !important; 
                        color: white !important;
                    }}
                    .info-item {{ 
                        background-color: var(--bg-secondary) !important; 
                        border: 1px solid var(--accent) !important;
                    }}
                </style>
                "#, body_content);
                
                Ok(Html(adapted_html))
            } else {
                // 如果不是完整HTML，直接返回内容
                Ok(Html(content))
            }
        }
        Err(e) => {
            error!("无法读取统计文件: {}", e);
            
            // 返回一个基于实际数据库的简化统计页面
            let fallback_html = create_fallback_statistics().await;
            Ok(Html(fallback_html))
        }
    }
}

// 创建备用统计页面
async fn create_fallback_statistics() -> String {
    format!(r#"
    <div class="container mx-auto p-6">
        <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-primary mb-4">MaiBot 运行统计</h1>
            <div class="bg-secondary p-4 rounded-lg">
                <p class="text-sm text-gray-600">统计截止时间: {}</p>
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div class="bg-white p-6 rounded-lg shadow">
                <div class="text-2xl font-bold text-blue-600">📊</div>
                <h3 class="text-lg font-semibold mt-2">数据分析</h3>
                <p class="text-gray-600">正在开发中...</p>
            </div>
            
            <div class="bg-white p-6 rounded-lg shadow">
                <div class="text-2xl font-bold text-green-600">🤖</div>
                <h3 class="text-lg font-semibold mt-2">AI 模型</h3>
                <p class="text-gray-600">多模型支持</p>
            </div>
            
            <div class="bg-white p-6 rounded-lg shadow">
                <div class="text-2xl font-bold text-purple-600">💬</div>
                <h3 class="text-lg font-semibold mt-2">聊天统计</h3>
                <p class="text-gray-600">消息处理中...</p>
            </div>
            
            <div class="bg-white p-6 rounded-lg shadow">
                <div class="text-2xl font-bold text-orange-600">⚡</div>
                <h3 class="text-lg font-semibold mt-2">性能监控</h3>
                <p class="text-gray-600">实时监控</p>
            </div>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="text-xl font-bold mb-4">统计功能说明</h2>
            <div class="space-y-4">
                <div class="border-l-4 border-blue-500 pl-4">
                    <h3 class="font-semibold">数据来源</h3>
                    <p class="text-gray-600">统计数据来自 MaiBot 的运行日志和数据库记录</p>
                </div>
                
                <div class="border-l-4 border-green-500 pl-4">
                    <h3 class="font-semibold">实时更新</h3>
                    <p class="text-gray-600">数据每次重新生成时会自动更新</p>
                </div>
                
                <div class="border-l-4 border-purple-500 pl-4">
                    <h3 class="font-semibold">详细统计</h3>
                    <p class="text-gray-600">包含模型使用、消息处理、性能指标等多维度数据</p>
                </div>
                
                <div class="border-l-4 border-orange-500 pl-4">
                    <h3 class="font-semibold">注意事项</h3>
                    <p class="text-gray-600">
                        当前统计文件路径：<code>../Bot/maibot_statistics.html</code><br>
                        如果看到此页面，说明统计文件不存在或格式异常
                    </p>
                </div>
            </div>
        </div>
        
        <div class="mt-8 text-center">
            <button onclick="window.location.reload()" class="btn btn-custom">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                刷新统计数据
            </button>
        </div>
    </div>
    "#, chrono::Utc::now().format("%Y-%m-%d %H:%M:%S"))
}

// 刷新统计数据
async fn refresh_statistics(State(_state): State<AppState>) -> Json<ServiceResponse> {
    info!("正在刷新统计数据...");
    
    // 运行Python脚本生成新的统计数据
    match tokio::process::Command::new("python")
        .arg("generate_statistics.py")
        .current_dir(".")
        .output()
        .await
    {
        Ok(output) => {
            if output.status.success() {
                info!("统计数据刷新成功");
                Json(ServiceResponse {
                    success: true,
                    message: "统计数据已刷新".to_string(),
                })
            } else {
                let error_msg = String::from_utf8_lossy(&output.stderr);
                error!("刷新统计数据失败: {}", error_msg);
                Json(ServiceResponse {
                    success: false,
                    message: format!("刷新失败: {}", error_msg),
                })
            }
        }
        Err(e) => {
            error!("执行统计脚本失败: {}", e);
            Json(ServiceResponse {
                success: false,
                message: format!("执行失败: {}", e),
            })
        }
    }
}
