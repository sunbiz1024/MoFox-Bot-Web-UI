use mofox_ui::create_app;
use std::net::SocketAddr;
use tracing::{info, Level};
use tracing_subscriber;
/*
阿卧槽这rs怎么这么坏呜呜呜
*/
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 初始化日志
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    info!("正在启动 MoFox-UI 服务器...");

    // 创建应用
    let app = create_app().await?;

    // 设置服务器地址
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    info!("服务器启动在: http://{}", addr);

    // 启动服务器
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
