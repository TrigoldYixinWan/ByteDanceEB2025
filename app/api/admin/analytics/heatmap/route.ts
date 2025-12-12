/**
 * GET /api/admin/analytics/heatmap
 * 
 * 知识点引用热力图数据
 * 支持时间范围筛选
 * 
 * Query params:
 * - days: 时间范围（天数），默认全部
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

    // 获取时间范围参数
    const searchParams = request.nextUrl.searchParams
    const daysParam = searchParams.get('days')
    const days = daysParam ? parseInt(daysParam) : null  // null 表示全部时间

    let startDate: string | null = null
    if (days) {
      const date = new Date()
      date.setDate(date.getDate() - days)
      startDate = date.toISOString()
    }

    // 如果指定了时间范围，从 message_citations 表按时间统计
    if (startDate) {
      // 按时间范围统计引用
      const { data: citations, error: citationError } = await supabase
        .from('message_citations')
        .select(`
          chunk_id,
          created_at,
          document_chunks!inner (
            id,
            content,
            document_id,
            documents!inner (
              id,
              title,
              category
            )
          )
        `)
        .gte('created_at', startDate)

      if (citationError) {
        console.error('获取引用数据失败:', citationError)
        return NextResponse.json({ error: '获取数据失败' }, { status: 500 })
      }

      // 按文档聚合
      const docCounts: Record<string, { 
        id: string; title: string; category: string; count: number 
      }> = {}
      
      const chunkCounts: Record<string, {
        id: string; documentId: string; documentTitle: string; 
        category: string; content: string; count: number
      }> = {}

      (citations || []).forEach((c: any) => {
        const doc = c.document_chunks?.documents
        const chunk = c.document_chunks
        
        if (doc) {
          if (!docCounts[doc.id]) {
            docCounts[doc.id] = {
              id: doc.id,
              title: doc.title,
              category: doc.category,
              count: 0,
            }
          }
          docCounts[doc.id].count++
        }
        
        if (chunk) {
          if (!chunkCounts[chunk.id]) {
            chunkCounts[chunk.id] = {
              id: chunk.id,
              documentId: doc?.id || '',
              documentTitle: doc?.title || '未知文档',
              category: doc?.category || '未知类别',
              content: chunk.content || '',
              count: 0,
            }
          }
          chunkCounts[chunk.id].count++
        }
      })

      const documentHeatmap = Object.values(docCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
        .map(d => ({ ...d, citationCount: d.count }))

      const chunkHeatmap = Object.values(chunkCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 50)
        .map(c => ({
          id: c.id,
          documentId: c.documentId,
          documentTitle: c.documentTitle,
          category: c.category,
          contentPreview: c.content.slice(0, 100) + '...',
          citationCount: c.count,
        }))

      // 获取总文档数
      const { count: totalDocuments } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ready')

      const totalCitations = Object.values(docCounts).reduce((sum, d) => sum + d.count, 0)

      return NextResponse.json({
        period: {
          days,
          startDate,
          endDate: new Date().toISOString(),
        },
        summary: {
          totalDocuments: totalDocuments || 0,
          totalCitations,
          documentsWithCitations: documentHeatmap.length,
          coverageRate: totalDocuments 
            ? Math.round((documentHeatmap.length / totalDocuments) * 100) 
            : 0,
        },
        documentHeatmap,
        chunkHeatmap,
      })
    }

    // 无时间限制：使用累计的 citation_count（原有逻辑）
    const { data: documentStats, error: docError } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        category,
        document_chunks (
          citation_count
        )
      `)
      .eq('status', 'ready')

    if (docError) {
      console.error('获取文档统计失败:', docError)
      return NextResponse.json({ error: '获取数据失败' }, { status: 500 })
    }

    // 计算每个文档的总引用数
    const documentHeatmap = (documentStats || [])
      .map(doc => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        citationCount: (doc.document_chunks as any[] || []).reduce(
          (sum: number, chunk: any) => sum + (chunk.citation_count || 0), 
          0
        ),
      }))
      .filter(doc => doc.citationCount > 0)
      .sort((a, b) => b.citationCount - a.citationCount)
      .slice(0, 20)

    // 按片段粒度获取热点
    const { data: chunkStats, error: chunkError } = await supabase
      .from('document_chunks')
      .select(`
        id,
        content,
        citation_count,
        documents!inner (
          id,
          title,
          category
        )
      `)
      .gt('citation_count', 0)
      .order('citation_count', { ascending: false })
      .limit(50)

    if (chunkError) {
      console.error('获取片段统计失败:', chunkError)
    }

    const chunkHeatmap = (chunkStats || []).map((chunk: any) => ({
      id: chunk.id,
      documentId: chunk.documents?.id,
      documentTitle: chunk.documents?.title || '未知文档',
      category: chunk.documents?.category || '未知类别',
      contentPreview: chunk.content?.slice(0, 100) + '...',
      citationCount: chunk.citation_count,
    }))

    const totalDocuments = documentStats?.length || 0
    const totalCitations = documentHeatmap.reduce((sum, doc) => sum + doc.citationCount, 0)
    const documentsWithCitations = documentHeatmap.length

    return NextResponse.json({
      period: null,  // 全部时间
      summary: {
        totalDocuments,
        totalCitations,
        documentsWithCitations,
        coverageRate: totalDocuments > 0 
          ? Math.round((documentsWithCitations / totalDocuments) * 100) 
          : 0,
      },
      documentHeatmap,
      chunkHeatmap,
    })
  } catch (error) {
    console.error('Analytics heatmap error:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
