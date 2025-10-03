import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import * as util from 'util';

const execAsync = util.promisify(exec);

// 配置文件路径
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

// 保存最后使用的目录
async function saveLastDirectory(directoryPath: string) {
  try {
    await fs.promises.writeFile(CONFIG_PATH, JSON.stringify({ lastDirectory: directoryPath }));
  } catch (error) {
    console.error('保存目录失败:', error);
    throw error;
  }
}

// 获取最后使用的目录
async function getLastDirectory(): Promise<string> {
  try {
    if (await fs.promises.access(CONFIG_PATH).then(() => true).catch(() => false)) {
      const content = await fs.promises.readFile(CONFIG_PATH, 'utf8');
      const config = JSON.parse(content);
      return config.lastDirectory || '';
    }
    return '';
  } catch (error) {
    console.error('读取目录失败:', error);
    return '';
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 在开发环境使用本地服务器
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }
}

app.whenReady().then(() => {
  // 设置 IPC 处理程序
  ipcMain.handle('open-directory-dialog', async () => {
    const filePaths = dialog.showOpenDialogSync({
      properties: ['openDirectory', 'createDirectory']
    });
    return (filePaths && filePaths.length > 0) ? filePaths[0] : '';
  });

  ipcMain.handle('open-file-dialog', async () => {
    const filePaths = dialog.showOpenDialogSync({
      properties: ['openFile']
    });
    return (filePaths && filePaths.length > 0) ? filePaths[0] : '';
  });

  ipcMain.handle('save-last-directory', async (_: any, path: string) => {
    await saveLastDirectory(path);
  });

  ipcMain.handle('get-last-directory', async () => {
    return await getLastDirectory();
  });

  // 获取进程运行时间的函数
  async function getProcessUptime(processName: string, scriptName: string, directory: string): Promise<string> {
    const command = process.platform === 'win32'
        ? `wmic process where "name like 'python%' and commandline like '%${scriptName.replace(/\\/g, '\\\\')}%'" get creationdate /format:list`
        : `ps -eo comm,etime,args | grep ${processName} | grep ${scriptName}`;

    try {
        const { stdout } = await execAsync(command, { cwd: directory });

        if (process.platform === 'win32') {
            if (!stdout.trim()) return '未运行';
            const match = stdout.match(/CreationDate=(\d+)/);
            if (!match) return '解析失败';
            
            const startTimeStr = match[1];
            const year = parseInt(startTimeStr.substring(0, 4), 10);
            const month = parseInt(startTimeStr.substring(4, 6), 10) - 1;
            const day = parseInt(startTimeStr.substring(6, 8), 10);
            const hour = parseInt(startTimeStr.substring(8, 10), 10);
            const minute = parseInt(startTimeStr.substring(10, 12), 10);
            const second = parseInt(startTimeStr.substring(12, 14), 10);
            
            const startTime = new Date(year, month, day, hour, minute, second);
            const uptimeMs = Date.now() - startTime.getTime();
            const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
            
            return `${days}天 ${hours}小时 ${minutes}分钟`;
        } else {
            const lines = stdout.trim().split('\n');
            if (lines.length === 0) return '未运行';

            const processLine = lines.find((line: any) => line.includes(scriptName));
            if (!processLine) return '未找到脚本';
            
            const parts = processLine.trim().split(/\s+/);
            const etime = parts[1];
            return etime || '解析失败';
        }
    } catch (error) {
        console.error('获取进程运行时间失败:', error);
        return '错误';
    }
  }

  ipcMain.handle('get-process-uptime', async (_: any, processName: string, scriptName: string, directory: string) => {
    return await getProcessUptime(processName, scriptName, directory);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});