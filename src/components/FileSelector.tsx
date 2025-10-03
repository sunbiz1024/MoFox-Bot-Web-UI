import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Folder, LogOut } from "lucide-react";
import { toast } from "sonner";

interface FileSelectorProps {
  onFileSelect: (path: string) => void;
  onLogout: () => void;
}

export function FileSelector({ onFileSelect, onLogout }: FileSelectorProps) {
  const [filePath, setFilePath] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load last selected directory from localStorage
  useEffect(() => {
    const lastDir = localStorage.getItem("lastDirectory");
    if (lastDir) {
      setFilePath(lastDir);
    }
  }, []);

  const handleDirectoryBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const selectedPath = files[0].webkitRelativePath || files[0].name;
      const directoryPath = selectedPath.substring(0, selectedPath.lastIndexOf('/'));
      setFilePath(directoryPath);
      localStorage.setItem("lastDirectory", directoryPath);
      toast.success("已选择文件夹", {
        description: directoryPath
      });
    }
  };

  const handleFileSelect = () => {
    if (filePath) {
      localStorage.setItem("lastDirectory", filePath);
      onFileSelect(filePath);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>选择文件路径</CardTitle>
            <CardDescription>
              请选择一个文件作为 WebUI 的配置文件，所有配置和数据将保存在该文件所在的目录中
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="请选择或输入配置文件路径"
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={handleDirectoryBrowse}>
                <Folder className="h-4 w-4" />
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                webkitdirectory="true"
                mozdirectory="true"
                directory="true"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleFileSelect}
              disabled={!filePath}
            >
              确认选择
            </Button>
            <Button
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
              返回登录界面
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}