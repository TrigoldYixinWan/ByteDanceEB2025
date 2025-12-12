"use client";

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { MerchantLayout } from "@/components/merchant-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronRight, ChevronDown, Clock, Tag, FileText, FolderOpen, MessageSquare } from "lucide-react"

const CATEGORIES = [
  { id: 1, name: "商品管理", icon: "📦", color: "bg-blue-50", hoverColor: "hover:bg-blue-100", borderColor: "border-blue-200" },
  { id: 2, name: "实施细则", icon: "📋", color: "bg-purple-50", hoverColor: "hover:bg-purple-100", borderColor: "border-purple-200" },
  { id: 3, name: "招商入驻", icon: "🏪", color: "bg-green-50", hoverColor: "hover:bg-green-100", borderColor: "border-green-200" },
  { id: 4, name: "经营成长", icon: "📈", color: "bg-orange-50", hoverColor: "hover:bg-orange-100", borderColor: "border-orange-200" },
  { id: 5, name: "规则解读", icon: "📖", color: "bg-pink-50", hoverColor: "hover:bg-pink-100", borderColor: "border-pink-200" },
  { id: 6, name: "资金结算", icon: "💰", color: "bg-yellow-50", hoverColor: "hover:bg-yellow-100", borderColor: "border-yellow-200" },
  { id: 7, name: "违规管理", icon: "⚠️", color: "bg-red-50", hoverColor: "hover:bg-red-100", borderColor: "border-red-200" },
  { id: 8, name: "其他内容", icon: "📄", color: "bg-gray-50", hoverColor: "hover:bg-gray-100", borderColor: "border-gray-200" },
]

// 文档预览接口
interface DocumentPreview {
  id: string
  title: string
  category: string
  subcategory?: string | null
  status: 'pending' | 'processing' | 'ready' | 'failed'
  createdAt: string
}

export default function MerchantHomePage() {
  const [documents, setDocuments] = useState<DocumentPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 当前展开的类别（null 表示全部收起）
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  // 从 API 获取真实文档数据
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch('/api/documents')
        
        if (!response.ok) {
          throw new Error('获取文档列表失败')
        }

        const data = await response.json()
        
        // 只显示 'ready' 状态的文档（已处理完成的）
        const readyDocuments = data.documents
          .filter((doc: any) => doc.status === 'ready')
          .map((doc: any) => ({
            id: doc.id,
            title: doc.title,
            category: doc.category,
            subcategory: doc.subcategory,
            status: doc.status,
            createdAt: doc.createdAt,
          }))
        
        setDocuments(readyDocuments)
        setLoading(false)
      } catch (err) {
        console.error('获取文档失败:', err)
        setError(err instanceof Error ? err.message : '获取文档失败')
        setLoading(false)
      }
    }

    fetchDocuments()
  }, [])

  // 按类别分组文档
  const documentsByCategory = useMemo(() => {
    const grouped: Record<string, DocumentPreview[]> = {}
    documents.forEach(doc => {
      if (!grouped[doc.category]) {
        grouped[doc.category] = []
      }
      grouped[doc.category].push(doc)
    })
    return grouped
  }, [documents])

  // 获取类别下的文档数量
  const getCategoryCount = (categoryName: string) => {
    return documentsByCategory[categoryName]?.length || 0
  }

  // 切换类别展开状态
  const toggleCategory = (categoryName: string) => {
    setExpandedCategory(prev => prev === categoryName ? null : categoryName)
  }

  return (
    <MerchantLayout>
      <div className="flex flex-col min-h-screen">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h1 className="text-4xl font-bold tracking-tight mb-4">欢迎来到您的知识库</h1>
            <p className="text-lg text-muted-foreground">查找答案、探索资源并促进您的业务增长</p>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
          {/* Categories Grid */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8">按类别浏览</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CATEGORIES.map((category) => {
                const isExpanded = expandedCategory === category.name
                const categoryDocs = documentsByCategory[category.name] || []
                const docCount = categoryDocs.length

                return (
                  <div key={category.id} className="relative">
                    {/* 类别卡片 */}
                    <Card 
                      className={`
                        transition-all duration-200 cursor-pointer
                        ${isExpanded 
                          ? `${category.color} ${category.borderColor} border-2 shadow-md` 
                          : `hover:shadow-md ${category.hoverColor}`
                        }
                      `}
                      onClick={() => toggleCategory(category.name)}
                    >
                      <CardContent className="pt-6 pb-4">
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{category.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-base">{category.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {docCount > 0 ? `${docCount} 篇文档` : '暂无文档'}
                            </p>
                      </div>
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-primary mt-1 transition-transform" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground mt-1 transition-transform" />
                          )}
                    </div>
                  </CardContent>
                </Card>

                    {/* 展开的文档列表 */}
                    {isExpanded && (
                      <div 
                        className={`
                          mt-2 rounded-lg border-2 ${category.borderColor} ${category.color}
                          overflow-hidden animate-in slide-in-from-top-2 duration-200
                        `}
                      >
                        {categoryDocs.length === 0 ? (
                          <div className="p-4 text-center">
                            <FolderOpen className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">该类别下暂无文档</p>
                          </div>
                        ) : (
                          <div className="max-h-64 overflow-y-auto">
                            {categoryDocs.map((doc, index) => (
                              <Link 
                                key={doc.id} 
                                href={`/portal/knowledge/${doc.id}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div 
                                  className={`
                                    flex items-center gap-3 px-4 py-3 
                                    hover:bg-white/50 transition-colors cursor-pointer
                                    ${index !== categoryDocs.length - 1 ? 'border-b border-border/50' : ''}
                                  `}
                                >
                                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate hover:text-primary">
                                      {doc.title}
                                    </p>
                                    {doc.subcategory && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {doc.subcategory}
                                      </p>
                                    )}
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent Updates */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">最近更新</h2>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-4 text-muted-foreground">加载中...</p>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <p className="text-destructive">❌ {error}</p>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!loading && !error && documents.length === 0 && (
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <p className="text-muted-foreground">暂无可用文档</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    管理员正在上传和处理文档，请稍后再来查看
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Document List */}
            {!loading && !error && documents.length > 0 && (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <Link key={doc.id} href={`/portal/knowledge/${doc.id}`}>
                    <Card className="hover:bg-secondary/50 transition-colors cursor-pointer">
                      <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base hover:text-primary">{doc.title}</h3>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              <Tag className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{doc.category}</span>
                            </div>
                            {doc.subcategory && (
                              <span className="text-sm text-muted-foreground">
                                / {doc.subcategory}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {new Date(doc.createdAt).toLocaleDateString('zh-CN')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground mt-1 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Floating Action Button */}
          <div className="fixed bottom-6 right-6">
            <Link href="/portal/chat">
              <Button size="lg" className="rounded-full shadow-lg hover:shadow-xl transition-shadow">
                <MessageSquare className="mr-2 w-5 h-5" />
                咨询 AI 助手
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
