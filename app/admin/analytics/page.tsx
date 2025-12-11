"use client";

import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, TrendingUp, Users, FileText } from "lucide-react"

export default function AdminAnalyticsPage() {
  const stats = [
    {
      title: "总文档数",
      value: "127",
      icon: FileText,
      trend: "+12% 本月",
      color: "text-blue-600",
    },
    {
      title: "总引用次数",
      value: "1,234",
      icon: BarChart3,
      trend: "+23% 本月",
      color: "text-green-600",
    },
    {
      title: "活跃用户",
      value: "89",
      icon: Users,
      trend: "+5% 本周",
      color: "text-purple-600",
    },
    {
      title: "增长率",
      value: "18.2%",
      icon: TrendingUp,
      trend: "+2.1% 本月",
      color: "text-orange-600",
    },
  ]

  return (
    <AdminLayout>
      <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">分析报告</h1>
          <p className="text-muted-foreground mt-2">查看您的知识库使用情况和统计数据</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Charts Placeholder */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>文档引用热图</CardTitle>
              <CardDescription>最常被引用的文档</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center border-2 border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">图表区域 - 待实现</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>用户活动趋势</CardTitle>
              <CardDescription>过去 30 天的活动</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center border-2 border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">图表区域 - 待实现</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

