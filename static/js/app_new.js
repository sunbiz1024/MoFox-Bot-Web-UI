// MoFox-UI 前端 JavaScript

// 当前选中的服务和页面
let currentService = 'bot';
let currentSection = 'monitoring';
let serviceCardsCollapsed = false;

// 配置管理相关
let currentConfigTab = 'bot';
let configData = {
    bot: null,
    model: null,
    plugins: null
};
let configModified = false;

// WebSocket连接
let websocket = null;
let reconnectInterval = null;

// 服务状态
let serviceStatus = {
    bot: false,
    adapter: false,
    matcha: false
};

// 日志缓存
let logCache = {
    bot: [],
    adapter: [],
    matcha: []
};

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    console.log('MoFox-UI 前端已加载');
    loadWebSettings();
    initializeApp();
    startStatusPolling();
    updateStatusIndicators();
    initWebSocket();
    createBackToTopButton();
});

// 初始化WebSocket连接
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
        websocket = new WebSocket(wsUrl);
        
        websocket.onopen = function(event) {
            console.log('WebSocket连接已建立');
            clearInterval(reconnectInterval);
        };
        
        websocket.onmessage = function(event) {
            try {
                const logData = JSON.parse(event.data);
                handleRealtimeLog(logData);
            } catch (error) {
                console.error('解析日志数据失败:', error);
            }
        };
        
        websocket.onclose = function(event) {
            console.log('WebSocket连接已关闭，尝试重连...');
            websocket = null;
            
            // 5秒后重连
            reconnectInterval = setInterval(() => {
                initWebSocket();
            }, 5000);
        };
        
        websocket.onerror = function(error) {
            console.error('WebSocket连接错误:', error);
        };
    } catch (error) {
        console.error('创建WebSocket连接失败:', error);
    }
}

// 处理实时日志
function handleRealtimeLog(logData) {
    const service = logData.service;
    
    // 添加到缓存
    if (!logCache[service]) {
        logCache[service] = [];
    }
    logCache[service].push(logData);
    
    // 保持最新的1000条日志
    if (logCache[service].length > 1000) {
        logCache[service] = logCache[service].slice(-1000);
    }
    
    // 如果当前显示的是这个服务的日志，立即更新显示
    if (currentService === service) {
        appendLogToContainer(logData);
    }
}

// 向日志容器添加单条日志
function appendLogToContainer(logData) {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) return;
    
    const logLine = document.createElement('div');
    logLine.className = 'log-line';
    
    // 处理时间戳，支持多种格式
    let timestamp;
    if (logData.timestamp) {
        try {
            timestamp = new Date(logData.timestamp).toLocaleString('zh-CN');
        } catch (e) {
            timestamp = logData.timestamp;
        }
    } else {
        timestamp = new Date().toLocaleString('zh-CN');
    }
    
    const levelColor = getLevelColor(logData.level);
    
    logLine.innerHTML = `
        <span class="text-gray-400">[${timestamp}]</span>
        <span class="${levelColor}">${logData.level}</span>
        <span class="text-white">- ${logData.message}</span>
    `;
    
    logContainer.appendChild(logLine);
    
    // 保持在底部
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // 限制DOM中的日志条数以避免性能问题
    const logLines = logContainer.querySelectorAll('.log-line');
    if (logLines.length > 500) {
        for (let i = 0; i < logLines.length - 500; i++) {
            logLines[i].remove();
        }
    }
}

// 初始化应用
function initializeApp() {
    // 设置默认选中的导航项
    showSection('monitoring');
    showLogs('bot');
}

// 切换服务卡片折叠状态
function toggleServiceCards() {
    const serviceCards = document.getElementById('service-cards');
    const collapseIcon = document.getElementById('collapse-icon');
    const serviceControlPanel = document.getElementById('service-control-panel');
    
    serviceCardsCollapsed = !serviceCardsCollapsed;
    
    if (serviceCardsCollapsed) {
        serviceCards.classList.remove('service-cards-expanded');
        serviceCards.classList.add('service-cards-collapsed');
        collapseIcon.style.transform = 'rotate(-90deg)';
        serviceControlPanel.style.marginBottom = '1rem';
    } else {
        serviceCards.classList.remove('service-cards-collapsed');
        serviceCards.classList.add('service-cards-expanded');
        collapseIcon.style.transform = 'rotate(0deg)';
        serviceControlPanel.style.marginBottom = '1.5rem';
    }
    
    // 触发日志容器高度重新计算
    setTimeout(() => {
        adjustLogContainerHeight();
    }, 300);
}

// 显示指定部分
function showSection(sectionName) {
    // 隐藏所有部分
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.classList.remove('active');
        section.classList.add('hidden');
    });
    
    // 显示指定部分
    const targetSection = document.getElementById(sectionName + '-section');
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.classList.add('active');
    }
    
    // 更新导航项样式
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // 高亮当前选中的导航项
    const currentNavItem = document.querySelector(`[onclick="showSection('${sectionName}')"]`);
    if (currentNavItem) {
        currentNavItem.classList.add('active');
    }
    
    currentSection = sectionName;
    
    // 如果切换到配置管理页面，自动加载配置
    if (sectionName === 'config' && !isConfigLoaded) {
        loadConfigs();
    }
}

// 切换服务状态
async function toggleService(serviceName) {
    const button = document.querySelector(`#${serviceName}-action`).parentElement;
    const actionText = document.querySelector(`#${serviceName}-action`);
    
    // 添加加载状态
    button.classList.add('loading');
    button.disabled = true;
    
    try {
        const isRunning = serviceStatus[serviceName];
        const action = isRunning ? 'stop' : 'start';
        
        const response = await fetch(`/api/${action}/${serviceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log(result.message);
            
            // 更新本地状态
            serviceStatus[serviceName] = !isRunning;
            updateServiceStatus(serviceName, serviceStatus[serviceName]);
            
            // 添加日志
            addLogEntry(serviceName, 'INFO', result.message);
            
            // 显示通知
            showNotification(result.message, 'success');
        } else {
            throw new Error('服务操作失败');
        }
    } catch (error) {
        console.error('服务操作错误:', error);
        showNotification('操作失败: ' + error.message, 'error');
    } finally {
        // 移除加载状态
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// 更新服务状态显示
function updateServiceStatus(serviceName, isRunning) {
    const statusIndicator = document.getElementById(`${serviceName}-status`);
    const actionText = document.getElementById(`${serviceName}-action`);
    
    if (statusIndicator) {
        statusIndicator.setAttribute('data-status', isRunning ? 'running' : 'stopped');
        statusIndicator.className = `status-indicator ${isRunning ? 'status-running' : 'status-stopped'}`;
    }
    
    if (actionText) {
        actionText.textContent = isRunning ? '停止' : '启动';
    }
}

// 更新所有状态指示器
function updateStatusIndicators() {
    Object.keys(serviceStatus).forEach(service => {
        updateServiceStatus(service, serviceStatus[service]);
    });
}

// 显示日志
function showLogs(serviceName) {
    currentService = serviceName;
    
    // 更新选项卡样式
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.classList.remove('tab-active');
    });
    
    const currentTab = document.querySelector(`[onclick="showLogs('${serviceName}')"]`);
    if (currentTab) {
        currentTab.classList.add('tab-active');
    }
    
    // 显示缓存的日志
    displayLogs(logCache[serviceName] || []);
    
    // 加载最新日志
    loadLogs(serviceName);
}

// 加载日志
async function loadLogs(serviceName) {
    try {
        const response = await fetch(`/api/logs/${serviceName}`);
        if (response.ok) {
            const logs = await response.json();
            logCache[serviceName] = logs; // 缓存日志
            if (currentService === serviceName) {
                displayLogs(logs);
            }
        }
    } catch (error) {
        console.error('加载日志失败:', error);
    }
}

// 显示日志
function displayLogs(logs) {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) return;
    
    logContainer.innerHTML = '';
    
    if (logs.length === 0) {
        logContainer.innerHTML = '<div class="log-line text-gray-500">暂无日志记录</div>';
        return;
    }
    
    logs.forEach(log => {
        const logLine = document.createElement('div');
        logLine.className = 'log-line';
        
        const timestamp = new Date(log.timestamp).toLocaleString('zh-CN');
        const levelColor = getLevelColor(log.level);
        
        logLine.innerHTML = `
            <span class="text-gray-400">[${timestamp}]</span>
            <span class="${levelColor}">${log.level}</span>
            <span class="text-white">- ${log.message}</span>
        `;
        
        logContainer.appendChild(logLine);
    });
    
    // 滚动到底部
    logContainer.scrollTop = logContainer.scrollHeight;
}

// 获取日志级别颜色
function getLevelColor(level) {
    switch (level.toUpperCase()) {
        case 'ERROR': return 'text-red-400';
        case 'WARN': return 'text-yellow-400';
        case 'INFO': return 'text-blue-400';
        case 'DEBUG': return 'text-gray-400';
        default: return 'text-green-400';
    }
}

// 添加日志条目
function addLogEntry(service, level, message) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: level,
        service: service,
        message: message
    };
    
    // 添加到缓存
    if (!logCache[service]) {
        logCache[service] = [];
    }
    logCache[service].push(logEntry);
    
    // 保持最新的1000条日志
    if (logCache[service].length > 1000) {
        logCache[service] = logCache[service].slice(-1000);
    }
    
    // 如果当前显示的是这个服务的日志，立即更新显示
    if (currentService === service) {
        const logContainer = document.getElementById('log-container');
        if (logContainer) {
            const logLine = document.createElement('div');
            logLine.className = 'log-line';
            
            const timestamp = new Date(logEntry.timestamp).toLocaleString('zh-CN');
            const levelColor = getLevelColor(level);
            
            logLine.innerHTML = `
                <span class="text-gray-400">[${timestamp}]</span>
                <span class="${levelColor}">${level}</span>
                <span class="text-white">- ${message}</span>
            `;
            
            logContainer.appendChild(logLine);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    }
}

// 清空日志
function clearLogs() {
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
        logContainer.innerHTML = '<div class="log-line text-gray-500">日志已清空</div>';
    }
}

// 加载状态
async function loadStatus() {
    try {
        const response = await fetch('/api/status');
        if (response.ok) {
            const status = await response.json();
            updateDashboard(status);
        }
    } catch (error) {
        console.error('加载状态失败:', error);
    }
}

// 更新仪表板
function updateDashboard(status) {
    // 更新服务状态
    serviceStatus.bot = status.bot_running;
    serviceStatus.adapter = status.adapter_running;
    serviceStatus.matcha = status.matcha_adapter_running;
    
    updateStatusIndicators();
    
    // 更新统计信息
    updateElement('message-count', status.message_count.toLocaleString());
    updateElement('request-count', status.request_count.toLocaleString());
    updateElement('total-cost', '¥' + status.total_cost.toFixed(2));
    
    // 更新运行时间
    if (status.uptime) {
        const uptime = calculateUptime(new Date(status.uptime));
        updateElement('uptime', uptime);
    }
}

// 更新元素内容
function updateElement(id, content) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = content;
    }
}

// 计算运行时间
function calculateUptime(startTime) {
    const now = new Date();
    const diff = Math.floor((now - startTime) / 1000);
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// 开始状态轮询
function startStatusPolling() {
    // 每5秒更新一次状态
    setInterval(loadStatus, 5000);
    
    // 每2秒更新一次运行时间显示
    setInterval(() => {
        if (serviceStatus.bot || serviceStatus.adapter || serviceStatus.matcha) {
            loadStatus();
        }
    }, 2000);
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} fixed top-4 right-4 w-auto max-w-md z-50`;
    notification.innerHTML = `
        <div>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// 工具函数：防抖
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 网页设置相关功能

// 网页设置配置
let webSettings = {
    theme: 'light',
    autoRefresh: true,
    showTimestamp: true,
    compactMode: false,
    reconnectInterval: 5,
    logCacheSize: 1000
};

// 加载网页设置
function loadWebSettings() {
    try {
        const saved = localStorage.getItem('mofox-ui-settings');
        if (saved) {
            webSettings = { ...webSettings, ...JSON.parse(saved) };
        }
    } catch (error) {
        console.error('加载设置失败:', error);
    }
    
    // 应用设置到界面
    applyWebSettings();
}

// 应用网页设置
function applyWebSettings() {
    // 应用主题
    applyTheme(webSettings.theme);
    
    // 应用设置到控件
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    const timestampToggle = document.getElementById('timestamp-toggle');
    const compactModeToggle = document.getElementById('compact-mode-toggle');
    const reconnectSelect = document.getElementById('reconnect-interval-select');
    const logCacheSelect = document.getElementById('log-cache-size-select');
    
    if (autoRefreshToggle) autoRefreshToggle.checked = webSettings.autoRefresh;
    if (timestampToggle) timestampToggle.checked = webSettings.showTimestamp;
    if (compactModeToggle) compactModeToggle.checked = webSettings.compactMode;
    if (reconnectSelect) reconnectSelect.value = webSettings.reconnectInterval;
    if (logCacheSelect) logCacheSelect.value = webSettings.logCacheSize;
    
    // 应用紧凑模式
    if (webSettings.compactMode) {
        document.body.classList.add('compact-mode');
    } else {
        document.body.classList.remove('compact-mode');
    }
}

// 切换主题
function changeTheme(themeName) {
    webSettings.theme = themeName;
    applyTheme(themeName);
    
    // 更新主题卡片选中状态
    document.querySelectorAll('.theme-card').forEach(card => {
        card.classList.remove('border-accent');
        card.classList.add('border-transparent');
    });
    
    const selectedCard = document.querySelector(`[data-theme="${themeName}"]`);
    if (selectedCard) {
        selectedCard.classList.remove('border-transparent');
        selectedCard.classList.add('border-accent');
    }
    
    showNotification(`已切换到${getThemeDisplayName(themeName)}`, 'success');
}

// 应用主题
function applyTheme(themeName) {
    const root = document.documentElement;
    
    switch (themeName) {
        case 'dark':
            root.style.setProperty('--bg-primary', '#1a1a1a');
            root.style.setProperty('--bg-secondary', '#2d2d2d');
            root.style.setProperty('--accent', '#4a4a4a');
            root.style.setProperty('--accent-light', '#606060');
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', '#cccccc');
            break;
        case 'blue':
            root.style.setProperty('--bg-primary', '#e0f2fe');
            root.style.setProperty('--bg-secondary', '#b3e5fc');
            root.style.setProperty('--accent', '#4fc3f7');
            root.style.setProperty('--accent-light', '#81d4fa');
            root.style.setProperty('--text-primary', '#0d47a1');
            root.style.setProperty('--text-secondary', '#1565c0');
            break;
        default: // light
            root.style.setProperty('--bg-primary', '#fefdf6');
            root.style.setProperty('--bg-secondary', '#f7f5e6');
            root.style.setProperty('--accent', '#d4a574');
            root.style.setProperty('--accent-light', '#e6c79a');
            root.style.setProperty('--text-primary', '#3a3a3a');
            root.style.setProperty('--text-secondary', '#666666');
            break;
    }
}

// 获取主题显示名称
function getThemeDisplayName(themeName) {
    switch (themeName) {
        case 'dark': return '深色主题';
        case 'blue': return '蓝色主题';
        default: return '米黄主题';
    }
}

// 保存网页设置
function saveWebSettings() {
    // 从界面读取设置
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    const timestampToggle = document.getElementById('timestamp-toggle');
    const compactModeToggle = document.getElementById('compact-mode-toggle');
    const reconnectSelect = document.getElementById('reconnect-interval-select');
    const logCacheSelect = document.getElementById('log-cache-size-select');
    
    if (autoRefreshToggle) webSettings.autoRefresh = autoRefreshToggle.checked;
    if (timestampToggle) webSettings.showTimestamp = timestampToggle.checked;
    if (compactModeToggle) webSettings.compactMode = compactModeToggle.checked;
    if (reconnectSelect) webSettings.reconnectInterval = parseInt(reconnectSelect.value);
    if (logCacheSelect) webSettings.logCacheSize = parseInt(logCacheSelect.value);
    
    try {
        localStorage.setItem('mofox-ui-settings', JSON.stringify(webSettings));
        applyWebSettings();
        showNotification('设置已保存', 'success');
    } catch (error) {
        console.error('保存设置失败:', error);
        showNotification('保存设置失败', 'error');
    }
}

// 重置网页设置
function resetWebSettings() {
    webSettings = {
        theme: 'light',
        autoRefresh: true,
        showTimestamp: true,
        compactMode: false,
        reconnectInterval: 5,
        logCacheSize: 1000
    };
    
    try {
        localStorage.removeItem('mofox-ui-settings');
        applyWebSettings();
        showNotification('设置已重置为默认值', 'success');
    } catch (error) {
        console.error('重置设置失败:', error);
        showNotification('重置设置失败', 'error');
    }
}

// 导出网页设置
function exportWebSettings() {
    try {
        const settingsJson = JSON.stringify(webSettings, null, 2);
        const blob = new Blob([settingsJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mofox-ui-settings.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('设置已导出', 'success');
    } catch (error) {
        console.error('导出设置失败:', error);
        showNotification('导出设置失败', 'error');
    }
}

// ========================配置管理相关函数========================

// 配置管理状态
let currentConfig = null;
let originalConfig = null; // 用于撤销功能
let isConfigLoaded = false;

// Bot配置显示顺序 - 重要配置在前
const botConfigOrder = {
    'personality': 1,   // 人格配置
    'bot': 2,          // Bot基础配置
    'chat': 3,         // 聊天配置
    'expression': 4,   // 表达配置
    'mood': 5,         // 情绪相关
    'relationship': 6, // 关系系统
    'memory': 7,       // 记忆系统
    'response_post_process': 8, // 回复处理
    'chinese_typo': 9, // 中文错别字
    'response_splitter': 10, // 回复分割
    'anti_prompt_injection': 11, // 反注入
    'database': 12,    // 数据库
    'log': 13,         // 日志
    'debug': 14,       // 调试
    'permission': 15,  // 权限
    'experimental': 16, // 实验功能
    'inner': 100       // 内部配置总是在最后
};

// 获取配置排序权重
function getConfigOrder(sectionName) {
    return botConfigOrder[sectionName] || 50; // 未定义的配置默认权重50
}

// 加载所有配置
async function loadConfigs() {
    try {
        showConfigLoading(true);
        showNotification('正在加载配置...', 'info');
        
        const [botResponse, modelResponse, pluginResponse] = await Promise.all([
            fetch('/api/config/bot'),
            fetch('/api/config/model'),
            fetch('/api/config/plugins')
        ]);
        
        if (!botResponse.ok || !modelResponse.ok || !pluginResponse.ok) {
            throw new Error('Failed to load configurations');
        }
        
        const botResult = await botResponse.json();
        const modelResult = await modelResponse.json();
        const pluginResult = await pluginResponse.json();
        
        if (!botResult.success || !modelResult.success || !pluginResult.success) {
            throw new Error('配置加载失败');
        }
        
        currentConfig = { 
            bot: botResult.config, 
            model: modelResult.config, 
            plugins: pluginResult.plugins 
        };
        originalConfig = JSON.parse(JSON.stringify(currentConfig)); // 深拷贝
        isConfigLoaded = true;
        
        renderConfigs();
        showConfigActions(true);
        showNotification('配置加载完成', 'success');
        
    } catch (error) {
        console.error('Error loading configs:', error);
        showNotification('配置加载失败: ' + error.message, 'error');
        const configContent = document.getElementById('config-content');
        if (configContent) {
            configContent.innerHTML = '<div class="alert alert-error">配置加载失败: ' + error.message + '</div>';
        }
    } finally {
        showConfigLoading(false);
    }
}

function showConfigLoading(show) {
    const loadingEl = document.getElementById('config-loading');
    if (loadingEl) {
        loadingEl.style.display = show ? 'block' : 'none';
    }
}

function showConfigActions(show) {
    const actionsEl = document.getElementById('config-actions');
    if (actionsEl) {
        actionsEl.style.display = show ? 'flex' : 'none';
    }
}

function renderConfigs() {
    if (!currentConfig) return;
    
    const botContent = renderBotConfig(currentConfig.bot);
    const modelContent = renderModelConfig(currentConfig.model);
    const pluginContent = renderPluginConfigs(currentConfig.plugins);
    
    const botEl = document.getElementById('bot-config-content');
    const modelEl = document.getElementById('model-config-content');
    const pluginEl = document.getElementById('plugin-config-content');
    
    if (botEl) botEl.innerHTML = botContent;
    if (modelEl) modelEl.innerHTML = modelContent;
    if (pluginEl) pluginEl.innerHTML = pluginContent;
}

function renderBotConfig(config) {
    if (!config || !config.sections) return '<div class="alert alert-info">暂无配置数据</div>';
    
    // 按优先级排序配置节
    const sortedSections = [...config.sections].sort((a, b) => {
        return getConfigOrder(a.name) - getConfigOrder(b.name);
    });
    
    let html = '<div class="config-sections compact">';
    
    sortedSections.forEach(section => {
        html += renderConfigSection(section, 'bot');
    });
    
    html += '</div>';
    return html;
}

function renderModelConfig(config) {
    if (!config || !config.sections) return '<div class="alert alert-info">暂无配置数据</div>';
    
    let html = '<div class="model-config-container">';
    
    // 创建子标签页
    html += `
        <div class="model-subtabs">
            <div class="model-subtab active" onclick="switchModelSubTab('providers')">API提供商</div>
            <div class="model-subtab" onclick="switchModelSubTab('models')">模型配置</div>
            <div class="model-subtab" onclick="switchModelSubTab('tasks')">组件模型配置</div>
        </div>
    `;
    
    // API提供商配置
    html += '<div id="model-providers-content" class="model-subcontent active">';
    const providerSections = config.sections.filter(s => s.name === 'api_providers' || s.name.includes('api_providers'));
    if (providerSections.length > 0) {
        html += '<div class="config-sections compact">';
        providerSections.forEach(section => {
            html += renderConfigSection(section, 'model');
        });
        html += '</div>';
    } else {
        html += '<div class="alert alert-info">暂无API提供商配置</div>';
    }
    html += '</div>';
    
    // 模型配置
    html += '<div id="model-models-content" class="model-subcontent">';
    const modelSections = config.sections.filter(s => s.name === 'models' || s.name.includes('models'));
    if (modelSections.length > 0) {
        html += '<div class="config-sections compact">';
        modelSections.forEach(section => {
            html += renderConfigSection(section, 'model');
        });
        html += '</div>';
    } else {
        html += '<div class="alert alert-info">暂无模型配置</div>';
    }
    html += '</div>';
    
    // 组件模型配置
    html += '<div id="model-tasks-content" class="model-subcontent">';
    const taskSections = config.sections.filter(s => s.name.startsWith('model_task_config'));
    if (taskSections.length > 0) {
        html += '<div class="config-sections compact">';
        taskSections.forEach(section => {
            html += renderConfigSection(section, 'model');
        });
        html += '</div>';
    } else {
        html += '<div class="alert alert-info">暂无组件模型配置</div>';
    }
    html += '</div>';
    
    html += '</div>';
    return html;
}

function switchModelSubTab(tabName) {
    // 切换标签页状态
    document.querySelectorAll('.model-subtab').forEach(tab => {
        tab.classList.remove('active');
    });
    const activeTab = document.querySelector(`.model-subtab[onclick="switchModelSubTab('${tabName}')"]`);
    if (activeTab) activeTab.classList.add('active');
    
    // 切换内容显示
    document.querySelectorAll('.model-subcontent').forEach(content => {
        content.classList.remove('active');
    });
    const activeContent = document.getElementById(`model-${tabName}-content`);
    if (activeContent) activeContent.classList.add('active');
}

function renderPluginConfigs(plugins) {
    if (!plugins || plugins.length === 0) return '<div class="alert alert-info">暂无插件配置</div>';
    
    let html = '<div class="plugin-config-container">';
    
    // 创建插件选择器
    html += '<div class="plugin-selector">';
    html += '<label for="plugin-select" class="form-label">选择插件:</label>';
    html += '<select id="plugin-select" onchange="switchPlugin(this.value)" class="form-control">';
    html += '<option value="">请选择插件...</option>';
    
    plugins.forEach((plugin, index) => {
        const displayName = plugin.name || `插件${index + 1}`;
        html += `<option value="${index}">${displayName}</option>`;
    });
    
    html += '</select>';
    html += '</div>';
    
    // 插件配置内容容器
    html += '<div id="selected-plugin-content" class="selected-plugin-content">';
    html += '<div class="alert alert-info">请选择一个插件查看其配置</div>';
    html += '</div>';
    
    html += '</div>';
    return html;
}

function switchPlugin(pluginIndex) {
    const contentEl = document.getElementById('selected-plugin-content');
    if (!contentEl) return;
    
    if (pluginIndex === '') {
        contentEl.innerHTML = '<div class="alert alert-info">请选择一个插件查看其配置</div>';
        return;
    }
    
    const plugin = currentConfig.plugins[parseInt(pluginIndex)];
    if (!plugin || !plugin.config) {
        contentEl.innerHTML = '<div class="alert alert-error">插件配置加载失败</div>';
        return;
    }
    
    let html = `<div class="plugin-config-header">
        <h3>${plugin.name || '未命名插件'}</h3>
        <p class="plugin-path">路径: ${plugin.path || '未知'}</p>
    </div>`;
    
    if (plugin.config.sections && plugin.config.sections.length > 0) {
        html += '<div class="config-sections compact">';
        plugin.config.sections.forEach(section => {
            html += renderConfigSection(section, 'plugin', pluginIndex);
        });
        html += '</div>';
    } else {
        html += '<div class="alert alert-info">该插件暂无配置项</div>';
    }
    
    contentEl.innerHTML = html;
}

function renderConfigSection(section, configType, pluginIndex = null) {
    let html = '<div class="config-section compact">';
    
    // 节标题和注释
    html += `<div class="section-header">
        <h4 class="section-title">${section.name}</h4>`;
    
    if (section.comment) {
        html += `<p class="section-comment">${section.comment}</p>`;
    }
    
    html += '</div>';
    
    // 字段
    if (section.fields && section.fields.length > 0) {
        html += '<div class="section-fields compact">';
        section.fields.forEach(field => {
            html += renderConfigField(field, configType, pluginIndex);
        });
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

function renderConfigField(field, configType, pluginIndex = null) {
    const fieldId = pluginIndex !== null ? 
        `${configType}-${pluginIndex}-${field.section}-${field.name}` :
        `${configType}-${field.section}-${field.name}`;
    
    let html = '<div class="config-field compact">';
    
    // 字段标签和注释
    html += `<div class="field-header">
        <label for="${fieldId}" class="field-label">${field.name}</label>`;
    
    if (field.comment) {
        html += `<span class="field-comment">${field.comment}</span>`;
    }
    
    html += '</div>';
    
    // 字段输入
    html += '<div class="field-input">';
    html += createFieldInput(field, fieldId, configType, pluginIndex);
    html += '</div>';
    
    html += '</div>';
    return html;
}

function createFieldInput(field, fieldId, configType, pluginIndex = null) {
    const onChangeHandler = pluginIndex !== null ?
        `onConfigFieldChange('${configType}', '${field.section}', '${field.name}', this.value, ${pluginIndex})` :
        `onConfigFieldChange('${configType}', '${field.section}', '${field.name}', this.value)`;
    
    switch (field.field_type) {
        case 'boolean':
            return `<input type="checkbox" id="${fieldId}" ${field.value ? 'checked' : ''} 
                    onchange="onConfigFieldChange('${configType}', '${field.section}', '${field.name}', this.checked${pluginIndex !== null ? ', ' + pluginIndex : ''})" 
                    class="form-checkbox">`;
        
        case 'integer':
        case 'float':
            return `<input type="number" id="${fieldId}" value="${field.value}" 
                    onchange="${onChangeHandler}" 
                    class="form-control compact"${field.field_type === 'float' ? ' step="0.1"' : ''}>`;
        
        case 'array':
            const arrayValue = Array.isArray(field.value) ? field.value.join(', ') : '';
            return `<input type="text" id="${fieldId}" value="${arrayValue}" 
                    onchange="${onChangeHandler}" 
                    placeholder="用逗号分隔多个值" 
                    class="form-control compact">`;
        
        case 'string':
        default:
            const stringValue = typeof field.value === 'string' ? field.value : String(field.value);
            if (stringValue.includes('\n')) {
                return `<textarea id="${fieldId}" onchange="${onChangeHandler}" 
                        class="form-control compact" rows="3">${stringValue}</textarea>`;
            } else {
                return `<input type="text" id="${fieldId}" value="${stringValue}" 
                        onchange="${onChangeHandler}" 
                        class="form-control compact">`;
            }
    }
}

function onConfigFieldChange(configType, section, fieldName, value, pluginIndex = null) {
    if (!currentConfig) return;
    
    let targetConfig;
    if (configType === 'plugin' && pluginIndex !== null) {
        targetConfig = currentConfig.plugins[pluginIndex].config;
    } else {
        targetConfig = currentConfig[configType];
    }
    
    if (!targetConfig || !targetConfig.sections) return;
    
    const sectionObj = targetConfig.sections.find(s => s.name === section);
    if (!sectionObj) return;
    
    const field = sectionObj.fields.find(f => f.name === fieldName);
    if (!field) return;
    
    // 根据字段类型转换值
    switch (field.field_type) {
        case 'boolean':
            field.value = Boolean(value);
            break;
        case 'integer':
            field.value = parseInt(value) || 0;
            break;
        case 'float':
            field.value = parseFloat(value) || 0.0;
            break;
        case 'array':
            field.value = value.split(',').map(v => v.trim()).filter(v => v);
            break;
        default:
            field.value = value;
    }
}

async function saveCurrentConfig() {
    if (!currentConfig || !isConfigLoaded) {
        showNotification('配置未加载完成，请稍后再试', 'warning');
        return;
    }
    
    try {
        showSaveLoading(true);
        showNotification('正在保存配置...', 'info');
        
        const savePromises = [];
        
        // 保存Bot配置
        savePromises.push(
            fetch('/api/config/bot/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentConfig.bot)
            })
        );
        
        // 保存模型配置
        savePromises.push(
            fetch('/api/config/model/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentConfig.model)
            })
        );
        
        // 保存插件配置
        if (currentConfig.plugins && currentConfig.plugins.length > 0) {
            currentConfig.plugins.forEach(plugin => {
                savePromises.push(
                    fetch('/api/config/plugin/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            path: plugin.path,
                            config: plugin.config
                        })
                    })
                );
            });
        }
        
        const responses = await Promise.all(savePromises);
        const allSuccessful = responses.every(response => response.ok);
        
        if (allSuccessful) {
            // 更新原始配置为当前配置
            originalConfig = JSON.parse(JSON.stringify(currentConfig));
            showNotification('配置保存成功！', 'success');
        } else {
            throw new Error('部分配置保存失败');
        }
        
    } catch (error) {
        console.error('Error saving config:', error);
        showNotification('配置保存失败: ' + error.message, 'error');
    } finally {
        showSaveLoading(false);
    }
}

function undoConfigChanges() {
    if (!originalConfig) {
        showNotification('没有可撤销的更改', 'warning');
        return;
    }
    
    if (confirm('确定要撤销所有未保存的更改吗？')) {
        currentConfig = JSON.parse(JSON.stringify(originalConfig));
        renderConfigs();
        showNotification('已撤销所有未保存的更改', 'success');
    }
}

function showSaveLoading(show) {
    const saveBtn = document.querySelector('#config-actions .btn-primary');
    if (saveBtn) {
        if (show) {
            saveBtn.disabled = true;
            saveBtn.textContent = '保存中...';
        } else {
            saveBtn.disabled = false;
            saveBtn.textContent = '保存配置';
        }
    }
}

// 切换配置选项卡
function showConfigTab(tabName) {
    currentConfigTab = tabName;
    
    // 更新选项卡样式
    const tabs = document.querySelectorAll('.tabs .tab');
    tabs.forEach(tab => tab.classList.remove('tab-active'));
    
    const currentTab = document.querySelector(`[onclick="showConfigTab('${tabName}')"]`);
    if (currentTab) {
        currentTab.classList.add('tab-active');
    }
    
    // 显示对应的内容
    const contents = document.querySelectorAll('.config-content');
    contents.forEach(content => {
        content.classList.remove('active');
        content.classList.add('hidden');
    });
    
    const targetContent = document.getElementById(tabName + '-config-content');
    if (targetContent) {
        targetContent.classList.remove('hidden');
        targetContent.classList.add('active');
    }
    
    // 如果还没有加载配置，则加载
    if (!isConfigLoaded) {
        loadConfigs();
    }
}

// 回到顶部功能
function createBackToTopButton() {
    const button = document.createElement('button');
    button.innerHTML = '↑';
    button.className = 'back-to-top';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: #D4A574;
        color: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        z-index: 1000;
        display: none;
        transition: all 0.3s ease;
    `;
    
    button.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    document.body.appendChild(button);
    
    // 监听滚动事件
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            button.style.display = 'block';
        } else {
            button.style.display = 'none';
        }
    });
}

// 导出函数供全局使用
window.showSection = showSection;
window.toggleService = toggleService;
window.showLogs = showLogs;
window.clearLogs = clearLogs;
window.changeTheme = changeTheme;
window.saveWebSettings = saveWebSettings;
window.resetWebSettings = resetWebSettings;
window.exportWebSettings = exportWebSettings;
window.showConfigTab = showConfigTab;
window.loadConfigs = loadConfigs;
window.saveCurrentConfig = saveCurrentConfig;
window.undoConfigChanges = undoConfigChanges;
window.switchModelSubTab = switchModelSubTab;
window.switchPlugin = switchPlugin;
window.onConfigFieldChange = onConfigFieldChange;
