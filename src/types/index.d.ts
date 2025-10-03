/// <reference types="vite/client" />

export {};

declare global {
  interface Window {
    electron: {
      openDirectoryDialog: () => Promise<string>;
      openFileDialog: () => Promise<string>;
      saveLastDirectory: (path: string) => Promise<void>;
      getLastDirectory: () => Promise<string>;
      getProcessUptime: (processName: string, scriptName: string, directory: string) => Promise<string>;
      restartWebUI: () => Promise<void>;
      restartMofoxBot: (botDirectoryPath: string) => Promise<{ success: boolean; message: string }>;
    };
  }

  namespace React {
    interface HTMLAttributes<T> extends React.AriaAttributes, React.DOMAttributes<T> {
      webkitdirectory?: string;
      mozdirectory?: string;
      directory?: string;
    }
  }
}