/**
 * GET /api/admin/analytics/trends
 * 
 * 时间趋势数据 API
 * 返回指定时间范围内的问答量、会话数、零命中等趋势
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

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')
    
    // 计算起始日期
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    // 1. 每日问答量（用户消息数）
    const { data: messageData, error: msgError } = await supabase
      .from('chat_messages')
      .select('created_at')
      .eq('role', 'user')
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: true })

    if (msgError) {
      console.error('获取消息数据失败:', msgError)
    }

    // 2. 每日新会话数
    const { data: sessionData, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('created_at')
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: true })

    if (sessionError) {
      console.error('获取会话数据失败:', sessionError)
    }

    // 3. 每日零命中数
    const { data: zeroHitData, error: zeroHitError } = await supabase
      .from('chat_messages')
      .select('created_at')
      .eq('role', 'user')
      .eq('is_zero_hit', true)
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: true })

    if (zeroHitError) {
      console.error('获取零命中数据失败:', zeroHitError)
    }

    // 聚合数据按日期
    const aggregateByDate = (data: any[] | null) => {
      const counts: Record<string, number> = {}
      
      // 初始化所有日期为 0
      for (let i = 0; i < days; i++) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        counts[dateStr] = 0
      }
      
      // 统计实际数据
      if (data) {
        data.forEach(item => {
          const dateStr = new Date(item.created_at).toISOString().split('T')[0]
          if (counts[dateStr] !== undefined) {
            counts[dateStr]++
          }
        })
      }
      
      // 转换为数组并排序
      return Object.entries(counts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }

    const dailyMessages = aggregateByDate(messageData)
    const dailySessions = aggregateByDate(sessionData)
    const dailyZeroHits = aggregateByDate(zeroHitData)

    // 计算汇总
    const totalMessages = dailyMessages.reduce((sum, d) => sum + d.count, 0)
    const totalSessions = dailySessions.reduce((sum, d) => sum + d.count, 0)
    const totalZeroHits = dailyZeroHits.reduce((sum, d) => sum + d.count, 0)

    return NextResponse.json({
      period: {
        days,
        startDate: startDateStr,
        endDate: new Date().toISOString(),
      },
      summary: {
        totalMessages,
        totalSessions,
        totalZeroHits,
        avgDailyMessages: Math.round(totalMessages / days * 10) / 10,
        avgDailySessions: Math.round(totalSessions / days * 10) / 10,
      },
      trends: {
        dailyMessages,
        dailySessions,
        dailyZeroHits,
      },
    })
  } catch (error) {
    console.error('Analytics trends error:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}

