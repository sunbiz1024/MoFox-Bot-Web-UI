"""
UI日志传输模块
用于各个服务向MoFox-UI发送日志信息
"""
import requests
import threading
import json
from typing import Optional
import time

class UILogger:
    def __init__(self, service_name: str, ui_url: str = "http://127.0.0.1:3000"):
        self.service_name = service_name
        self.ui_url = ui_url
        self.session = requests.Session()
        self.session.timeout = 1  # 1秒超时，避免阻塞
        
    def _send_log(self, level: str, message: str):
        """异步发送日志到UI"""
        def send():
            try:
                payload = {
                    "service": self.service_name,
                    "level": level,
                    "message": message
                }
                self.session.post(
                    f"{self.ui_url}/api/log",
                    json=payload,
                    timeout=1
                )
            except:
                # 静默失败，不影响主程序运行
                pass
        
        # 在新线程中发送，避免阻塞
        threading.Thread(target=send, daemon=True).start()
    
    def info(self, message: str):
        self._send_log("info", message)
    
    def warning(self, message: str):
        self._send_log("warning", message)
    
    def error(self, message: str):
        self._send_log("error", message)
    
    def debug(self, message: str):
        self._send_log("debug", message)

# 预定义的服务日志器
def get_ui_logger(service_name: str) -> UILogger:
    """获取指定服务的UI日志器"""
    return UILogger(service_name)
