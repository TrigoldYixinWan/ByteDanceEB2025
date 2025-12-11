/**
 * AI Embedding Service
 * 
 * 使用 OpenAI API 生成文本向量嵌入
 */

import OpenAI from 'openai'

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * 生成文本的向量嵌入
 * 
 * @param text 要嵌入的文本
 * @returns 1536 维度的向量数组
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // 清理文本（移除多余的空白字符）
    const cleanedText = text.replace(/\s+/g, ' ').trim()

    if (!cleanedText) {
      throw new Error('文本内容为空')
    }

    // 调用 OpenAI Embedding API
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // 1536 维度
      input: cleanedText,
      encoding_format: 'float',
    })

    if (!response.data || response.data.length === 0) {
      throw new Error('OpenAI API 返回空结果')
    }

    const embedding = response.data[0].embedding

    // 验证维度
    if (embedding.length !== 1536) {
      throw new Error(`Embedding 维度错误: ${embedding.length}，预期: 1536`)
    }

    return embedding
  } catch (error) {
    console.error('❌ Embedding 生成失败:', error)
    
    if (error instanceof Error) {
      throw new Error(`Embedding 生成失败: ${error.message}`)
    }
    
    throw new Error('Embedding 生成失败: 未知错误')
  }
}

/**
 * 批量生成向量嵌入（优化 API 调用）
 * 
 * @param texts 文本数组
 * @returns 向量数组
 */
export async function generateEmbeddingBatch(
  texts: string[]
): Promise<number[][]> {
  try {
    if (texts.length === 0) {
      return []
    }

    // 清理文本
    const cleanedTexts = texts.map((text) =>
      text.replace(/\s+/g, ' ').trim()
    )

    // 过滤空文本
    const validTexts = cleanedTexts.filter((text) => text.length > 0)

    if (validTexts.length === 0) {
      throw new Error('所有文本内容为空')
    }

    // OpenAI API 支持批量处理（最多 2048 个输入）
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: validTexts,
      encoding_format: 'float',
    })

    if (!response.data || response.data.length !== validTexts.length) {
      throw new Error('OpenAI API 返回数据不完整')
    }

    // 提取所有 embeddings
    const embeddings = response.data.map((item) => item.embedding)

    // 验证维度
    embeddings.forEach((embedding, index) => {
      if (embedding.length !== 1536) {
        throw new Error(
          `Embedding ${index} 维度错误: ${embedding.length}，预期: 1536`
        )
      }
    })

    return embeddings
  } catch (error) {
    console.error('❌ 批量 Embedding 生成失败:', error)
    
    if (error instanceof Error) {
      throw new Error(`批量 Embedding 生成失败: ${error.message}`)
    }
    
    throw new Error('批量 Embedding 生成失败: 未知错误')
  }
}

/**
 * 将文本分块
 * 
 * @param text 原始文本
 * @param chunkSize 每块大小（字符数）
 * @param overlap 重叠字符数
 * @returns 文本块数组
 */
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  // 清理文本
  const cleanedText = text.replace(/\s+/g, ' ').trim()

  if (!cleanedText) {
    return []
  }

  const chunks: string[] = []
  let startIndex = 0

  while (startIndex < cleanedText.length) {
    // 提取当前块
    const endIndex = Math.min(startIndex + chunkSize, cleanedText.length)
    const chunk = cleanedText.substring(startIndex, endIndex)

    chunks.push(chunk)

    // 如果已经到达文本末尾，退出
    if (endIndex === cleanedText.length) {
      break
    }

    // 移动到下一个块（考虑重叠）
    startIndex += chunkSize - overlap
  }

  return chunks
}

/**
 * 估算 Embedding API 成本
 * 
 * @param tokenCount Token 数量
 * @returns 成本（美元）
 */
export function estimateEmbeddingCost(tokenCount: number): number {
  // text-embedding-3-small 价格: $0.00002 per 1K tokens
  const pricePerToken = 0.00002 / 1000
  return tokenCount * pricePerToken
}

/**
 * 估算文本的 Token 数量（粗略估计）
 * 
 * @param text 文本
 * @returns 估算的 Token 数量
 */
export function estimateTokenCount(text: string): number {
  // 粗略估计：英文约 4 个字符 = 1 token，中文约 1.5 个字符 = 1 token
  // 这里使用保守估计：2.5 个字符 = 1 token
  return Math.ceil(text.length / 2.5)
}

