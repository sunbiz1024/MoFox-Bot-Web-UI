import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "./ui/chart";
import { LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from "recharts";
import { TrendingUp } from "lucide-react";

// 定义图表配置
const chartConfig = {
  cpu: {
    label: "CPU",
    color: "hsl(var(--chart-1))",
  },
  memory: {
    label: "内存",
    color: "hsl(var(--chart-2))",
  },
  cpuPrediction: {
    label: "CPU 预测",
    color: "hsl(var(--chart-1))",
  },
  memoryPrediction: {
    label: "内存预测",
    color: "hsl(var(--chart-2))",
  },
};

export function PowerPredictionChart() {
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    // 生成模拟数据
    const generateData = () => {
      const data = [];
      const now = new Date();
      
      // 1. 生成过去48小时的历史数据 (每小时一个点)
      for (let i = 48; i > 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        data.push({
          time: time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
          cpu: Math.floor(Math.random() * 40) + 20, // 20-60%
          memory: Math.floor(Math.random() * 50) + 30, // 30-80%
        });
      }

      const lastCpu = data[data.length - 1].cpu;
      const lastMemory = data[data.length - 1].memory;

      // 2. 生成未来1小时的预测数据 (每10分钟一个点)
      for (let i = 1; i <= 6; i++) {
        const time = new Date(now.getTime() + i * 10 * 60 * 1000);
        data.push({
          time: time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
          cpuPrediction: Math.max(0, Math.min(100, lastCpu + (Math.random() * 10 - 5))), // 在最后一个点附近波动
          memoryPrediction: Math.max(0, Math.min(100, lastMemory + (Math.random() * 10 - 5))),
        });
      }
      
      return data;
    };

    setChartData(generateData());
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          功耗预测
        </CardTitle>
        <CardDescription>未来1小时 CPU 和内存功耗预测</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <LineChart data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value, index) => {
                // 每隔8个点显示一个标签，避免拥挤
                return index % 8 === 0 ? value : "";
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Legend content={<ChartLegendContent />} />
            <Line
              dataKey="cpu"
              type="monotone"
              stroke={chartConfig.cpu.color}
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="memory"
              type="monotone"
              stroke={chartConfig.memory.color}
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="cpuPrediction"
              type="monotone"
              stroke={chartConfig.cpuPrediction.color}
              strokeWidth={2}
              strokeDasharray="5 5" // 虚线
              dot={{ r: 2 }}
            />
            <Line
              dataKey="memoryPrediction"
              type="monotone"
              stroke={chartConfig.memoryPrediction.color}
              strokeWidth={2}
              strokeDasharray="5 5" // 虚线
              dot={{ r: 2 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}