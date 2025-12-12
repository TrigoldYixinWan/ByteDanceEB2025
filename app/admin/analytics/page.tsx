"use client";

import { useState, useEffect, useCallback } from "react"
import dynamic from 'next/dynamic'
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  BarChart3, TrendingUp, FileText, AlertTriangle, 
  RefreshCw, ChevronLeft, ChevronRight, ExternalLink, Calendar
} from "lucide-react"
import Link from "next/link"

// 动态导入 ECharts 组件（避免 SSR 问题）
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

// 时间范围选项
const TIME_RANGE_OPTIONS = [
  { label: '全部', value: null },
  { label: '1 天', value: 1 },
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
]

// 类型定义
interface HeatmapData {
  period: { days: number; startDate: string; endDate: string } | null
  summary: {
    totalDocuments: number
    totalCitations: number
    documentsWithCitations: number
    coverageRate: number
  }
  documentHeatmap: {
    id: string
    title: string
    category: string
    citationCount: number
  }[]
  chunkHeatmap: {
    id: string
    documentId: string
    documentTitle: string
    category: string
    contentPreview: string
    citationCount: number
  }[]
}

interface ZeroHitData {
  summary: {
    totalZeroHits: number
    totalQuestions: number
    zeroHitRate: number
  }
  questions: {
    id: string
    question: string
    createdAt: string
    userName: string
  }[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function AdminAnalyticsPage() {
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null)
  const [zeroHitData, setZeroHitData] = useState<ZeroHitData | null>(null)
  const [loading, setLoading] = useState(true)
  const [zeroHitPage, setZeroHitPage] = useState(1)
  const [timeRange, setTimeRange] = useState<number | null>(null)  // null = 全部时间

  // 加载热力图数据
  const loadHeatmapData = useCallback(async (days: number | null) => {
    try {
      const url = days 
        ? `/api/admin/analytics/heatmap?days=${days}`
        : '/api/admin/analytics/heatmap'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setHeatmapData(data)
      }
    } catch (error) {
      console.error('加载热力图数据失败:', error)
    }
  }, [])

  // 加载零命中数据
  const loadZeroHitData = useCallback(async (page: number = 1) => {
    try {
      const response = await fetch(`/api/admin/analytics/zero-hits?page=${page}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setZeroHitData(data)
      }
    } catch (error) {
      console.error('加载零命中数据失败:', error)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      await Promise.all([loadHeatmapData(timeRange), loadZeroHitData(1)])
      setLoading(false)
    }
    loadAll()
  }, [loadHeatmapData, loadZeroHitData, timeRange])

  // 切换时间范围
  const handleTimeRangeChange = async (days: number | null) => {
    setTimeRange(days)
    setLoading(true)
    await loadHeatmapData(days)
    setLoading(false)
  }

  // 切换零命中分页
  const handleZeroHitPageChange = (newPage: number) => {
    setZeroHitPage(newPage)
    loadZeroHitData(newPage)
  }

  // 刷新数据
  const handleRefresh = async () => {
    setLoading(true)
    await Promise.all([loadHeatmapData(timeRange), loadZeroHitData(zeroHitPage)])
    setLoading(false)
  }

  // 统计卡片数据
  const stats = [
    {
      title: "总文档数",
      value: heatmapData?.summary.totalDocuments ?? '-',
      icon: FileText,
      description: "已处理的知识库文档",
      color: "text-blue-600",
    },
    {
      title: timeRange ? `${timeRange}天引用次数` : "总引用次数",
      value: heatmapData?.summary.totalCitations ?? '-',
      icon: BarChart3,
      description: timeRange ? `最近 ${timeRange} 天的引用` : "文档被 AI 引用的总次数",
      color: "text-green-600",
    },
    {
      title: "知识覆盖率",
      value: heatmapData?.summary.coverageRate !== undefined 
        ? `${heatmapData.summary.coverageRate}%` 
        : '-',
      icon: TrendingUp,
      description: "被引用过的文档占比",
      color: "text-purple-600",
    },
    {
      title: "零命中率",
      value: zeroHitData?.summary.zeroHitRate !== undefined 
        ? `${zeroHitData.summary.zeroHitRate}%` 
        : '-',
      icon: AlertTriangle,
      description: "知识库无法回答的问题比例",
      color: zeroHitData?.summary.zeroHitRate && zeroHitData.summary.zeroHitRate > 20 
        ? "text-red-600" 
        : "text-orange-600",
    },
  ]

  // ECharts 热力图配置（横向柱状图）
  const heatmapChartOptions = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const data = params[0]
        return `<div style="padding: 8px;">
          <strong>${data.name}</strong><br/>
          引用次数: <strong>${data.value}</strong>
        </div>`
      }
    },
    grid: {
      left: '3%',
      right: '8%',
      bottom: '3%',
      top: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '引用次数',
      nameLocation: 'end',
      axisLabel: {
        color: '#888'
      }
    },
    yAxis: {
      type: 'category',
      data: heatmapData?.documentHeatmap.slice(0, 10).map(d => 
        d.title.length > 15 ? d.title.slice(0, 15) + '...' : d.title
      ).reverse() || [],
      axisLabel: {
        color: '#666',
        fontSize: 12
      }
    },
    series: [{
      name: '引用次数',
      type: 'bar',
      data: heatmapData?.documentHeatmap.slice(0, 10).map(d => d.citationCount).reverse() || [],
      itemStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [
            { offset: 0, color: '#6366f1' },
            { offset: 1, color: '#8b5cf6' }
          ]
        },
        borderRadius: [0, 4, 4, 0]
      },
      emphasis: {
        itemStyle: {
          color: '#4f46e5'
        }
      },
      label: {
        show: true,
        position: 'right',
        color: '#666',
        fontSize: 12
      }
    }]
  }

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <AdminLayout>
      <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">分析报告</h1>
            <p className="text-muted-foreground mt-2">查看知识库使用情况和统计数据</p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
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
                  <div className="text-2xl font-bold">
                    {loading ? (
                      <span className="inline-block w-16 h-8 bg-muted animate-pulse rounded" />
                    ) : (
                      stat.value
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 知识点热力图 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    知识点引用热力图
                  </CardTitle>
                  <CardDescription>
                    被 AI 引用最多的文档 Top 10
                    {heatmapData?.period && (
                      <span className="ml-2 text-primary">
                        (最近 {heatmapData.period.days} 天)
                      </span>
                    )}
                  </CardDescription>
                </div>
                
                {/* 时间选择器 */}
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  {TIME_RANGE_OPTIONS.map((option) => (
                    <Button
                      key={option.label}
                      variant={timeRange === option.value ? "default" : "ghost"}
                      size="sm"
                      className={`h-7 px-3 text-xs ${
                        timeRange === option.value 
                          ? '' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => handleTimeRangeChange(option.value)}
                      disabled={loading}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : heatmapData?.documentHeatmap.length === 0 ? (
                <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                  <p>暂无引用数据</p>
                  <p className="text-sm mt-2">
                    {timeRange ? `最近 ${timeRange} 天内无引用记录` : '使用 AI 问答后将显示引用统计'}
                  </p>
                </div>
              ) : (
                <ReactECharts 
                  option={heatmapChartOptions} 
                  style={{ height: '400px' }}
                  notMerge={true}
                />
              )}
            </CardContent>
          </Card>

          {/* 零命中问题列表 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                零命中问题
              </CardTitle>
              <CardDescription>
                用户咨询但知识库无法回答的问题
                {zeroHitData && (
                  <span className="ml-2 text-foreground font-medium">
                    (共 {zeroHitData.summary.totalZeroHits} 个)
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : zeroHitData?.questions.length === 0 ? (
                <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
                  <AlertTriangle className="w-12 h-12 mb-4 opacity-50" />
                  <p>暂无零命中问题</p>
                  <p className="text-sm mt-2">这是好消息！知识库覆盖良好</p>
                </div>
              ) : (
                <div className="flex flex-col h-[400px]">
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-3">
                      {zeroHitData?.questions.map((q, index) => (
                        <div 
                          key={q.id} 
                          className="p-3 bg-muted/50 rounded-lg border border-border hover:border-primary/30 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">
                              {(zeroHitPage - 1) * 10 + index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground line-clamp-2">
                                {q.question}
                              </p>
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <span>{q.userName}</span>
                                <span>·</span>
                                <span>{formatTime(q.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* 分页 */}
                  {zeroHitData && zeroHitData.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                      <p className="text-sm text-muted-foreground">
                        第 {zeroHitData.pagination.page} / {zeroHitData.pagination.totalPages} 页
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleZeroHitPageChange(zeroHitPage - 1)}
                          disabled={zeroHitPage <= 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleZeroHitPageChange(zeroHitPage + 1)}
                          disabled={zeroHitPage >= zeroHitData.pagination.totalPages}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 详细数据表格 */}
        {heatmapData && heatmapData.documentHeatmap.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>文档引用详情</CardTitle>
              <CardDescription>
                {heatmapData.period 
                  ? `最近 ${heatmapData.period.days} 天被引用过的文档`
                  : '所有被引用过的文档及其引用次数'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-sm font-semibold">排名</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">文档标题</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">类别</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">引用次数</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapData.documentHeatmap.map((doc, index) => (
                      <tr 
                        key={doc.id} 
                        className="border-b border-border hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className={`
                            inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                            ${index < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                          `}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{doc.title}</td>
                        <td className="px-4 py-3 text-muted-foreground">{doc.category}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                            <BarChart3 className="w-3 h-3" />
                            {doc.citationCount}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/documents/${doc.id}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4 mr-1" />
                              查看
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
