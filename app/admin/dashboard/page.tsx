"use client";

import { useState, useEffect } from "react"
import Link from "next/link"
import { AdminLayout } from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, FileText, CheckCircle2, Clock, Trash2, RefreshCw, AlertCircle, HelpCircle, Eye } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Document } from "@/types"

export default function AdminDashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // 获取文档列表
  const fetchDocuments = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/documents')

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '获取文档列表失败')
      }

      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (err) {
      console.error('Error fetching documents:', err)
      setError(err instanceof Error ? err.message : '加载文档失败')
    } finally {
      setLoading(false)
    }
  }

  // 组件挂载时获取数据
  useEffect(() => {
    fetchDocuments()
  }, [])

  // 删除文档
  const handleDelete = async (docId: string, docTitle: string) => {
    if (!confirm(`确定要删除文档 "${docTitle}" 吗？此操作无法撤销。`)) {
      return
    }

    setDeletingId(docId)
    
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '删除文档失败')
      }

      // 从列表中移除
      setDocuments(prev => prev.filter(doc => doc.id !== docId))
      
      console.log(`文档 "${docTitle}" 已删除`)
    } catch (error) {
      console.error('删除文档失败:', error)
      alert(error instanceof Error ? error.message : '删除文档失败，请重试')
    } finally {
      setDeletingId(null)
    }
  }

  const handleProcess = async (docId: string, docTitle: string) => {
    if (!confirm(`开始处理文档 "${docTitle}"？\n\n这将解析 PDF、生成向量嵌入并存储到数据库。\n处理过程可能需要几分钟，请耐心等待。`)) {
      return
    }

    setProcessingId(docId)

    try {
      console.log(`🔄 开始处理文档: ${docId}`)

      const response = await fetch(`/api/documents/${docId}/process`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '处理失败')
      }

      const result = await response.json()
      console.log(`✅ 处理成功:`, result)

      alert(`文档处理成功！\n\n生成了 ${result.document.chunksCount} 个文本块\n估算成本: ${result.document.estimatedCost}`)

      // 刷新文档列表
      fetchDocuments()
    } catch (error) {
      console.error('❌ 处理失败:', error)
      alert(`文档处理失败：${error instanceof Error ? error.message : '未知错误'}`)
      
      // 刷新列表以更新状态
      fetchDocuments()
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <AdminLayout>
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <div className="border-b border-border p-4 sm:p-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">文档管理</h1>
            <p className="text-muted-foreground mt-1">管理和组织您的知识库文档</p>
          </div>

          {/* Upload Button */}
          <Link href="/admin/upload">
            <Button>
              <Upload className="mr-2 w-4 h-4" />
              上传文档
            </Button>
          </Link>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{error}</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchDocuments}
                    className="ml-4"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重试
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground">加载文档列表...</p>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && documents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">还没有文档</h3>
                <p className="text-muted-foreground mb-6">上传第一个文档以开始构建您的知识库</p>
                <Link href="/admin/upload">
                  <Button>
                    <Upload className="mr-2 w-4 h-4" />
                    上传文档
                  </Button>
                </Link>
              </div>
            )}

            {/* Table */}
            {!loading && !error && documents.length > 0 && (
              <Card>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-6 py-4 text-left text-sm font-semibold">标题</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">类别</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">状态</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">引用数</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">日期</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc, index) => (
                        <tr
                          key={doc.id}
                          className={`border-b border-border hover:bg-secondary/30 transition-colors ${index === documents.length - 1 ? "border-b-0" : ""}`}
                        >
                          <td className="px-6 py-4">
                            <Link href={`/admin/documents/${doc.id}`}>
                              <div className="flex items-center gap-3 hover:text-primary transition-colors cursor-pointer">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium hover:underline">{doc.title}</span>
                              </div>
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">{doc.category}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {doc.status === "ready" ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                  <span className="text-sm font-medium text-green-600">就绪</span>
                                </>
                              ) : doc.status === "processing" ? (
                                <>
                                  <Clock className="w-4 h-4 text-yellow-600 animate-spin" />
                                  <span className="text-sm font-medium text-yellow-600">处理中</span>
                                </>
                              ) : doc.status === "pending" ? (
                                <>
                                  <HelpCircle className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-medium text-blue-600">待处理</span>
                                </>
                              ) : doc.status === "failed" ? (
                                <>
                                  <AlertCircle className="w-4 h-4 text-red-600" />
                                  <span className="text-sm font-medium text-red-600">失败</span>
                                </>
                              ) : (
                                <>
                                  <HelpCircle className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm font-medium text-gray-600">未知</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">{doc.citationCount || 0}</td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {new Date(doc.createdAt).toLocaleDateString('zh-CN')}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {/* View Button */}
                              <Link href={`/admin/documents/${doc.id}`}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                  title="查看文档"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>

                              {/* Process Button - Only show for pending documents */}
                              {doc.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleProcess(doc.id, doc.title)}
                                  disabled={processingId === doc.id}
                                  className="h-8 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title="处理文档"
                                >
                                  {processingId === doc.id ? (
                                    <>
                                      <Clock className="h-4 w-4 mr-1 animate-spin" />
                                      <span className="text-xs">处理中...</span>
                                    </>
                                  ) : (
                                    <>
                                      <FileText className="h-4 w-4 mr-1" />
                                      <span className="text-xs">处理</span>
                                    </>
                                  )}
                                </Button>
                              )}

                              {/* Delete Button */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(doc.id, doc.title)}
                                disabled={deletingId === doc.id || processingId === doc.id}
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="删除文档"
                              >
                                {deletingId === doc.id ? (
                                  <Clock className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
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
        </div>
      </div>
    </AdminLayout>
  )
}
