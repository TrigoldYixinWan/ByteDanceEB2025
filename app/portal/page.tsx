"use client";

import { useState } from "react"
import Link from "next/link"
import { MerchantLayout } from "@/components/merchant-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ChevronRight, Search, Clock, Tag } from "lucide-react"
import { MessageSquare } from "lucide-react"

const CATEGORIES = [
  { id: 1, name: "商品管理", icon: "📦", color: "bg-blue-50" },
  { id: 2, name: "实施细则", icon: "📋", color: "bg-purple-50" },
  { id: 3, name: "招商入驻", icon: "🏪", color: "bg-green-50" },
  { id: 4, name: "经营成长", icon: "📈", color: "bg-orange-50" },
  { id: 5, name: "规则解读", icon: "📖", color: "bg-pink-50" },
  { id: 6, name: "资金结算", icon: "💰", color: "bg-yellow-50" },
  { id: 7, name: "违规管理", icon: "⚠️", color: "bg-red-50" },
  { id: 8, name: "其他内容", icon: "📄", color: "bg-gray-50" },
]

// TEMPORARY MOCK DATA - TO BE REPLACED WITH API CALLS
interface DocumentPreview {
  id: string // UUID
  title: string
  category: string
  createdAt: string
}

const RECENT_DOCUMENTS: DocumentPreview[] = [
  { 
    id: "550e8400-e29b-41d4-a716-446655440001", 
    title: "商品上架操作指南", 
    category: "商品管理", 
    createdAt: "2024-01-15T10:00:00Z" 
  },
  { 
    id: "550e8400-e29b-41d4-a716-446655440002", 
    title: "资金结算流程说明", 
    category: "资金结算", 
    createdAt: "2024-01-12T10:00:00Z" 
  },
  { 
    id: "550e8400-e29b-41d4-a716-446655440003", 
    title: "入驻审核要求", 
    category: "招商入驻", 
    createdAt: "2024-01-10T10:00:00Z" 
  },
  { 
    id: "550e8400-e29b-41d4-a716-446655440004", 
    title: "平台规则详解", 
    category: "规则解读", 
    createdAt: "2024-01-08T10:00:00Z" 
  },
  { 
    id: "550e8400-e29b-41d4-a716-446655440005", 
    title: "违规处罚标准", 
    category: "违规管理", 
    createdAt: "2024-01-05T10:00:00Z" 
  },
]

export default function MerchantHomePage() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <MerchantLayout>
      <div className="flex flex-col min-h-screen">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h1 className="text-4xl font-bold tracking-tight mb-4">欢迎来到您的知识库</h1>
            <p className="text-lg text-muted-foreground mb-8">查找答案、探索资源并促进您的业务增长</p>

            {/* Search Bar */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="搜索知识库..."
                className="pl-10 py-6 text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
          {/* Categories Grid */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8">按类别浏览</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CATEGORIES.map((category) => (
                <Card key={category.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{category.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-base">{category.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">探索资源</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground mt-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Recent Updates */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">最近更新</h2>
            </div>

            <div className="space-y-3">
              {RECENT_DOCUMENTS.map((doc) => (
                <Link key={doc.id} href={`/portal/knowledge/${doc.id}`}>
                  <Card className="hover:bg-secondary/50 transition-colors cursor-pointer">
                    <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-base hover:text-primary">{doc.title}</h3>
                        <div className="flex items-center gap-3 mt-2">
                          <Tag className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{doc.category}</span>
                          <Clock className="w-4 h-4 text-muted-foreground ml-2" />
                          <span className="text-sm text-muted-foreground">
                            {new Date(doc.createdAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground mt-1 flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
                </Link>
              ))}
            </div>
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
