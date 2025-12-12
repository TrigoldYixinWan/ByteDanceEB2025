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
 * 将文本分块（旧版 - 简单滑动窗口）
 * 
 * @deprecated 推荐使用 smartChunkText
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
 * 智能文本分块 - 语义边界切分
 * 
 * 优先在段落、句子边界切分，保持语义完整性
 * 
 * @param text 原始文本
 * @param targetSize 目标块大小（字符数），默认 500
 * @param maxSize 最大块大小（字符数），默认 800
 * @param minSize 最小块大小（字符数），默认 100
 * @returns 文本块数组
 */
export function smartChunkText(
  text: string,
  targetSize: number = 500,
  maxSize: number = 800,
  minSize: number = 100
): string[] {
  if (!text || text.trim().length === 0) {
    return []
  }

  const chunks: string[] = []
  
  // Step 1: 按段落分割（保留换行符信息）
  // 支持多种段落分隔符：双换行、Markdown 标题等
  const paragraphs = splitIntoParagraphs(text)
  
  let currentChunk = ''
  
  for (const para of paragraphs) {
    const trimmedPara = para.trim()
    if (!trimmedPara) continue
    
    // 如果当前块加上新段落不超过目标大小，合并
    if (currentChunk.length + trimmedPara.length + 2 <= targetSize) {
      currentChunk = currentChunk 
        ? currentChunk + '\n\n' + trimmedPara 
        : trimmedPara
    } else {
      // 保存当前块（如果非空且达到最小大小）
      if (currentChunk && currentChunk.length >= minSize) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      } else if (currentChunk) {
        // 当前块太小，尝试和新段落合并
        currentChunk = currentChunk + '\n\n' + trimmedPara
        if (currentChunk.length >= targetSize) {
          chunks.push(currentChunk.trim())
          currentChunk = ''
        }
        continue
      }
      
      // 处理新段落
      if (trimmedPara.length <= maxSize) {
        // 段落大小合适，直接作为新块的开始
        currentChunk = trimmedPara
      } else {
        // 段落太长，需要在句子边界切分
        const sentenceChunks = splitLongParagraph(trimmedPara, targetSize, maxSize)
        
        // 添加所有完整的句子块
        for (let i = 0; i < sentenceChunks.length - 1; i++) {
          chunks.push(sentenceChunks[i])
        }
        
        // 最后一个块作为新的当前块（可能需要和下一段落合并）
        currentChunk = sentenceChunks[sentenceChunks.length - 1] || ''
      }
    }
  }
  
  // 处理剩余的当前块
  if (currentChunk && currentChunk.trim().length > 0) {
    // 如果太小，尝试合并到上一个块
    if (currentChunk.length < minSize && chunks.length > 0) {
      const lastChunk = chunks.pop()!
      if (lastChunk.length + currentChunk.length <= maxSize) {
        chunks.push(lastChunk + '\n\n' + currentChunk.trim())
      } else {
        chunks.push(lastChunk)
        chunks.push(currentChunk.trim())
      }
    } else {
      chunks.push(currentChunk.trim())
    }
  }
  
  // 过滤空块并返回
  return chunks.filter(chunk => chunk.length > 0)
}

/**
 * 将文本按段落分割
 * 
 * 识别多种段落边界：
 * - 双换行符
 * - Markdown 标题（# ## ###）
 * - 分隔线（--- ***）
 */
function splitIntoParagraphs(text: string): string[] {
  // 标准化换行符
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  
  // 在 Markdown 标题前添加分隔符（保留标题）
  const withHeaderBreaks = normalized.replace(/\n(#{1,4}\s)/g, '\n\n$1')
  
  // 在分隔线处分割
  const withDividerBreaks = withHeaderBreaks.replace(/\n([-*_]{3,})\n/g, '\n\n$1\n\n')
  
  // 按双换行符分割
  return withDividerBreaks.split(/\n\n+/)
}

/**
 * 将过长的段落在句子边界切分
 * 
 * @param paragraph 长段落
 * @param targetSize 目标大小
 * @param maxSize 最大大小
 * @returns 切分后的文本块数组
 */
function splitLongParagraph(
  paragraph: string, 
  targetSize: number, 
  maxSize: number
): string[] {
  const chunks: string[] = []
  
  // 按句子分割
  const sentences = splitIntoSentences(paragraph)
  
  let currentChunk = ''
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (!trimmedSentence) continue
    
    // 单个句子就超过最大大小，需要强制切分
    if (trimmedSentence.length > maxSize) {
      // 保存当前块
      if (currentChunk) {
        chunks.push(currentChunk)
        currentChunk = ''
      }
      // 强制切分超长句子
      chunks.push(...forceSplitText(trimmedSentence, targetSize))
      continue
    }
    
    // 尝试添加到当前块
    const newLength = currentChunk.length + trimmedSentence.length + 1
    
    if (newLength <= targetSize) {
      // 可以添加
      currentChunk = currentChunk 
        ? currentChunk + ' ' + trimmedSentence 
        : trimmedSentence
    } else if (currentChunk.length >= targetSize * 0.6) {
      // 当前块已经足够大，保存并开始新块
      chunks.push(currentChunk)
      currentChunk = trimmedSentence
    } else {
      // 当前块太小，继续添加（允许超出 targetSize，但不超过 maxSize）
      if (newLength <= maxSize) {
        currentChunk = currentChunk 
          ? currentChunk + ' ' + trimmedSentence 
          : trimmedSentence
      } else {
        chunks.push(currentChunk)
        currentChunk = trimmedSentence
      }
    }
  }
  
  // 添加剩余内容
  if (currentChunk) {
    chunks.push(currentChunk)
  }
  
  return chunks
}

/**
 * 将文本按句子分割
 * 
 * 支持中英文标点符号
 */
function splitIntoSentences(text: string): string[] {
  // 中文句子结束符：。！？；
  // 英文句子结束符：. ! ? (后跟空格或换行)
  // 保留分隔符
  
  const sentences: string[] = []
  let current = ''
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1] || ''
    
    current += char
    
    // 检查是否是句子结束
    const isChinese = /[。！？；]/.test(char)
    const isEnglish = /[.!?]/.test(char) && /[\s\n]|$/.test(nextChar)
    
    if (isChinese || isEnglish) {
      sentences.push(current.trim())
      current = ''
    }
  }
  
  // 添加剩余内容
  if (current.trim()) {
    sentences.push(current.trim())
  }
  
  return sentences
}

/**
 * 强制切分超长文本（当句子本身超过最大大小时）
 * 
 * 尝试在逗号、分号等次级边界切分
 */
function forceSplitText(text: string, targetSize: number): string[] {
  const chunks: string[] = []
  
  // 尝试在次级标点符号处切分：，、；：,;:
  const subSentences = text.split(/([，、；：,;:])/g)
  
  let current = ''
  
  for (let i = 0; i < subSentences.length; i++) {
    const part = subSentences[i]
    
    if (current.length + part.length <= targetSize) {
      current += part
    } else {
      if (current) {
        chunks.push(current.trim())
      }
      
      // 如果单个部分就超过目标大小，硬切分
      if (part.length > targetSize) {
        for (let j = 0; j < part.length; j += targetSize) {
          chunks.push(part.substring(j, j + targetSize).trim())
        }
        current = ''
      } else {
        current = part
      }
    }
  }
  
  if (current.trim()) {
    chunks.push(current.trim())
  }
  
  return chunks.filter(c => c.length > 0)
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

