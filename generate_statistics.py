#!/usr/bin/env python3
"""
MaiBot 统计数据生成器
从数据库读取实际数据并生成统计HTML文件
"""

import sqlite3
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

def get_db_connection():
    """获取数据库连接"""
    db_path = "../Bot/data/MaiBot.db"
    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        return None
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row  # 使查询结果可以通过列名访问
        return conn
    except Exception as e:
        print(f"连接数据库失败: {e}")
        return None

def get_table_names(conn):
    """获取数据库中的所有表名"""
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    return tables

def get_llm_usage_stats(conn):
    """获取LLM使用统计"""
    try:
        cursor = conn.cursor()
        # 按模型分组统计
        cursor.execute("""
            SELECT 
                model_name,
                COUNT(*) as call_count,
                SUM(prompt_tokens) as input_tokens,
                SUM(completion_tokens) as output_tokens,
                SUM(total_tokens) as total_tokens,
                SUM(cost) as total_cost,
                AVG(time_cost) as avg_time,
                MAX(time_cost) as max_time
            FROM llm_usage 
            GROUP BY model_name 
            ORDER BY call_count DESC
            LIMIT 10
        """)
        return cursor.fetchall()
    except Exception as e:
        print(f"获取LLM统计失败: {e}")
        return []

def get_chat_stats(conn):
    """获取聊天统计"""
    try:
        cursor = conn.cursor()
        # 按群组统计消息数量
        cursor.execute("""
            SELECT 
                chat_info_group_name,
                COUNT(*) as message_count
            FROM messages 
            WHERE chat_info_group_name IS NOT NULL
            GROUP BY chat_info_group_name 
            ORDER BY message_count DESC
            LIMIT 10
        """)
        return cursor.fetchall()
    except Exception as e:
        print(f"获取聊天统计失败: {e}")
        return []

def get_time_period_stats(conn, hours=24):
    """获取指定时间段的统计"""
    try:
        cursor = conn.cursor()
        # 获取最近N小时的统计
        cursor.execute("""
            SELECT 
                COUNT(*) as total_calls,
                SUM(prompt_tokens) as total_input,
                SUM(completion_tokens) as total_output,
                SUM(total_tokens) as total_tokens,
                SUM(cost) as total_cost
            FROM llm_usage 
            WHERE datetime(timestamp) >= datetime('now', '-{} hours')
        """.format(hours))
        result = cursor.fetchone()
        return result if result else (0, 0, 0, 0, 0)
    except Exception as e:
        print(f"获取时间段统计失败: {e}")
        return (0, 0, 0, 0, 0)

def analyze_database(conn):
    """分析数据库结构"""
    tables = get_table_names(conn)
    print("数据库中的表:")
    
    table_info = {}
    for table in tables:
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table})")
        columns = cursor.fetchall()
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        row_count = cursor.fetchone()[0]
        
        table_info[table] = {
            'columns': [col[1] for col in columns],
            'row_count': row_count
        }
        
        print(f"  - {table}: {row_count} 行")
    
    return table_info

def generate_statistics_html():
    """生成统计HTML文件"""
    conn = get_db_connection()
    if not conn:
        return create_fallback_html()
    
    try:
        # 获取各种统计数据
        llm_stats = get_llm_usage_stats(conn)
        chat_stats = get_chat_stats(conn)
        stats_7d = get_time_period_stats(conn, 24*7)  # 7天
        stats_24h = get_time_period_stats(conn, 24)   # 24小时
        stats_3h = get_time_period_stats(conn, 3)     # 3小时
        stats_1h = get_time_period_stats(conn, 1)     # 1小时
        
        # 生成当前时间
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 创建统计HTML
        html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MaiBot运行统计报告</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f4f7f6;
            color: #333;
            line-height: 1.6;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background-color: #fff;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h1, h2 {{
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
            margin-top: 0;
        }}
        h1 {{
            text-align: center;
            font-size: 2em;
        }}
        h2 {{
            font-size: 1.5em;
            margin-top: 30px;
        }}
        .info-item {{
            background-color: #ecf0f1;
            padding: 8px 12px;
            border-radius: 4px;
            margin-bottom: 8px;
            font-size: 0.95em;
        }}
        .info-item strong {{
            color: #2980b9;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 0.9em;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
        }}
        th {{
            background-color: #3498db;
            color: white;
            font-weight: bold;
        }}
        tr:nth-child(even) {{
            background-color: #f9f9f9;
        }}
        .tabs {{
            overflow: hidden;
            background: #ecf0f1;
            display: flex;
        }}
        .tabs button {{
            background: inherit; 
            border: none; 
            outline: none;
            padding: 14px 16px; 
            cursor: pointer;
            transition: 0.3s; 
            font-size: 16px;
        }}
        .tabs button:hover {{
            background-color: #d4dbdc;
        }}
        .tabs button.active {{
            background-color: #b3bbbd;
        }}
        .tab-content {{
            display: none;
            padding: 20px;
            background-color: #fff;
            border: 1px solid #ccc;
        }}
        .tab-content.active {{
            display: block;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>MaiBot运行统计报告</h1>
        <p class="info-item"><strong>统计截止时间:</strong> {current_time}</p>

        <div class="tabs">
            <button class="tab-link active" onclick="showTab(event, 'last_7_days')">最近7天</button>
            <button class="tab-link" onclick="showTab(event, 'last_24_hours')">最近24小时</button>
            <button class="tab-link" onclick="showTab(event, 'last_3_hours')">最近3小时</button>
            <button class="tab-link" onclick="showTab(event, 'last_hour')">最近1小时</button>
        </div>

        <div id="last_7_days" class="tab-content active">
            <p class="info-item"><strong>统计时段:</strong> 最近7天</p>
            <p class="info-item"><strong>总消息数:</strong> {stats_7d[0] if stats_7d and stats_7d[0] else 0}</p>
            <p class="info-item"><strong>总请求数:</strong> {stats_7d[0] if stats_7d and stats_7d[0] else 0}</p>
            <p class="info-item"><strong>总花费:</strong> {(stats_7d[4] if stats_7d and stats_7d[4] else 0.0):.4f} ¥</p>
            
            <h2>按模型分类统计</h2>
            <table>
                <thead>
                    <tr><th>模型名称</th><th>调用次数</th><th>输入Token</th><th>输出Token</th><th>Token总量</th><th>累计花费</th><th>平均耗时(秒)</th><th>最大耗时(秒)</th></tr>
                </thead>
                <tbody>"""
        
        # 添加LLM统计数据
        for row in llm_stats:
            model_name, call_count, input_tokens, output_tokens, total_tokens, total_cost, avg_time, max_time = row
            # 确保所有数值都有默认值
            model_name = model_name or 'Unknown'
            call_count = call_count or 0
            input_tokens = input_tokens or 0
            output_tokens = output_tokens or 0
            total_tokens = total_tokens or 0
            total_cost = total_cost or 0.0
            avg_time = avg_time or 0.0
            max_time = max_time or 0.0
            
            html_content += f"""
                    <tr>
                        <td>{model_name}</td>
                        <td>{call_count}</td>
                        <td>{input_tokens}</td>
                        <td>{output_tokens}</td>
                        <td>{total_tokens}</td>
                        <td>{total_cost:.4f} ¥</td>
                        <td>{avg_time:.3f} 秒</td>
                        <td>{max_time:.3f} 秒</td>
                    </tr>"""
        
        html_content += """
                </tbody>
            </table>
            
            <h2>聊天消息统计</h2>
            <table>
                <thead>
                    <tr><th>群组名称</th><th>消息数量</th></tr>
                </thead>
                <tbody>"""
        
        # 添加聊天统计数据
        for row in chat_stats:
            group_name, message_count = row
            html_content += f"""
                    <tr>
                        <td>{group_name or 'Unknown'}</td>
                        <td>{message_count or 0}</td>
                    </tr>"""
        
        html_content += """
                </tbody>
            </table>
        </div>

        <!-- 其他时间段的内容 -->"""
        
        # 为其他时间段生成类似的内容
        for period, period_name, stats in [
            ('last_24_hours', '最近24小时', stats_24h),
            ('last_3_hours', '最近3小时', stats_3h),
            ('last_hour', '最近1小时', stats_1h)
        ]:
            # 确保stats有默认值
            safe_stats = stats if stats else (0, 0, 0, 0, 0.0)
            html_content += f"""
        <div id="{period}" class="tab-content">
            <p class="info-item"><strong>统计时段:</strong> {period_name}</p>
            <p class="info-item"><strong>总消息数:</strong> {safe_stats[0] or 0}</p>
            <p class="info-item"><strong>总请求数:</strong> {safe_stats[0] or 0}</p>
            <p class="info-item"><strong>总花费:</strong> {safe_stats[4]:.4f} ¥</p>
            
            <h2>基本统计信息</h2>
            <table>
                <thead>
                    <tr><th>项目</th><th>数值</th></tr>
                </thead>
                <tbody>
                    <tr><td>调用次数</td><td>{safe_stats[0] or 0}</td></tr>
                    <tr><td>输入Token</td><td>{safe_stats[1] or 0}</td></tr>
                    <tr><td>输出Token</td><td>{safe_stats[2] or 0}</td></tr>
                    <tr><td>Token总量</td><td>{safe_stats[3] or 0}</td></tr>
                    <tr><td>累计花费</td><td>{safe_stats[4]:.4f} ¥</td></tr>
                </tbody>
            </table>
        </div>"""
        
        html_content += """
    </div>

    <script>
        function showTab(evt, tabName) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tab-content");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].classList.remove("active");
            }
            tablinks = document.getElementsByClassName("tab-link");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].classList.remove("active");
            }
            document.getElementById(tabName).classList.add("active");
            evt.currentTarget.classList.add("active");
        }
    </script>
</body>
</html>"""
        
        return html_content
        
    except Exception as e:
        print(f"生成统计数据时出错: {e}")
        return create_fallback_html()
    finally:
        conn.close()

def create_fallback_html():
    """创建备用HTML"""
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MaiBot 统计报告</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }}
        .container {{ max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; }}
        .error {{ background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 MaiBot 统计报告</h1>
        <p>生成时间: {current_time}</p>
        
        <div class="error">
            <h3>⚠️ 数据库连接问题</h3>
            <p>无法连接到 MaiBot 数据库，可能的原因：</p>
            <ul>
                <li>数据库文件不存在</li>
                <li>数据库文件权限问题</li>
                <li>MaiBot 未启动或数据库被锁定</li>
            </ul>
            <p><strong>建议：</strong></p>
            <ul>
                <li>确保 MaiBot 正在运行</li>
                <li>检查数据库文件路径：<code>../Bot/data/MaiBot.db</code></li>
                <li>重新启动 MaiBot 服务</li>
            </ul>
        </div>
    </div>
</body>
</html>"""

def main():
    """主函数"""
    print("开始生成 MaiBot 统计报告...")
    
    # 生成统计HTML
    html_content = generate_statistics_html()
    
    # 保存到文件
    output_path = "../Bot/maibot_statistics.html"
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print("统计报告已生成: " + output_path)
    except Exception as e:
        print("保存文件失败: " + str(e))

if __name__ == "__main__":
    main()
