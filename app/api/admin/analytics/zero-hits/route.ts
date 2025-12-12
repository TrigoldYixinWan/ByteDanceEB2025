/**
 * GET /api/admin/analytics/zero-hits
 * 
 * 零命中问题列表
 * 返回用户咨询但知识库中没有相关内容的问题
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 验证用户身份和权限
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 检查是否为 admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    // 获取分页参数
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // 获取零命中问题列表
    const { data: zeroHits, error: queryError, count } = await supabase
      .from('chat_messages')
      .select(`
        id,
        content,
        created_at,
        chat_sessions!inner (
          user_id,
          profiles:user_id (
            full_name
          )
        )
      `, { count: 'exact' })
      .eq('role', 'user')
      .eq('is_zero_hit', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (queryError) {
      console.error('获取零命中问题失败:', queryError)
      return NextResponse.json({ error: '获取数据失败' }, { status: 500 })
    }

    const questions = (zeroHits || []).map((item: any) => ({
      id: item.id,
      question: item.content,
      createdAt: item.created_at,
      userName: item.chat_sessions?.profiles?.full_name || '匿名用户',
    }))

    // 统计信息
    const { count: totalZeroHits } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user')
      .eq('is_zero_hit', true)

    const { count: totalQuestions } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user')

    return NextResponse.json({
      summary: {
        totalZeroHits: totalZeroHits || 0,
        totalQuestions: totalQuestions || 0,
        zeroHitRate: totalQuestions 
          ? Math.round(((totalZeroHits || 0) / totalQuestions) * 100) 
          : 0,
      },
      questions,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Analytics zero-hits error:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}

