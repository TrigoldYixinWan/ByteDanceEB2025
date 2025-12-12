"use client";

import React, { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { AdminLayout } from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronLeft, Calendar, Tag, FileText, Download, AlertCircle, ExternalLink, Loader2, Eye, FileCode } from "lucide-react"

// 文档详情接口
interface DocumentDetail {
  id: string
  title: string
  category: string
  subcategory?: string | null
  contentType: string
  sourceUrl: string
  filePath: string
  status: 'pending' | 'processing' | 'ready' | 'failed'
  content: string
  chunkCount: number
  createdAt: string
  updatedAt: string
}

// 获取文件扩展名
const getFileExtension = (filePath: string): string => {
  return filePath?.split('.').pop()?.toLowerCase() || ''
}

// 判断文件类型
const getFileType = (contentType: string, filePath: string): 'pdf' | 'markdown' | 'text' | 'unknown' => {
  const ext = getFileExtension(filePath)
  
  if (contentType === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (contentType === 'text/markdown' || ext === 'md' || ext === 'markdown') return 'markdown'
  if (contentType === 'text/plain' || ext === 'txt') return 'text'
  
  return 'unknown'
}

export default function AdminDocumentDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [document, setDocument] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 原始文件内容（用于 MD/TXT）
  const [rawContent, setRawContent] = useState<string | null>(null)
  const [rawContentLoading, setRawContentLoading] = useState(false)
  const [rawContentError, setRawContentError] = useState<string | null>(null)
  
  // 显示模式：'original' 原始文件 | 'chunks' 分块内容
  const [viewMode, setViewMode] = useState<'original' | 'chunks'>('original')

  // 从 API 获取文档详情
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/documents/${id}`)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '获取文档失败')
        }

        const data = await response.json()
        setDocument(data.document)
      } catch (err) {
        console.error('获取文档失败:', err)
        setError(err instanceof Error ? err.message : '获取文档失败')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchDocument()
    }
  }, [id])

  // 获取原始文件内容（MD/TXT）
  const fetchRawContent = useCallback(async (sourceUrl: string) => {
    try {
      setRawContentLoading(true)
      setRawContentError(null)
      
      const response = await fetch(sourceUrl)
      
      if (!response.ok) {
        throw new Error('无法获取原始文件内容')
      }
      
      const text = await response.text()
      setRawContent(text)
    } catch (err) {
      console.error('获取原始内容失败:', err)
      setRawContentError(err instanceof Error ? err.message : '获取原始内容失败')
    } finally {
      setRawContentLoading(false)
    }
  }, [])

  // 当文档加载完成且是文本类型时，自动获取原始内容
  useEffect(() => {
    if (document?.sourceUrl) {
      const fileType = getFileType(document.contentType, document.filePath)
      if (fileType === 'markdown' || fileType === 'text') {
        fetchRawContent(document.sourceUrl)
      }
    }
  }, [document, fetchRawContent])

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // 渲染 Markdown 内容（增强版）
  const renderMarkdown = (content: string) => {
    if (!content) return null

    const lines = content.split('\n')
    const elements: React.ReactElement[] = []
    let listItems: React.ReactElement[] = []
    let listType: 'ul' | 'ol' | null = null
    let codeBlock: string[] = []
    let inCodeBlock = false
    let codeLanguage = ''

    const flushList = () => {
      if (listItems.length > 0) {
        if (listType === 'ul') {
          elements.push(<ul key={`list-${elements.length}`} className="list-disc pl-6 my-3 space-y-1">{listItems}</ul>)
        } else {
          elements.push(<ol key={`list-${elements.length}`} className="list-decimal pl-6 my-3 space-y-1">{listItems}</ol>)
        }
        listItems = []
        listType = null
      }
    }

    const flushCodeBlock = () => {
      if (codeBlock.length > 0) {
        elements.push(
          <pre key={`code-${elements.length}`} className="bg-zinc-900 text-zinc-100 rounded-lg p-4 my-4 overflow-x-auto text-sm font-mono">
            <code>{codeBlock.join('\n')}</code>
          </pre>
        )
        codeBlock = []
        inCodeBlock = false
        codeLanguage = ''
      }
    }

    lines.forEach((line, index) => {
      // 代码块处理
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock()
        } else {
          flushList()
          inCodeBlock = true
          codeLanguage = line.slice(3).trim()
        }
        return
      }

      if (inCodeBlock) {
        codeBlock.push(line)
        return
      }

      const trimmedLine = line.trim()

      // 空行
      if (!trimmedLine) {
        flushList()
        return
      }

      // 标题
      if (trimmedLine.startsWith('# ')) {
        flushList()
        elements.push(<h1 key={index} className="text-3xl font-bold mt-8 mb-4 text-foreground border-b pb-2">{trimmedLine.slice(2)}</h1>)
        return
      }
      if (trimmedLine.startsWith('## ')) {
        flushList()
        elements.push(<h2 key={index} className="text-2xl font-bold mt-6 mb-3 text-foreground">{trimmedLine.slice(3)}</h2>)
        return
      }
      if (trimmedLine.startsWith('### ')) {
        flushList()
        elements.push(<h3 key={index} className="text-xl font-semibold mt-5 mb-2 text-foreground">{trimmedLine.slice(4)}</h3>)
        return
      }
      if (trimmedLine.startsWith('#### ')) {
        flushList()
        elements.push(<h4 key={index} className="text-lg font-medium mt-4 mb-2 text-foreground">{trimmedLine.slice(5)}</h4>)
        return
      }

      // 分隔线
      if (trimmedLine === '---' || trimmedLine === '***' || trimmedLine === '___') {
        flushList()
        elements.push(<hr key={index} className="my-6 border-border" />)
        return
      }

      // 引用块
      if (trimmedLine.startsWith('> ')) {
        flushList()
        elements.push(
          <blockquote key={index} className="border-l-4 border-primary/50 pl-4 my-4 italic text-muted-foreground bg-muted/30 py-2 pr-4 rounded-r">
            {trimmedLine.slice(2)}
          </blockquote>
        )
        return
      }

      // 无序列表
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        if (listType !== 'ul') {
          flushList()
          listType = 'ul'
        }
        listItems.push(<li key={index} className="text-foreground">{renderInlineMarkdown(trimmedLine.slice(2))}</li>)
        return
      }

      // 有序列表
      if (/^\d+\.\s/.test(trimmedLine)) {
        if (listType !== 'ol') {
          flushList()
          listType = 'ol'
        }
        listItems.push(<li key={index} className="text-foreground">{renderInlineMarkdown(trimmedLine.replace(/^\d+\.\s/, ''))}</li>)
        return
      }

      // 普通段落
      flushList()
      elements.push(<p key={index} className="text-foreground leading-relaxed my-3">{renderInlineMarkdown(trimmedLine)}</p>)
    })

    // 处理剩余的列表和代码块
    flushList()
    flushCodeBlock()

    return elements
  }

  // 渲染行内 Markdown（加粗、斜体、代码、链接）
  const renderInlineMarkdown = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = []
    let remaining = text
    let key = 0

    // 处理行内代码
    const codeRegex = /`([^`]+)`/g
    // 处理加粗
    const boldRegex = /\*\*([^*]+)\*\*/g
    // 处理斜体
    const italicRegex = /\*([^*]+)\*/g

    // 简单实现：按顺序替换
    remaining = remaining.replace(codeRegex, '⟨CODE⟩$1⟨/CODE⟩')
    remaining = remaining.replace(boldRegex, '⟨BOLD⟩$1⟨/BOLD⟩')
    remaining = remaining.replace(italicRegex, '⟨ITALIC⟩$1⟨/ITALIC⟩')

    // 分割并渲染
    const tokens = remaining.split(/(⟨CODE⟩.*?⟨\/CODE⟩|⟨BOLD⟩.*?⟨\/BOLD⟩|⟨ITALIC⟩.*?⟨\/ITALIC⟩)/g)

    tokens.forEach((token) => {
      if (token.startsWith('⟨CODE⟩')) {
        const content = token.replace('⟨CODE⟩', '').replace('⟨/CODE⟩', '')
        parts.push(<code key={key++} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary">{content}</code>)
      } else if (token.startsWith('⟨BOLD⟩')) {
        const content = token.replace('⟨BOLD⟩', '').replace('⟨/BOLD⟩', '')
        parts.push(<strong key={key++} className="font-semibold">{content}</strong>)
      } else if (token.startsWith('⟨ITALIC⟩')) {
        const content = token.replace('⟨ITALIC⟩', '').replace('⟨/ITALIC⟩', '')
        parts.push(<em key={key++} className="italic">{content}</em>)
      } else if (token) {
        parts.push(<span key={key++}>{token}</span>)
      }
    })

    return parts.length > 0 ? parts : text
  }

  // 渲染纯文本内容
  const renderPlainText = (content: string) => {
    if (!content) return null

    return (
      <pre className="whitespace-pre-wrap font-mono text-sm bg-muted/50 p-6 rounded-lg border overflow-x-auto">
        {content}
      </pre>
    )
  }

  // 获取文件类型图标和标签
  const getFileTypeInfo = (contentType: string, filePath: string) => {
    const fileType = getFileType(contentType, filePath)
    switch (fileType) {
      case 'pdf':
        return { icon: '📄', label: 'PDF 文档', color: 'text-red-600' }
      case 'markdown':
        return { icon: '📝', label: 'Markdown', color: 'text-blue-600' }
      case 'text':
        return { icon: '📃', label: '纯文本', color: 'text-gray-600' }
      default:
        return { icon: '📁', label: '文件', color: 'text-gray-600' }
    }
  }

  // 获取当前文件类型
  const fileType = document ? getFileType(document.contentType, document.filePath) : 'unknown'
  const fileTypeInfo = document ? getFileTypeInfo(document.contentType, document.filePath) : null

  return (
    <AdminLayout>
      <div className="flex gap-6 min-h-screen">
        {/* Main Content */}
        <main className="flex-1">
          <div className="max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
            {/* 返回按钮 */}
            <Link href="/admin/dashboard" className="inline-block">
              <Button variant="ghost" className="mb-6">
                <ChevronLeft className="mr-2 w-4 h-4" />
                返回文档管理
              </Button>
            </Link>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-20">
                <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
                <p className="mt-4 text-muted-foreground">加载中...</p>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-destructive" />
                    <div>
                      <p className="font-medium text-destructive">加载失败</p>
                      <p className="text-sm text-muted-foreground">{error}</p>
                    </div>
                  </div>
                  <Link href="/admin/dashboard" className="inline-block mt-4">
                    <Button variant="outline">返回文档管理</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Document Content */}
            {!loading && !error && document && (
              <article>
                {/* 标题区域 */}
                <div className="mb-8">
                  <div className="flex items-start gap-4 mb-4">
                    <span className="text-4xl">{fileTypeInfo?.icon}</span>
                    <div className="flex-1">
                      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        {document.title}
                      </h1>
                      <span className={`inline-block mt-2 text-sm font-medium ${fileTypeInfo?.color}`}>
                        {fileTypeInfo?.label}
                      </span>
                    </div>
                  </div>

                  {/* 元信息 */}
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-muted-foreground pb-6 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      <span>{document.category}</span>
                      {document.subcategory && (
                        <span className="text-muted-foreground/70">/ {document.subcategory}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(document.createdAt)}</span>
                    </div>
                    {document.chunkCount > 0 && (
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{document.chunkCount} 个文本块</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 状态提示 */}
                {document.status !== 'ready' && (
                  <Card className="mb-6 border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
                    <CardContent className="pt-4 pb-4">
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        ⚠️ 此文档尚未处理完成（状态: {document.status}），请先在文档管理页面处理此文档。
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* 视图切换按钮（仅对文本类文件显示） */}
                {(fileType === 'markdown' || fileType === 'text') && document.content && (
                  <div className="flex gap-2 mb-6">
                    <Button
                      variant={viewMode === 'original' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('original')}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      原始文件
                    </Button>
                    <Button
                      variant={viewMode === 'chunks' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('chunks')}
                    >
                      <FileCode className="w-4 h-4 mr-2" />
                      分块内容
                    </Button>
                  </div>
                )}

                {/* ===== PDF 文件展示 ===== */}
                {fileType === 'pdf' && document.sourceUrl && (
                  <div className="flex justify-center">
                    <div className="w-[110%] max-w-[1200px] rounded-lg border overflow-hidden bg-muted/30 shadow-lg">
                      {/* PDF 嵌入查看器 */}
                      <iframe
                        src={`${document.sourceUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                        className="w-full h-[880px] border-0"
                        title={document.title}
                      />
                      {/* 备用下载链接 */}
                      <div className="p-4 bg-muted/50 border-t flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          如果 PDF 无法正常显示，请点击右侧按钮下载查看
                        </p>
                        <a
                          href={document.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2"
                        >
                          <Button variant="outline" size="sm">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            在新窗口打开
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== Markdown 文件展示 ===== */}
                {fileType === 'markdown' && (
                  <div>
                    {viewMode === 'original' ? (
                      rawContentLoading ? (
                        <div className="text-center py-12">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                          <p className="mt-4 text-muted-foreground">加载原始内容...</p>
                        </div>
                      ) : rawContentError ? (
                        <Card className="border-destructive">
                          <CardContent className="pt-6">
                            <p className="text-destructive">❌ {rawContentError}</p>
                            <Button 
                              variant="outline" 
                              className="mt-4"
                              onClick={() => document.sourceUrl && fetchRawContent(document.sourceUrl)}
                            >
                              重试
                            </Button>
                          </CardContent>
                        </Card>
                      ) : rawContent ? (
                        <div className="prose prose-sm sm:prose lg:prose-lg max-w-none dark:prose-invert">
                          {renderMarkdown(rawContent)}
                        </div>
                      ) : (
                        <Card className="bg-muted/50">
                          <CardContent className="pt-6 text-center py-12">
                            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">正在获取文档内容...</p>
                          </CardContent>
                        </Card>
                      )
                    ) : (
                      document.content ? (
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground mb-4">
                            以下是文档分块后的内容，用于 AI 语义搜索。
                          </p>
                          <div className="prose prose-sm sm:prose max-w-none dark:prose-invert">
                            {renderMarkdown(document.content)}
                          </div>
                        </div>
                      ) : (
                        <Card className="bg-muted/50">
                          <CardContent className="pt-6 text-center py-12">
                            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">暂无分块内容</p>
                          </CardContent>
                        </Card>
                      )
                    )}
                  </div>
                )}

                {/* ===== 纯文本文件展示 ===== */}
                {fileType === 'text' && (
                  <div>
                    {viewMode === 'original' ? (
                      rawContentLoading ? (
                        <div className="text-center py-12">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                          <p className="mt-4 text-muted-foreground">加载原始内容...</p>
                        </div>
                      ) : rawContentError ? (
                        <Card className="border-destructive">
                          <CardContent className="pt-6">
                            <p className="text-destructive">❌ {rawContentError}</p>
                            <Button 
                              variant="outline" 
                              className="mt-4"
                              onClick={() => document.sourceUrl && fetchRawContent(document.sourceUrl)}
                            >
                              重试
                            </Button>
                          </CardContent>
                        </Card>
                      ) : rawContent ? (
                        renderPlainText(rawContent)
                      ) : (
                        <Card className="bg-muted/50">
                          <CardContent className="pt-6 text-center py-12">
                            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">正在获取文档内容...</p>
                          </CardContent>
                        </Card>
                      )
                    ) : (
                      document.content ? (
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground mb-4">
                            以下是文档分块后的内容，用于 AI 语义搜索。
                          </p>
                          {renderPlainText(document.content)}
                        </div>
                      ) : (
                        <Card className="bg-muted/50">
                          <CardContent className="pt-6 text-center py-12">
                            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">暂无分块内容</p>
                          </CardContent>
                        </Card>
                      )
                    )}
                  </div>
                )}

                {/* ===== 未知类型或无内容 ===== */}
                {fileType === 'unknown' && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6 text-center py-12">
                      <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">不支持预览此文件类型</p>
                      {document.sourceUrl && (
                        <a
                          href={document.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-4"
                        >
                          <Button>
                            <Download className="w-4 h-4 mr-2" />
                            下载文件
                          </Button>
                        </a>
                      )}
                    </CardContent>
                  </Card>
                )}
              </article>
            )}

            {/* Not Found */}
            {!loading && !error && !document && (
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">文档不存在</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    请求的文档可能已被删除或从未存在
                  </p>
                  <Link href="/admin/dashboard" className="inline-block mt-4">
                    <Button>返回文档管理</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </main>

        {/* Sidebar */}
        <aside className="hidden lg:block w-80 bg-secondary/30 p-6 border-l border-border overflow-y-auto sticky top-0 h-screen">
          {/* 文档信息卡片 */}
          {document && (
            <Card className="mb-6">
              <CardContent className="pt-4">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  文档信息
                </h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <dt className="text-muted-foreground">状态</dt>
                    <dd className="font-medium">
                      {document.status === 'ready' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">
                          ✅ 已就绪
                        </span>
                      )}
                      {document.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
                          ⏳ 待处理
                        </span>
                      )}
                      {document.status === 'processing' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs">
                          🔄 处理中
                        </span>
                      )}
                      {document.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">
                          ❌ 失败
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-muted-foreground">文件类型</dt>
                    <dd className="font-medium">{fileTypeInfo?.label || '未知'}</dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-muted-foreground">文本块</dt>
                    <dd className="font-medium">{document.chunkCount} 个</dd>
                  </div>
                  <div className="pt-2 border-t">
                    <dt className="text-muted-foreground mb-1">创建时间</dt>
                    <dd className="font-medium">{formatDate(document.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground mb-1">更新时间</dt>
                    <dd className="font-medium">{formatDate(document.updatedAt)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}

          {/* 快捷操作 */}
          {document?.sourceUrl && (
            <Card className="mb-6">
              <CardContent className="pt-4">
                <h3 className="text-sm font-semibold mb-4">快捷操作</h3>
                <div className="space-y-2">
                  <a
                    href={document.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Download className="w-4 h-4 mr-2" />
                      下载原文件
                    </Button>
                  </a>
                  <a
                    href={document.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      新窗口打开
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

        </aside>
      </div>
    </AdminLayout>
  )
}

