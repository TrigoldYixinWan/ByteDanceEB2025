"use client";

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MerchantLayout } from "@/components/merchant-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Send, ChevronDown, ChevronUp, ChevronLeft, Loader2, AlertCircle, 
  BookOpen, Plus, MessageSquare, Trash2, MoreHorizontal, PanelLeftClose, PanelLeft
} from "lucide-react"

// 会话接口
interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lastMessage?: string
  messageCount: number
}

// 引用来源接口
interface Citation {
  id: string
  index: number
  documentId: string
  title: string
  category: string
  excerpt?: string
  similarity?: number
}

// 消息接口
interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
  citationsExpanded?: boolean
  isStreaming?: boolean
  error?: string
  createdAt?: string
}

// 欢迎消息
const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: "assistant",
  content: "您好！我是商户知识库 AI 助手。我可以帮助您查找平台规则、政策解读、操作指南等信息。请问有什么可以帮您？",
  createdAt: new Date().toISOString(),
}

export default function MerchantChatPage() {
  // 会话状态
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // 消息状态
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    try {
      setSessionsLoading(true)
      const response = await fetch('/api/chat/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      }
    } catch (error) {
      console.error('加载会话列表失败:', error)
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  // 加载会话消息
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/chat/sessions/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        const loadedMessages = data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          citations: msg.citations || [],
          createdAt: msg.createdAt,
        }))
        setMessages(loadedMessages.length > 0 ? loadedMessages : [WELCOME_MESSAGE])
        setCurrentSessionId(sessionId)
      }
    } catch (error) {
      console.error('加载会话消息失败:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    loadSessions()
    
    // 检查 localStorage 中是否有上次的会话
    const lastSessionId = localStorage.getItem('chat-last-session-id')
    if (lastSessionId) {
      loadSessionMessages(lastSessionId)
    }
  }, [loadSessions, loadSessionMessages])

  // 保存当前会话 ID 到 localStorage
  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('chat-last-session-id', currentSessionId)
    }
  }, [currentSessionId])

  // 新建对话
  const handleNewChat = () => {
    setCurrentSessionId(null)
    setMessages([WELCOME_MESSAGE])
    localStorage.removeItem('chat-last-session-id')
  }

  // 切换会话
  const handleSelectSession = (session: ChatSession) => {
    if (session.id === currentSessionId) return
    loadSessionMessages(session.id)
  }

  // 删除会话
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm('确定要删除这个对话吗？')) return

    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        
        // 如果删除的是当前会话，清空消息
        if (sessionId === currentSessionId) {
          handleNewChat()
        }
      }
    } catch (error) {
      console.error('删除会话失败:', error)
    }
  }

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: inputValue.trim(),
      createdAt: new Date().toISOString(),
    }

    const assistantMessageId = crypto.randomUUID()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      isStreaming: true,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setInputValue("")
    setIsLoading(true)

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: currentSessionId,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '请求失败')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      const decoder = new TextDecoder()
      let citations: Citation[] = []
      let newSessionId: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'citations') {
                citations = data.citations || []
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId ? { ...msg, citations } : msg
                  )
                )
              } else if (data.type === 'content') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: msg.content + data.content }
                      : msg
                  )
                )
              } else if (data.type === 'done') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, isStreaming: false }
                      : msg
                  )
                )
                if (data.sessionId) {
                  newSessionId = data.sessionId
                  setCurrentSessionId(data.sessionId)
                }
              } else if (data.type === 'error') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, isStreaming: false, error: data.error }
                      : msg
                  )
                )
              }
            } catch (e) {
              console.error('解析 SSE 数据失败:', e)
            }
          }
        }
      }

      // 刷新会话列表
      if (newSessionId || currentSessionId) {
        loadSessions()
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('请求已取消')
        return
      }

      console.error('发送消息失败:', error)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                isStreaming: false,
                content: '',
                error: error instanceof Error ? error.message : '发送消息失败，请重试',
              }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  // 切换引用展开状态
  const toggleCitations = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, citationsExpanded: !msg.citationsExpanded }
          : msg
      )
    )
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <MerchantLayout>
      <div className="flex h-screen bg-background">
        {/* 会话侧边栏 */}
        <div className={`
          ${sidebarOpen ? 'w-72' : 'w-0'} 
          transition-all duration-300 border-r border-border bg-card flex flex-col overflow-hidden
        `}>
          {/* 侧边栏头部 */}
          <div className="p-4 border-b border-border">
            <Button 
              onClick={handleNewChat} 
              className="w-full justify-start gap-2"
              variant="outline"
            >
              <Plus className="w-4 h-4" />
              新建对话
            </Button>
          </div>

          {/* 会话列表 */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>暂无历史对话</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => handleSelectSession(session)}
                      className={`
                        group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors
                        ${session.id === currentSessionId 
                          ? 'bg-primary/10 text-primary' 
                          : 'hover:bg-muted'
                        }
                      `}
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {session.title || '新对话'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(session.updatedAt)} · {session.messageCount} 条消息
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDeleteSession(session.id, e)}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* 侧边栏底部 */}
          <div className="p-4 border-t border-border">
            <Link href="/portal">
              <Button variant="ghost" size="sm" className="w-full justify-start">
                <ChevronLeft className="mr-2 w-4 h-4" />
                返回知识库
              </Button>
            </Link>
          </div>
        </div>

        {/* 主聊天区域 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="border-b border-border p-4 bg-card flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex-shrink-0"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeft className="w-5 h-5" />
              )}
            </Button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold truncate">
                  {currentSessionId 
                    ? sessions.find(s => s.id === currentSessionId)?.title || 'AI 知识助手'
                    : 'AI 知识助手'
                  }
                </h1>
                <p className="text-sm text-muted-foreground">基于知识库的智能问答</p>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-md bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-5 py-3">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="max-w-2xl w-full">
                      <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-5 py-4">
                        {message.error ? (
                          <div className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="w-4 h-4" />
                            <p className="text-sm">{message.error}</p>
                          </div>
                        ) : (
                          <>
                            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:my-2 prose-blockquote:my-2">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  code: ({ className, children, ...props }: any) => {
                                    const isInline = !className
                                    return isInline ? (
                                      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary" {...props}>
                                        {children}
                                      </code>
                                    ) : (
                                      <code className={className} {...props}>{children}</code>
                                    )
                                  },
                                  a: ({ children, href, ...props }: any) => (
                                    <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
                                      {children}
                                    </a>
                                  ),
                                  table: ({ children, ...props }: any) => (
                                    <div className="overflow-x-auto my-3">
                                      <table className="min-w-full border-collapse border border-border" {...props}>{children}</table>
                                    </div>
                                  ),
                                  th: ({ children, ...props }: any) => (
                                    <th className="border border-border bg-muted px-3 py-2 text-left font-semibold" {...props}>{children}</th>
                                  ),
                                  td: ({ children, ...props }: any) => (
                                    <td className="border border-border px-3 py-2" {...props}>{children}</td>
                                  ),
                                  pre: ({ children, ...props }: any) => (
                                    <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-4 overflow-x-auto text-sm" {...props}>{children}</pre>
                                  ),
                                  blockquote: ({ children, ...props }: any) => (
                                    <blockquote className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground bg-muted/30 py-2 pr-4 rounded-r" {...props}>
                                      {children}
                                    </blockquote>
                                  ),
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                              {message.isStreaming && (
                                <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-1" />
                              )}
                            </div>

                            {message.citations && message.citations.length > 0 && !message.isStreaming && (
                              <div className="mt-4 pt-4 border-t border-border">
                                <button
                                  onClick={() => toggleCitations(message.id)}
                                  className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                                >
                                  {message.citationsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  {message.citations.length} 个参考来源
                                </button>

                                {message.citationsExpanded && (
                                  <div className="mt-3 space-y-2">
                                    {message.citations.map((citation) => (
                                      <Link
                                        key={citation.id}
                                        href={`/portal/knowledge/${citation.documentId}`}
                                        className="block group relative"
                                      >
                                        <Card className="p-3 cursor-pointer hover:bg-secondary/50 transition-colors border-primary/20 hover:border-primary/40">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                                [{citation.index}] {citation.title}
                                              </p>
                                              <p className="text-xs text-muted-foreground mt-1">{citation.category}</p>
                                              {citation.excerpt && (
                                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{citation.excerpt}</p>
                                              )}
                                            </div>
                                            {citation.similarity && (
                                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                相似度 {Math.round(citation.similarity * 100)}%
                                              </span>
                                            )}
                                          </div>
                                        </Card>
                                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                                          点击查看对应文档
                                          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                                        </span>
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.content === '' && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-5 py-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">正在思考...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border p-4 sm:p-6 bg-card">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-2">
                <Input
                  placeholder="输入您的问题..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isLoading}>
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                AI 助手基于知识库内容回答，回答仅供参考
              </p>
            </div>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
