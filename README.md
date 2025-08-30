# MoFox-UI

MaiBot-Plus 的 Web 管理界面，使用 Rust + Axum 作为后端，DaisyUI + TailwindCSS 作为前端框架。

## 功能特性

### 已实现功能

#### 1. Logo 区域
- 显示 MoFox-UI 品牌标识
- 简洁的米黄色设计风格

#### 2. Bot 状态监控界面
- **服务控制**: 启动/停止 Bot、Adapter、Matcha-Adapter 服务（优化为紧凑布局）
- **状态指示**: 实时显示各服务运行状态（绿色表示运行中，红色表示已停止）
- **实时日志**: 通过WebSocket实现的实时日志显示和推送

#### 7. 监控面板
- **日志输出**: 分别显示 Bot、Adapter、Matcha-Adapter 的日志
- **实时监控**: WebSocket实时日志推送，无需手动刷新
- **日志管理**: 支持清空和刷新日志功能

#### 8. 网页设置界面 ✨
- **主题切换**: 支持米黄、深色、蓝色三种主题风格
- **显示设置**: 自动刷新、时间戳显示、紧凑模式等选项
- **高级设置**: WebSocket重连间隔、日志缓存大小配置
- **配置管理**: 设置保存、重置、导出功能

### 待开发功能

#### 3. 配置管理界面
- Bot 和 Adapter 配置文件管理
- 本地仓库更新功能（参考 onekey.py 实现）
- 配置文件备份和恢复

#### 4. 插件管理界面
- 插件安装、卸载、启用、禁用
- 插件配置管理
- 插件市场浏览

#### 5. Live2D 模型界面
- Live2D 模型展示和交互
- 需要 Bot 支持 L2D 聊天功能
- 模型切换和配置

## 技术栈

### 后端 (Rust)
- **Axum**: 高性能异步 Web 框架，支持WebSocket
- **Tokio**: 异步运行时
- **Tera**: 模板引擎
- **Serde**: 序列化/反序列化
- **Chrono**: 时间处理
- **Futures**: 异步编程工具

### 前端
- **DaisyUI**: 基于 TailwindCSS 的组件库
- **TailwindCSS**: 原子化 CSS 框架
- **Vanilla JavaScript**: 原生 JavaScript，无额外框架依赖

## 安装和运行

### 前置要求
- Rust 1.70+
- Cargo

### 安装步骤

1. 进入项目目录：
```bash
cd MoFox-UI
```

2. 安装依赖并运行：
```bash
cargo run
```

3. 打开浏览器访问：
```
http://localhost:3000
```

### 开发模式

```bash
# 监听文件变化自动重启（需要安装 cargo-watch）
cargo install cargo-watch
cargo watch -x run
```

## 项目结构

```
MoFox-UI/
├── src/
│   ├── main.rs          # 应用入口
│   ├── lib.rs           # 库文件和路由定义
│   ├── models.rs        # 数据模型
│   └── services.rs      # 业务逻辑服务
├── templates/
│   └── index.html       # 主页面模板
├── static/
│   ├── css/
│   │   └── custom.css   # 自定义样式
│   └── js/
│       └── app.js       # 前端 JavaScript
├── Cargo.toml           # Rust 依赖配置
└── README.md            # 项目说明
```

## API 接口

### 状态管理
- `GET /api/status` - 获取所有服务状态
- `POST /api/status` - 更新服务状态

### 服务控制
- `POST /api/start/{service}` - 启动指定服务
- `POST /api/stop/{service}` - 停止指定服务

### 日志管理
- `GET /api/logs/{service}` - 获取指定服务的日志

## 设计风格

- **主色调**: 米黄色 (#fefdf6, #f7f5e6)
- **强调色**: 浅棕色 (#d4a574, #e6c79a)
- **文本色**: 深灰色 (#3a3a3a, #666666)
- **风格**: 简洁、温暖、现代化

## 开发计划

### 第一阶段 ✅
- [x] 基础项目结构搭建
- [x] Rust 后端框架
- [x] 前端界面框架（区域1、2、7）
- [x] 服务状态监控和控制
- [x] 日志显示功能

### 第二阶段 🚧
- [ ] 配置管理功能实现
- [ ] 仓库更新功能集成
- [ ] 插件管理系统
- [ ] Live2D 模型集成

### 第三阶段 📋
- [ ] 用户权限管理
- [ ] 主题切换功能
- [ ] 移动端适配优化
- [ ] 性能监控和优化

## 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。