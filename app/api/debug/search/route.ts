/**
 * GET /api/debug/search?q=查询内容
 * 
 * 搜索诊断 API - 用于调试搜索结果
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/ai/embedding'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  
  if (!query) {
    return NextResponse.json({ error: '请提供查询参数 ?q=xxx' }, { status: 400 })
  }

  const supabase = await createClient()
  const diagnostics: any = {
    query,
    timestamp: new Date().toISOString(),
  }

  try {
    // 1. 检查文档状态
    const { data: docStats } = await supabase
      .from('documents')
      .select('status')
    
    const statusCounts: Record<string, number> = {}
    docStats?.forEach((d: any) => {
      statusCounts[d.status] = (statusCounts[d.status] || 0) + 1
    })
    diagnostics.documentStats = statusCounts

    // 2. 检查 chunks 状态
    const { data: chunkStats, count: totalChunks } = await supabase
      .from('document_chunks')
      .select('id, embedding', { count: 'exact' })
    
    const chunksWithEmbedding = chunkStats?.filter((c: any) => c.embedding !== null).length || 0
    diagnostics.chunkStats = {
      total: totalChunks,
      withEmbedding: chunksWithEmbedding,
      withoutEmbedding: (totalChunks || 0) - chunksWithEmbedding,
    }

    // 3. 生成查询向量
    console.log('生成查询向量...')
    const queryEmbedding = await generateEmbedding(query)
    diagnostics.queryEmbeddingDimension = queryEmbedding.length

    // 4. 使用不同阈值测试搜索
    const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
    diagnostics.searchResults = {}

    for (const threshold of thresholds) {
      const { data: results, error } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: 20,
      })

      if (error) {
        diagnostics.searchResults[`threshold_${threshold}`] = { error: error.message }
      } else {
        diagnostics.searchResults[`threshold_${threshold}`] = {
          count: results?.length || 0,
          results: results?.slice(0, 5).map((r: any) => ({
            title: r.document_title,
            category: r.document_category,
            similarity: r.similarity?.toFixed(4),
            contentPreview: r.content?.slice(0, 100) + '...',
          })),
        }
      }
    }

    // 5. 获取所有结果（无阈值）看看最高相似度是多少
    const { data: allResults } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.0,  // 无阈值
      match_count: 10,
    })

    if (allResults && allResults.length > 0) {
      diagnostics.topResults = allResults.map((r: any) => ({
        title: r.document_title,
        category: r.document_category,
        similarity: r.similarity?.toFixed(4),
        contentPreview: r.content?.slice(0, 150) + '...',
      }))
      diagnostics.maxSimilarity = allResults[0]?.similarity?.toFixed(4)
      diagnostics.minSimilarity = allResults[allResults.length - 1]?.similarity?.toFixed(4)
    }

    // 6. 建议
    const maxSim = allResults?.[0]?.similarity || 0
    diagnostics.recommendations = []
    
    if (maxSim < 0.5) {
      diagnostics.recommendations.push('⚠️ 最高相似度很低，可能是：1) 文档内容与查询不相关 2) 需要添加更多相关文档')
    }
    if (maxSim >= 0.5 && maxSim < 0.7) {
      diagnostics.recommendations.push('💡 建议将阈值降低到 0.5 以获得更多结果')
    }
    if (chunksWithEmbedding === 0) {
      diagnostics.recommendations.push('❌ 没有带 embedding 的文档块！需要重新处理文档')
    }
    if (statusCounts['ready'] === 0) {
      diagnostics.recommendations.push('❌ 没有 ready 状态的文档！需要先上传并处理文档')
    }

    return NextResponse.json(diagnostics, { status: 200 })
  } catch (error) {
    console.error('诊断错误:', error)
    return NextResponse.json({
      error: '诊断失败',
      details: error instanceof Error ? error.message : '未知错误',
      diagnostics,
    }, { status: 500 })
  }
}

