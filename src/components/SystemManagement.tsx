import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LogOut } from 'lucide-react';

interface SystemManagementProps {
  onLogout?: () => void;
}

const SystemManagement: React.FC<SystemManagementProps> = ({ onLogout }) => {
  const [platform, setPlatform] = useState('qq');
  const [userId, setUserId] = useState('');
  const [masterUsers, setMasterUsers] = useState<[string, string][]>([]);
  const [configPath, setConfigPath] = useState('');

  useEffect(() => {
    // In a real app, you'd fetch the config path and master users from a backend or file
    // For now, we'll use a placeholder path and parse a hardcoded string
    const hardcodedConfig = `master_users=[['qq','1234567890']]`;
    const match = hardcodedConfig.match(/master_users=\[(.+)\]/);
    if (match && match[1]) {
      try {
        const users = JSON.parse(`[[${match[1]}]]`);
        setMasterUsers(users);
      } catch (e) {
        console.error("Error parsing master_users", e);
        // Handle cases with malformed arrays, e.g., [['qq','1234567890'],['qq','234567801']]
        // This is a simplified parser for the example format.
        const userStrings = match[1].replace(/'/g, '"').slice(1,-1).split('],[');
        const parsedUsers = userStrings.map(s => JSON.parse(`[${s}]`));
        setMasterUsers(parsedUsers);

      }
    }
     // Assuming the file selector logic provides the path to the bot config
     // For now, let's hardcode the path you mentioned.
     setConfigPath('./bot/config/bot_config.toml');
  }, []);

  const handleAddUser = () => {
    if (userId) {
      setMasterUsers([...masterUsers, [platform, userId]]);
      setUserId('');
    }
  };

  const handleRemoveUser = (index: number) => {
    const newUsers = [...masterUsers];
    newUsers.splice(index, 1);
    setMasterUsers(newUsers);
  };

  const handleSave = async () => {
    try {
        const usersString = masterUsers.map(user => `['${user[0]}','${user[1]}']`).join(',');
        const newConfigContent = `master_users=[${usersString}]`;

        // In a real Electron app, you would use ipcRenderer to send this to the main process
        // For example: window.electron.saveBotConfig(configPath, newConfigContent);
        console.log(`Saving to ${configPath}: ${newConfigContent}`);
        alert('配置已保存！ (模拟)');

    } catch (error) {
        console.error('Failed to save master users:', error);
        alert('保存失败！');
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>系统管理</CardTitle>
        <CardDescription>系统管理与权限控制</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>配置文件路径</Label>
          <Input type="text" value={configPath} readOnly />
        </div>

        <Separator />

        <div className="space-y-4">
            <h3 className="font-medium">添加新的管理员</h3>
            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-4">
                <div className="space-y-2">
                    <Label htmlFor="platform">对话平台</Label>
                    <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger id="platform">
                            <SelectValue placeholder="选择平台" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="qq">QQ</SelectItem>
                            <SelectItem value="wechat">微信</SelectItem>
                            <SelectItem value="telegram">Telegram</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="user-id">用户ID</Label>
                    <Input
                        id="user-id"
                        value={userId}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserId(e.target.value)}
                        placeholder="请输入用户ID"
                    />
                </div>
                <Button onClick={handleAddUser}>添加</Button>
            </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="font-medium">当前管理员列表</h3>
          <div className="space-y-2 rounded-md border">
            {masterUsers.length > 0 ? (
                masterUsers.map((user, index) => (
                <div key={index} className="flex items-center justify-between p-3 border-b last:border-b-0">
                    <div>
                        <span className="font-mono bg-muted px-2 py-1 rounded-md text-sm">{user[1]}</span>
                        <span className="ml-2 text-sm text-muted-foreground">{user[0]}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveUser(index)}>
                    移除
                    </Button>
                </div>
                ))
            ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                    暂无管理员
                </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-6 flex justify-between">
        <Button onClick={handleSave}>保存更改</Button>
        {onLogout && (
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            返回登录
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default SystemManagement;