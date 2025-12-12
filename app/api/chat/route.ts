/**
 * POST /api/chat
 * 
 * RAG 聊天 API - 基于知识库的 AI 问答
 * 
 * 流程：
 * 1. 接收用户问题
 * 2. 语义搜索相关文档块
 * 3. 构建上下文 Prompt
 * 4. 调用 LLM 生成回答（流式输出）
 * 5. 返回带引用的回答
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { multiQuerySearch, deduplicateResults, type SearchResult } from '@/lib/ai/search'
import OpenAI from 'openai'

// 强制使用 Node.js Runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// 配置参数
const CONFIG = {
  model: 'gpt-4o-mini',           // LLM 模型
  maxContextTokens: 4000,          // 上下文最大 token
  searchLimitPerQuery: 5,          // 每个查询的结果数量
  searchThreshold: 0.25,           // 相似度阈值（Multi-Query 模式下可以更低）
  maxQueries: 4,                   // Multi-Query 最大查询数（包含原始查询，最多5）
  maxResponseTokens: 2000,         // 回答最大 token
  temperature: 0.7,                // 生成温度
}

/**
 * 构建系统提示词
 */
function buildSystemPrompt(context: string, sources: { title: string; category: string }[]): string {
  const sourceList = sources
    .map((s, i) => `[${i + 1}] ${s.title} (${s.category})`)
    .join('\n')

  return `你是商户知识库的 AI 助手，专门帮助商户解答平台相关问题。

## 你的职责
- 基于提供的知识库内容回答商户问题
- 回答要专业、简洁、易懂
- 即使参考资料不完全匹配，也要尽量从中提取有用信息

## 回答规则
1. **优先使用参考资料** - 从参考资料中提取相关信息回答问题
2. **标注信息来源** - 在相关内容后使用 [1] [2] 等标注引用
3. **灵活关联** - 如果参考资料包含相关但不完全匹配的内容，说明"根据相关规定..."并提供有用信息
4. **诚实告知局限** - 如果参考资料确实无法回答问题，告知用户并建议联系客服
5. **格式清晰** - 适当使用列表、分段，便于阅读

## 参考资料
${context}

## 来源列表
${sourceList}

请基于以上参考资料回答用户问题。即使资料不完全匹配，也请尽量提供有帮助的信息。`
}

/**
 * 构建上下文内容
 */
function buildContext(results: SearchResult[]): string {
  return results
    .map((r, i) => `【来源 ${i + 1}: ${r.documentTitle}】\n${r.content}`)
    .join('\n\n---\n\n')
}

/**
 * POST /api/chat
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // ============================================================
    // Step 1: 验证用户身份
    // ============================================================
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '未授权访问，请先登录' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // Step 2: 解析请求
    // ============================================================
    const body = await request.json()
    const { message, sessionId } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: '请提供有效的问题' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const userMessage = message.trim()
    console.log(`💬 收到用户问题: "${userMessage.slice(0, 50)}..."`)

    // ============================================================
    // Step 3: Multi-Query 语义搜索相关文档
    // ============================================================
    console.log('🔍 开始 Multi-Query 语义搜索...')
    let searchResults: SearchResult[] = []
    
    try {
      // 使用 Multi-Query 搜索（自动生成查询变体）
      searchResults = await multiQuerySearch(
        userMessage,
        CONFIG.searchLimitPerQuery,
        CONFIG.searchThreshold,
        CONFIG.maxQueries
      )
      
      // 去重并控制 token 预算
      searchResults = deduplicateResults(searchResults, CONFIG.maxContextTokens)
      
      console.log(`✅ Multi-Query 搜索完成，找到 ${searchResults.length} 个相关文档块`)
    } catch (searchError) {
      console.error('⚠️ 搜索失败，将使用无上下文回答:', searchError)
      // 继续执行，但没有上下文
    }

    // ============================================================
    // Step 4: 构建 Prompt
    // ============================================================
    const context = buildContext(searchResults)
    const sources = searchResults.map(r => ({
      title: r.documentTitle,
      category: r.documentCategory,
    }))
    const systemPrompt = buildSystemPrompt(context, sources)

    // 如果没有找到相关内容，调整提示
    const noContextPrompt = `你是商户知识库的 AI 助手。

用户问了一个问题，但知识库中没有找到相关内容。

请礼貌地告知用户：
1. 知识库中暂无该问题的相关信息
2. 建议用户联系客服或查看帮助中心
3. 可以尝试用其他关键词重新提问

不要编造答案，不要提供可能不准确的信息。`

    const finalSystemPrompt = searchResults.length > 0 ? systemPrompt : noContextPrompt

    // ============================================================
    // Step 5: 创建或获取会话（预先创建，确保 sessionId 能返回给前端）
    // ============================================================
    let currentSessionId = sessionId
    
    if (!currentSessionId) {
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          title: userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : ''),
        })
        .select('id')
        .single()
      
      if (sessionError) {
        console.error('创建会话失败:', sessionError)
        // 不阻断流程，继续回答但不保存
      } else {
        currentSessionId = session.id
        console.log(`📝 创建新会话: ${currentSessionId}`)
      }
    }

    // ============================================================
    // Step 6: 获取历史消息（用于多轮对话上下文）
    // ============================================================
    let historyMessages: { role: 'user' | 'assistant'; content: string }[] = []
    
    if (currentSessionId) {
      const { data: history, error: historyError } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', currentSessionId)
        .order('created_at', { ascending: true })
        .limit(6)  // 最近 6 条消息（3 轮对话）
      
      if (!historyError && history) {
        historyMessages = history.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }))
        console.log(`📜 加载 ${historyMessages.length} 条历史消息`)
      }
    }

    // ============================================================
    // Step 7: 调用 LLM（流式输出，包含历史上下文）
    // ============================================================
    console.log('🤖 调用 LLM 生成回答...')
    
    const stream = await openai.chat.completions.create({
      model: CONFIG.model,
      messages: [
        { role: 'system', content: finalSystemPrompt },
        ...historyMessages,  // 历史对话上下文
        { role: 'user', content: userMessage },
      ],
      max_tokens: CONFIG.maxResponseTokens,
      temperature: CONFIG.temperature,
      stream: true,
    })

    // ============================================================
    // Step 8: 创建流式响应
    // ============================================================
    const encoder = new TextEncoder()
    
    // 准备引用信息
    const citations = searchResults.map((r, i) => ({
      id: r.chunkId,
      index: i + 1,
      documentId: r.documentId,
      title: r.documentTitle,
      category: r.documentCategory,
      excerpt: r.content.slice(0, 100) + (r.content.length > 100 ? '...' : ''),
      similarity: r.similarity,
    }))

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // 先发送引用信息
          const citationsEvent = `data: ${JSON.stringify({ 
            type: 'citations', 
            citations 
          })}\n\n`
          controller.enqueue(encoder.encode(citationsEvent))

          // 流式发送回答内容
          let fullContent = ''
          
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              fullContent += content
              const contentEvent = `data: ${JSON.stringify({ 
                type: 'content', 
                content 
              })}\n\n`
              controller.enqueue(encoder.encode(contentEvent))
            }
          }

          // 发送完成信号（返回正确的 sessionId，包括新创建的）
          const doneEvent = `data: ${JSON.stringify({ 
            type: 'done',
            fullContent,
            sessionId: currentSessionId || null,
          })}\n\n`
          controller.enqueue(encoder.encode(doneEvent))
          
          console.log(`✅ 回答生成完成，共 ${fullContent.length} 字符`)
          
          // 异步保存消息（不阻塞响应）
          // isZeroHit: 如果没有找到任何相关内容，标记为零命中
          const isZeroHit = searchResults.length === 0
          if (currentSessionId) {
            saveMessages(supabase, currentSessionId, userMessage, fullContent, citations, isZeroHit)
              .catch(err => console.error('⚠️ 消息保存失败:', err))
          }

          controller.close()
        } catch (error) {
          console.error('❌ 流式输出错误:', error)
          const errorEvent = `data: ${JSON.stringify({ 
            type: 'error', 
            error: '生成回答时发生错误' 
          })}\n\n`
          controller.enqueue(encoder.encode(errorEvent))
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('❌ Chat API 错误:', error)
    return new Response(
      JSON.stringify({ 
        error: '服务器内部错误',
        details: error instanceof Error ? error.message : '未知错误'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * 保存聊天消息到数据库（会话已预先创建）
 */
async function saveMessages(
  supabase: any,
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  citations: any[],
  isZeroHit: boolean = false
) {
  try {
    // 保存用户消息（包含零命中标记）
    const { error: userMsgError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: userMessage,
        is_zero_hit: isZeroHit,  // 零命中标记
      })
    
    if (userMsgError) {
      console.error('保存用户消息失败:', userMsgError)
    }

    // 保存助手消息
    const { data: assistantMsg, error: assistantMsgError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: assistantMessage,
      })
      .select('id')
      .single()
    
    if (assistantMsgError) {
      console.error('保存助手消息失败:', assistantMsgError)
      return
    }

    // 保存引用关系（会自动触发 citation_count 更新）
    if (citations.length > 0 && assistantMsg?.id) {
      const citationRecords = citations.map(c => ({
        message_id: assistantMsg.id,
        chunk_id: c.id,
      }))
      
      const { error: citationError } = await supabase
        .from('message_citations')
        .insert(citationRecords)
      
      if (citationError) {
        console.error('保存引用失败:', citationError)
      }
    }

    // 更新会话的 updated_at（触发排序更新）
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId)

    console.log('✅ 消息保存成功')
  } catch (error) {
    console.error('保存消息时发生错误:', error)
  }
}

