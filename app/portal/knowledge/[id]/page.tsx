"use client";

import Link from "next/link"
import { MerchantLayout } from "@/components/merchant-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChevronLeft, Calendar, Tag, MessageSquare } from "lucide-react"

interface DocumentDetailPageProps {
  params: {
    id: string
  }
}

const DOCUMENT_DATA: Record<string, any> = {
  "setup-account": {
    title: "商品上架操作指南",
    category: "商品管理",
    date: "2024年1月15日",
    content: `
      <h2 class="text-2xl font-bold mb-4">商品管理</h2>
      <p class="mb-4 text-foreground">商品上架是开展业务的第一步。按照以下步骤快速完成商品上架。</p>
      
      <h3 class="text-xl font-semibold mt-6 mb-3">步骤 1：创建您的账户</h3>
      <p class="mb-4 text-foreground">访问我们的注册页面并填写您的业务信息。您需要：</p>
      <ul class="list-disc list-inside mb-4 text-foreground">
        <li>企业名称和注册号</li>
        <li>联系信息</li>
        <li>用于付款的银行账户详情</li>
        <li>税务识别号</li>
      </ul>

      <h3 class="text-xl font-semibold mt-6 mb-3">步骤 2：验证您的信息</h3>
      <p class="mb-4 text-foreground">我们会向您发送验证电子邮件。点击链接以确认您的电子邮件地址并激活您的账户。</p>

      <h3 class="text-xl font-semibold mt-6 mb-3">步骤 3：完成您的资料</h3>
      <p class="mb-4 text-foreground">添加其他业务详情，包括您的业务类别和预期的月交易量。这有助于我们提供更好的支持。</p>

      <h3 class="text-xl font-semibold mt-6 mb-3">步骤 4：开始处理</h3>
      <p class="mb-4 text-foreground">经过批准后，您可以立即开始处理交易。您的资金将根据您配置的付款计划存入您的银行账户。</p>
    `,
    relatedDocs: [
      { title: "了解您的仪表板", slug: "dashboard" },
      { title: "支付处理指南", slug: "payment-guide" },
    ],
  },
  "payment-guide": {
    title: "资金结算流程说明",
    category: "资金结算",
    date: "2024年1月12日",
    content: `
      <h2 class="text-2xl font-bold mb-4">处理支付</h2>
      <p class="mb-4 text-foreground">了解如何通过我们的平台安全高效地处理支付。</p>
      
      <h3 class="text-xl font-semibold mt-6 mb-3">支付方式</h3>
      <p class="mb-4 text-foreground">我们支持多种支付方式，包括信用卡、借记卡和数字钱包。</p>

      <h3 class="text-xl font-semibold mt-6 mb-3">处理费用</h3>
      <p class="mb-4 text-foreground">标准交易费用根据您的支付方式而定。有关更多信息，请查看您的账户设置。</p>
    `,
    relatedDocs: [
      { title: "退款和争议处理", slug: "refunds" },
      { title: "如何设置您的商户账户", slug: "setup-account" },
    ],
  },
}

export default function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const doc = DOCUMENT_DATA[params.id] || {
    title: "未找到文档",
    category: "错误",
    date: "N/A",
    content: "<p>找不到请求的文档。</p>",
    relatedDocs: [],
  }

  return (
    <MerchantLayout>
      <div className="flex gap-6 min-h-screen">
        {/* Main Content */}
        <main className="flex-1">
          <div className="max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
            <Link href="/portal" className="inline-block">
              <Button variant="ghost" className="mb-6">
                <ChevronLeft className="mr-2 w-4 h-4" />
                返回知识库
              </Button>
            </Link>

            <article>
              <h1 className="text-4xl font-bold tracking-tight mb-4">{doc.title}</h1>
              <div className="flex items-center gap-6 text-sm text-muted-foreground mb-8 pb-6 border-b border-border">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  {doc.category}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {doc.date}
                </div>
              </div>

              <div
                className="prose prose-sm max-w-none prose-headings:font-bold prose-a:text-primary"
                dangerouslySetInnerHTML={{ __html: doc.content }}
              />
            </article>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="hidden lg:block w-64 bg-secondary/30 p-6 border-l border-border overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">相关文档</h3>
          <div className="space-y-3">
            {doc.relatedDocs?.map((relDoc: any) => (
              <Link key={relDoc.slug} href={`/portal/knowledge/${relDoc.slug}`}>
                <Card className="hover:bg-secondary/50 transition-colors cursor-pointer p-4">
                  <p className="text-sm font-medium text-primary hover:underline">{relDoc.title}</p>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <Link href="/portal/chat">
              <Button className="w-full">
                <MessageSquare className="mr-2 w-4 h-4" />
                提问 AI
              </Button>
            </Link>
          </div>
        </aside>
      </div>
    </MerchantLayout>
  )
}
