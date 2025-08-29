// MoFox-UI 前端 JavaScript

// 当前选中的服务和页面
let currentService = 'bot';
let currentSection = 'monitoring';
let serviceCardsCollapsed = false;

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
    initializeApp();
    startStatusPolling();
    updateStatusIndicators();
});

// 初始化应用
function initializeApp() {
    // 设置默认选中的导航项
    showSection('monitoring');
    showLogs('bot');
    
    // 设置初始日志容器高度
    adjustLogContainerHeight();
    
    // 加载初始数据
    loadStatus();
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

// 调整日志容器高度
function adjustLogContainerHeight() {
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
        if (serviceCardsCollapsed) {
            logContainer.style.height = 'calc(100vh - 250px)';
        } else {
            logContainer.style.height = 'calc(100vh - 350px)';
        }
    }
}

// 刷新统计数据
async function refreshStatistics() {
    const content = document.getElementById('statistics-content');
    const refreshBtn = document.querySelector('button[onclick="refreshStatistics()"]');
    
    // 显示加载状态
    content.innerHTML = `
        <div class="flex justify-center items-center h-full">
            <div class="loading loading-spinner loading-lg"></div>
            <span class="ml-4">正在重新生成统计数据...</span>
        </div>
    `;
    
    // 禁用刷新按钮
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.classList.add('loading');
    }
    
    try {
        // 调用后端刷新接口
        const refreshResponse = await fetch('/api/refresh-statistics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const refreshResult = await refreshResponse.json();
        
        if (refreshResult.success) {
            // 刷新成功后重新加载统计数据
            await loadStatisticsData(content);
            showNotification('统计数据已更新', 'success');
        } else {
            throw new Error(refreshResult.message);
        }
    } catch (error) {
        console.error('刷新统计数据失败:', error);
        content.innerHTML = `
            <div class="text-center py-20">
                <div class="text-6xl mb-4">⚠️</div>
                <h3 class="text-2xl font-bold mb-2">刷新失败</h3>
                <p class="text-gray-600">无法刷新统计数据: ${error.message}</p>
                <button class="btn btn-custom mt-4" onclick="refreshStatistics()">重试</button>
            </div>
        `;
        showNotification('刷新失败: ' + error.message, 'error');
    } finally {
        // 恢复刷新按钮
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('loading');
        }
    }
}

// 加载统计数据
async function loadStatisticsData(content) {
    try {
        content.innerHTML = `
            <div class="flex justify-center items-center h-full">
                <div class="loading loading-spinner loading-lg"></div>
                <span class="ml-4">正在加载统计数据...</span>
            </div>
        `;
        
        const response = await fetch('/api/statistics');
        if (response.ok) {
            const html = await response.text();
            content.innerHTML = html;
        } else {
            throw new Error('无法加载统计数据');
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
        content.innerHTML = `
            <div class="text-center py-20">
                <div class="text-6xl mb-4">⚠️</div>
                <h3 class="text-2xl font-bold mb-2">加载失败</h3>
                <p class="text-gray-600">无法加载统计数据，请稍后重试</p>
                <button class="btn btn-custom mt-4" onclick="loadStatisticsData(document.getElementById('statistics-content'))">重试</button>
            </div>
        `;
    }
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
    
    // 如果是统计页面，加载统计数据
    if (sectionName === 'statistics') {
        const content = document.getElementById('statistics-content');
        if (content) {
            loadStatisticsData(content);
        }
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
    const statusText = document.getElementById(`${serviceName}-status-text`);
    
    if (statusIndicator) {
        statusIndicator.setAttribute('data-status', isRunning ? 'running' : 'stopped');
        statusIndicator.className = `status-indicator ${isRunning ? 'status-running' : 'status-stopped'}`;
    }
    
    if (actionText) {
        actionText.textContent = isRunning ? '停止' : '启动';
    }
    
    if (statusText) {
        statusText.textContent = isRunning ? '🟢 运行中' : '🔴 未运行';
        statusText.className = `status-text ${isRunning ? 'text-green-600' : 'text-red-600'}`;
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

// 刷新日志
function refreshLogs() {
    loadLogs(currentService);
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

// 导出函数供全局使用
window.showSection = showSection;
window.toggleService = toggleService;
window.showLogs = showLogs;
window.refreshLogs = refreshLogs;
window.toggleServiceCards = toggleServiceCards;
window.openStatisticsPanel = openStatisticsPanel;
window.closeStatisticsPanel = closeStatisticsPanel;

// 切换服务卡片折叠状态
function toggleServiceCards() {
    const serviceCards = document.getElementById('service-cards');
    const collapseIcon = document.getElementById('collapse-icon');
    
    serviceCardsCollapsed = !serviceCardsCollapsed;
    
    if (serviceCardsCollapsed) {
        serviceCards.classList.add('collapsed');
        collapseIcon.style.transform = 'rotate(-90deg)';
    } else {
        serviceCards.classList.remove('collapsed');
        collapseIcon.style.transform = 'rotate(0deg)';
    }
}

// 打开统计监控面板
async function openStatisticsPanel() {
    const modal = document.getElementById('statistics-modal');
    const content = document.getElementById('statistics-content');
    
    // 显示模态框
    modal.classList.add('show');
    
    // 加载统计数据
    try {
        const response = await fetch('/api/statistics');
        if (response.ok) {
            const html = await response.text();
            content.innerHTML = html;
        } else {
            throw new Error('无法加载统计数据');
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
        content.innerHTML = `
            <div class="text-center py-20">
                <div class="text-6xl mb-4">⚠️</div>
                <h3 class="text-2xl font-bold mb-2">加载失败</h3>
                <p class="text-gray-600">无法加载统计数据，请稍后重试</p>
                <button class="btn btn-custom mt-4" onclick="openStatisticsPanel()">重新加载</button>
            </div>
        `;
    }
}

// 关闭统计监控面板
function closeStatisticsPanel() {
    const modal = document.getElementById('statistics-modal');
    modal.classList.remove('show');
}

// 点击模态框外部关闭
document.addEventListener('click', function(event) {
    const modal = document.getElementById('statistics-modal');
    if (event.target === modal) {
        closeStatisticsPanel();
    }
});

// ESC键关闭模态框
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeStatisticsPanel();
    }
});

// 导出函数供全局使用
window.showSection = showSection;
window.toggleService = toggleService;
window.showLogs = showLogs;
window.clearLogs = clearLogs;
window.refreshLogs = refreshLogs;
window.toggleServiceCards = toggleServiceCards;
window.openStatisticsPanel = openStatisticsPanel;
window.closeStatisticsPanel = closeStatisticsPanel;
