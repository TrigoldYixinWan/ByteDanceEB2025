"use client";

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { MerchantLayout } from "@/components/merchant-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Paperclip, Send, ChevronDown, ChevronUp, ChevronLeft } from "lucide-react"
import type { MessageSource } from "@/types"

// Frontend Message interface (extends ChatMessage from types)
interface Message {
  id: string // UUID
  role: "user" | "assistant" // Changed from type: "user" | "bot"
  content: string
  sources?: MessageSource[]
  sourcesExpanded?: boolean // UI state only
  createdAt?: string
}

// TEMPORARY MOCK DATA - TO BE REPLACED WITH API CALLS
const MOCK_SOURCES: MessageSource[] = [
  { 
    id: "550e8400-e29b-41d4-a716-446655440002", 
    title: "资金结算流程说明", 
    category: "资金结算" 
  },
  { 
    id: "550e8400-e29b-41d4-a716-446655440004", 
    title: "平台规则详解", 
    category: "规则解读" 
  },
]

export default function MerchantChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "550e8400-e29b-41d4-a716-446655440000", // UUID
      role: "assistant", // Changed from type: "bot"
      content: "您好！我是您的 AI 助手。我可以帮助您查找有关商户账户、产品、支付等的信息。您想了解什么？",
      createdAt: new Date().toISOString(),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: crypto.randomUUID(), // Generate proper UUID
      role: "user", // Changed from type: "user"
      content: inputValue,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)

    // TODO: Replace with actual API call to POST /api/chat/messages
    // Simulate bot response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(), // Generate proper UUID
        role: "assistant", // Changed from type: "bot"
        content:
          "根据您的问题，我找到了相关信息。这些信息来自我们的知识库文章。您可以点击下面的任何来源来阅读完整文档。",
        sources: MOCK_SOURCES,
        sourcesExpanded: false,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000)
  }

  const toggleSources = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, sourcesExpanded: !msg.sourcesExpanded } : msg)),
    )
  }

  return (
    <MerchantLayout>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border p-4 sm:p-6">
          <Link href="/portal">
            <Button variant="ghost" size="sm" className="mb-2">
              <ChevronLeft className="mr-2 w-4 h-4" />
              返回知识库
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">AI 聊天助手</h1>
          <p className="text-sm text-muted-foreground mt-1">提出问题并从您的知识库获取答案</p>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((message) => (
            <div key={message.id}>
              {message.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-md bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-5 py-3">
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-start">
                  <div className="max-w-2xl">
                    <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-5 py-4">
                      <p className="text-sm leading-relaxed text-foreground">{message.content}</p>

                      {/* Sources Section */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <button
                            onClick={() => toggleSources(message.id)}
                            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                          >
                            {message.sourcesExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                            {message.sources.length} 个来源
                          </button>

                          {message.sourcesExpanded && (
                            <div className="mt-3 space-y-2">
                              {message.sources.map((source) => (
                                <Link key={source.id} href={`/portal/knowledge/${source.id}`}>
                                  <Card className="p-3 cursor-pointer hover:bg-secondary/50 transition-colors border-primary/20">
                                    <p className="text-sm font-medium text-foreground">{source.title}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{source.category}</p>
                                  </Card>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-5 py-4">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4 sm:p-6 bg-card">
          <div className="max-w-4xl mx-auto flex gap-2">
            <Button variant="outline" size="icon">
              <Paperclip className="w-5 h-5" />
            </Button>
            <Input
              placeholder="输入您的问题..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isLoading}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
