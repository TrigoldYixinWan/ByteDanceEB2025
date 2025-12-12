/**
 * 会话管理 API
 * 
 * GET /api/chat/sessions - 获取用户的会话列表
 * POST /api/chat/sessions - 创建新会话
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/chat/sessions
 * 获取当前用户的所有聊天会话
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // 验证用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 获取用户的所有会话，按更新时间倒序
    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select(`
        id,
        title,
        created_at,
        updated_at
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('获取会话列表失败:', error)
      return NextResponse.json(
        { error: '获取会话列表失败', details: error.message },
        { status: 500 }
      )
    }

    // 获取每个会话的最后一条消息预览
    const sessionsWithPreview = await Promise.all(
      (sessions || []).map(async (session) => {
        const { data: lastMessage } = await supabase
          .from('chat_messages')
          .select('content, role, created_at')
          .eq('session_id', session.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // 获取消息数量
        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id)

        return {
          id: session.id,
          title: session.title || '新对话',
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          lastMessage: lastMessage?.content?.slice(0, 50) + (lastMessage?.content?.length > 50 ? '...' : '') || null,
          messageCount: count || 0,
        }
      })
    )

    return NextResponse.json({
      sessions: sessionsWithPreview,
      total: sessionsWithPreview.length,
    })
  } catch (error) {
    console.error('会话列表 API 错误:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/chat/sessions
 * 创建新的聊天会话
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 验证用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 解析请求体（可选的标题）
    let title = '新对话'
    try {
      const body = await request.json()
      if (body.title) {
        title = body.title
      }
    } catch {
      // 没有请求体也可以
    }

    // 创建新会话
    const { data: session, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        title,
      })
      .select()
      .single()

    if (error) {
      console.error('创建会话失败:', error)
      return NextResponse.json(
        { error: '创建会话失败', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        messageCount: 0,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('创建会话 API 错误:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

