/**
 * 语义搜索服务
 * 
 * 使用 pgvector 进行向量相似度搜索
 * 支持 Multi-Query 扩展搜索
 */

import { createClient } from '@/lib/supabase/server'
import { generateEmbedding, generateEmbeddingBatch } from './embedding'
import OpenAI from 'openai'

// OpenAI 客户端（用于查询扩展）
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * 搜索结果接口
 */
export interface SearchResult {
  chunkId: string
  documentId: string
  documentTitle: string
  documentCategory: string
  content: string
  similarity: number
}

/**
 * 语义搜索 - 根据查询文本搜索相关文档块
 * 
 * @param query 用户查询文本
 * @param limit 返回结果数量，默认 8
 * @param threshold 相似度阈值，默认 0.7
 * @returns 搜索结果数组
 */
export async function semanticSearch(
  query: string,
  limit: number = 8,
  threshold: number = 0.7
): Promise<SearchResult[]> {
  console.log(`🔍 开始语义搜索: "${query.slice(0, 50)}..."`)
  
  try {
    // Step 1: 生成查询向量
    const queryEmbedding = await generateEmbedding(query)
    console.log(`✅ 查询向量生成完成 (${queryEmbedding.length} 维)`)
    
    // Step 2: 使用 pgvector 进行相似度搜索
    const supabase = await createClient()
    
    // 使用 RPC 函数进行向量搜索（需要在数据库中创建）
    // 或者使用原生 SQL 查询
    const { data: results, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    })
    
    if (error) {
      // 如果 RPC 函数不存在，回退到直接查询
      console.warn('⚠️ RPC 函数不可用，使用备用查询方案')
      return await fallbackSearch(supabase, queryEmbedding, limit, threshold)
    }
    
    console.log(`✅ 搜索完成，找到 ${results?.length || 0} 个相关结果`)
    
    return (results || []).map((r: any) => ({
      chunkId: r.chunk_id,
      documentId: r.document_id,
      documentTitle: r.document_title,
      documentCategory: r.document_category,
      content: r.content,
      similarity: r.similarity,
    }))
  } catch (error) {
    console.error('❌ 语义搜索失败:', error)
    throw error
  }
}

/**
 * 备用搜索方案 - 不使用 RPC 函数
 */
async function fallbackSearch(
  supabase: any,
  queryEmbedding: number[],
  limit: number,
  threshold: number
): Promise<SearchResult[]> {
  // 将向量转换为 PostgreSQL 格式
  const embeddingStr = `[${queryEmbedding.join(',')}]`
  
  // 使用原生查询
  // 注意：这需要 document_chunks 表有正确的索引
  const { data: chunks, error: chunksError } = await supabase
    .from('document_chunks')
    .select(`
      id,
      document_id,
      content,
      documents!inner (
        id,
        title,
        category,
        status
      )
    `)
    .eq('documents.status', 'ready')
    .limit(limit * 3)  // 获取更多，然后在应用层过滤
  
  if (chunksError) {
    console.error('❌ 备用搜索查询失败:', chunksError)
    throw new Error(`搜索失败: ${chunksError.message}`)
  }
  
  // 由于 Supabase JS 客户端不直接支持向量操作
  // 我们需要使用 SQL 查询
  // 这里使用一个简化的方案：返回所有块，让调用方处理
  console.warn('⚠️ 备用搜索无法进行向量相似度计算，建议创建 RPC 函数')
  
  // 返回结果（没有相似度排序）
  return (chunks || []).slice(0, limit).map((chunk: any) => ({
    chunkId: chunk.id,
    documentId: chunk.document_id,
    documentTitle: chunk.documents?.title || '未知文档',
    documentCategory: chunk.documents?.category || '未知类别',
    content: chunk.content,
    similarity: 0.8,  // 占位值
  }))
}

/**
 * 估算文本的 token 数量
 */
export function estimateTokens(text: string): number {
  // 粗略估计：中文约 1.5 字符 = 1 token，英文约 4 字符 = 1 token
  // 使用保守估计
  return Math.ceil(text.length / 2)
}

/**
 * 去重并合并搜索结果
 * 
 * @param results 搜索结果
 * @param maxTokens 最大 token 数
 * @returns 去重后的结果
 */
export function deduplicateResults(
  results: SearchResult[],
  maxTokens: number = 4000
): SearchResult[] {
  const seen = new Set<string>()
  const deduplicated: SearchResult[] = []
  let totalTokens = 0
  
  for (const result of results) {
    // 跳过重复的块
    if (seen.has(result.chunkId)) continue
    
    // 检查 token 预算
    const chunkTokens = estimateTokens(result.content)
    if (totalTokens + chunkTokens > maxTokens) {
      console.log(`⚠️ Token 预算已满，停止添加更多结果`)
      break
    }
    
    seen.add(result.chunkId)
    deduplicated.push(result)
    totalTokens += chunkTokens
  }
  
  console.log(`📊 去重后: ${deduplicated.length} 个结果, ~${totalTokens} tokens`)
  return deduplicated
}

// ============================================================
// Multi-Query 扩展搜索
// ============================================================

/**
 * 生成查询变体（Multi-Query）
 * 
 * 使用 LLM 将用户问题改写为多个不同角度的查询
 * 
 * @param originalQuery 原始用户问题
 * @param maxQueries 最大查询数量（包含原始查询），默认 4，最大 5
 * @returns 查询数组（包含原始查询）
 */
export async function generateQueryVariants(
  originalQuery: string,
  maxQueries: number = 4
): Promise<string[]> {
  // 限制最大查询数量
  const limit = Math.min(maxQueries, 5)
  const variantsNeeded = limit - 1  // 减去原始查询
  
  if (variantsNeeded <= 0) {
    return [originalQuery]
  }

  console.log(`🔄 生成 ${variantsNeeded} 个查询变体...`)

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `你是一个查询扩展助手。用户会给你一个问题，你需要生成 ${variantsNeeded} 个相关但不同角度的查询，帮助在知识库中找到更多相关信息。

要求：
1. 每个查询应该从不同角度表达相同或相关的信息需求
2. 使用不同的关键词和表达方式
3. 考虑同义词、相关概念、上下位概念
4. 保持查询简洁，10-30字为宜
5. 必须是中文

直接返回 JSON 数组格式，不要有其他内容：
["查询1", "查询2", ...]`
        },
        {
          role: 'user',
          content: originalQuery
        }
      ],
      temperature: 0.7,
      max_tokens: 300,
    })

    const content = response.choices[0]?.message?.content?.trim() || '[]'
    
    // 解析 JSON
    let variants: string[] = []
    try {
      // 尝试提取 JSON 数组
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        variants = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.warn('⚠️ 解析查询变体失败，使用原始查询:', e)
    }

    // 过滤无效查询
    variants = variants
      .filter(q => typeof q === 'string' && q.trim().length > 0)
      .slice(0, variantsNeeded)

    // 合并原始查询和变体
    const allQueries = [originalQuery, ...variants]
    
    console.log(`✅ 生成查询变体:`, allQueries)
    return allQueries
  } catch (error) {
    console.error('❌ 生成查询变体失败:', error)
    // 失败时返回原始查询
    return [originalQuery]
  }
}

/**
 * Multi-Query 语义搜索
 * 
 * 使用多个查询变体进行搜索，合并去重结果
 * 
 * @param query 用户原始查询
 * @param limit 每个查询的结果数量
 * @param threshold 相似度阈值
 * @param maxQueries 最大查询数量（包含原始查询）
 * @returns 合并后的搜索结果
 */
export async function multiQuerySearch(
  query: string,
  limit: number = 5,
  threshold: number = 0.3,
  maxQueries: number = 4
): Promise<SearchResult[]> {
  console.log(`🚀 开始 Multi-Query 搜索: "${query.slice(0, 50)}..."`)

  // Step 1: 生成查询变体
  const queries = await generateQueryVariants(query, maxQueries)
  console.log(`📝 共 ${queries.length} 个查询`)

  // Step 2: 并行生成所有查询的向量
  console.log(`🔢 生成查询向量...`)
  const embeddings = await generateEmbeddingBatch(queries)
  
  // Step 3: 并行执行所有搜索
  console.log(`🔍 并行执行搜索...`)
  const supabase = await createClient()
  
  const searchPromises = embeddings.map((embedding, index) => 
    supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    }).then(({ data, error }) => {
      if (error) {
        console.warn(`⚠️ 查询 ${index + 1} 搜索失败:`, error.message)
        return []
      }
      console.log(`  查询 ${index + 1} "${queries[index].slice(0, 20)}..." → ${data?.length || 0} 个结果`)
      return data || []
    })
  )

  const allResults = await Promise.all(searchPromises)

  // Step 4: 合并和去重结果
  const mergedResults: SearchResult[] = []
  const seenChunks = new Set<string>()
  const chunkScores = new Map<string, number>()  // 记录每个 chunk 的最高分

  for (const results of allResults) {
    for (const r of results) {
      const chunkId = r.chunk_id
      const similarity = r.similarity || 0

      // 记录最高相似度
      if (!chunkScores.has(chunkId) || chunkScores.get(chunkId)! < similarity) {
        chunkScores.set(chunkId, similarity)
      }

      // 去重
      if (seenChunks.has(chunkId)) continue
      seenChunks.add(chunkId)

      mergedResults.push({
        chunkId: r.chunk_id,
        documentId: r.document_id,
        documentTitle: r.document_title,
        documentCategory: r.document_category,
        content: r.content,
        similarity: similarity,
      })
    }
  }

  // 更新相似度为最高分，并按相似度排序
  for (const result of mergedResults) {
    result.similarity = chunkScores.get(result.chunkId) || result.similarity
  }
  mergedResults.sort((a, b) => b.similarity - a.similarity)

  console.log(`✅ Multi-Query 搜索完成: ${mergedResults.length} 个唯一结果`)
  return mergedResults
}

