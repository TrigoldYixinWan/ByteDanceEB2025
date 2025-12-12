/**
 * 单个会话 API
 * 
 * GET /api/chat/sessions/[id] - 获取会话详情和消息
 * DELETE /api/chat/sessions/[id] - 删除会话
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/chat/sessions/[id]
 * 获取会话详情和所有消息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // 验证用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 获取会话信息
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)  // 确保是用户自己的会话
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    // 获取会话的所有消息
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('获取消息失败:', messagesError)
      return NextResponse.json(
        { error: '获取消息失败', details: messagesError.message },
        { status: 500 }
      )
    }

    // 获取每条助手消息的引用
    const messagesWithCitations = await Promise.all(
      (messages || []).map(async (msg) => {
        if (msg.role !== 'assistant') {
          return {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.created_at,
            citations: [],
          }
        }

        // 获取该消息的引用
        const { data: citations } = await supabase
          .from('message_citations')
          .select(`
            id,
            chunk_id,
            document_chunks!inner (
              id,
              document_id,
              content,
              documents!inner (
                title,
                category
              )
            )
          `)
          .eq('message_id', msg.id)

        const formattedCitations = (citations || []).map((c: any, index: number) => ({
          id: c.chunk_id,
          index: index + 1,
          documentId: c.document_chunks?.document_id,
          title: c.document_chunks?.documents?.title || '未知文档',
          category: c.document_chunks?.documents?.category || '未知类别',
          excerpt: c.document_chunks?.content?.slice(0, 100) + '...',
        }))

        return {
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.created_at,
          citations: formattedCitations,
        }
      })
    )

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
      messages: messagesWithCitations,
    })
  } catch (error) {
    console.error('获取会话详情错误:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/chat/sessions/[id]
 * 删除会话及其所有消息
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // 验证用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 验证会话属于当前用户
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    // 删除会话（级联删除消息和引用）
    const { error: deleteError } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('删除会话失败:', deleteError)
      return NextResponse.json(
        { error: '删除会话失败', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: '会话已删除',
      id,
    })
  } catch (error) {
    console.error('删除会话错误:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/chat/sessions/[id]
 * 更新会话标题
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // 验证用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 解析请求体
    const body = await request.json()
    const { title } = body

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: '请提供有效的标题' }, { status: 400 })
    }

    // 更新会话标题
    const { data: session, error: updateError } = await supabase
      .from('chat_sessions')
      .update({ title: title.slice(0, 100) })  // 限制长度
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError || !session) {
      return NextResponse.json({ error: '更新失败' }, { status: 500 })
    }

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        updatedAt: session.updated_at,
      },
    })
  } catch (error) {
    console.error('更新会话错误:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

