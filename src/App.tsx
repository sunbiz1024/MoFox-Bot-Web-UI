import { useState, useEffect } from "react";
import { SidebarProvider } from "./components/ui/sidebar";
import { TooltipProvider } from "./components/ui/tooltip";
import { AppSidebar } from "./components/AppSidebar";
import { ConfigurationManager } from "./components/ConfigurationManager";
import { LogViewer } from "./components/LogViewer";
import { ThemeManager } from "./components/ThemeManager";
import { Dashboard } from "./components/Dashboard";
import { LoginPage } from "./components/LoginPage";
import { FileSelector } from "./components/FileSelector";
import SystemManagement from "./components/SystemManagement";
import { Toaster } from "./components/ui/sonner";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(() => localStorage.getItem("selectedFilePath"));
  const { isAuthenticated, user, isLoading, login, logout } = useAuth();

  useEffect(() => {
    if (selectedFilePath) {
      localStorage.setItem("selectedFilePath", selectedFilePath);
    } else {
      localStorage.removeItem("selectedFilePath");
    }
  }, [selectedFilePath]);

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <Dashboard filePath={selectedFilePath} onNavigateToLogs={() => setActiveSection("logs")} />;
      case "config":
        return <ConfigurationManager />;
      case "logs":
        return <LogViewer />;
      case "theme":
        return <ThemeManager />;
      case "admin":
        return <SystemManagement onLogout={() => {
          logout();
          setSelectedFilePath(null);
        }} />;
      default:
        return <Dashboard filePath={selectedFilePath} onNavigateToLogs={() => setActiveSection("logs")} />;
    }
  };

  const getPageTitle = () => {
    switch (activeSection) {
      case "dashboard":
        return "控制台概览";
      case "config":
        return "配置管理";
      case "logs":
        return "日志同步";
      case "theme":
        return "主题设置";
      default:
        return "控制台概览";
    }
  };

  const getPageDescription = () => {
    switch (activeSection) {
      case "dashboard":
        return "监控MoFox Bot的运行状态和关键指标";
      case "config":
        return "智能机器人配置与设置";
      case "logs":
        return "实时日志监控与管理";
      case "theme":
        return "界面主题配置与个性化设置";
      default:
        return "监控MoFox Bot的运行状态和关键指标";
    }
  };

  // 显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 bg-primary rounded-lg animate-pulse mx-auto"></div>
          <p className="text-muted-foreground">正在加载...</p>
        </div>
      </div>
    );
  }

  // 如果未登录，显示登录页面
  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }

  // 如果已登录但未选择文件，显示文件选择界面
  const handleFileSelected = (path: string) => {
    setSelectedFilePath(path);
  };

  if (!selectedFilePath) {
    return <FileSelector onFileSelect={handleFileSelected} onLogout={logout} />;
  }

  // 登录后显示主界面
  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar 
            activeSection={activeSection} 
            onSectionChange={setActiveSection}
            user={user || undefined}
            onLogout={() => {
              logout();
              setSelectedFilePath(null);
            }}
          />
          <main className="flex-1 flex flex-col">
            <header className="border-b bg-card px-6 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="mb-1">{getPageTitle()}</h1>
                  <p className="text-muted-foreground text-sm">
                    {getPageDescription()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-muted-foreground">在线</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    欢迎, {user?.displayName}
                  </div>
                </div>
              </div>
            </header>
            <div className="flex-1 p-6">
              {renderContent()}
            </div>
          </main>
        </div>
        <Toaster />
      </SidebarProvider>
    </TooltipProvider>
  );
}