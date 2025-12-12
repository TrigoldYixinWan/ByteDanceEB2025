/**
 * POST /api/documents/[id]/process
 * 
 * 处理文档：解析 PDF → 分块 → 生成向量 → 存储到数据库
 * 
 * ⚠️ 使用 Node.js Runtime（支持 pdf-parse）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmbeddingBatch, smartChunkText, estimateTokenCount, estimateEmbeddingCost } from '@/lib/ai/embedding'

// 强制使用 Node.js Runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// pdf-parse 在模块加载时会尝试读取测试文件，使用延迟加载避免此问题
let pdfParse: any = null
const getPdfParse = () => {
  if (!pdfParse) {
    pdfParse = require('pdf-parse')
  }
  return pdfParse
}

/**
 * POST /api/documents/[id]/process
 * 处理文档并生成向量嵌入
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    console.log(`📝 开始处理文档: ${id}`)

    // ============================================================
    // Step 1: 验证用户权限（仅 Admin）
    // ============================================================
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 验证用户是否为 Admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: '用户配置未找到' }, { status: 403 })
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: '仅管理员可以处理文档' },
        { status: 403 }
      )
    }

    // ============================================================
    // Step 2: 获取文档信息
    // ============================================================
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: '文档未找到' }, { status: 404 })
    }

    console.log(`📄 文档信息:`, {
      title: document.title,
      status: document.status,
      filePath: document.file_path,
      contentType: document.content_type,
    })

    // 检查文档状态
    if (document.status === 'processing') {
      return NextResponse.json(
        { error: '文档正在处理中，请稍后再试' },
        { status: 409 }
      )
    }

    if (document.status === 'ready') {
      return NextResponse.json(
        { error: '文档已处理完成，无需重复处理' },
        { status: 409 }
      )
    }

    // ============================================================
    // Step 3: 更新文档状态为 "processing"
    // ============================================================
    const { error: updateError1 } = await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', id)

    if (updateError1) {
      console.error('❌ 状态更新失败:', updateError1)
      return NextResponse.json(
        { error: '状态更新失败' },
        { status: 500 }
      )
    }

    console.log('✅ 文档状态已更新为 processing')

    // ============================================================
    // Step 4: 从 Storage 下载文件
    // ============================================================
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path)

    if (downloadError || !fileData) {
      console.error('❌ 文件下载失败:', downloadError)
      
      // 回滚状态
      await supabase
        .from('documents')
        .update({ status: 'failed' })
        .eq('id', id)

      return NextResponse.json(
        { error: '文件下载失败', details: downloadError?.message },
        { status: 500 }
      )
    }

    console.log(`✅ 文件下载成功: ${fileData.size} bytes`)

    // ============================================================
    // Step 5: 解析文档文本（支持 PDF, Markdown, TXT）
    // ============================================================
    let extractedText: string

    try {
      const arrayBuffer = await fileData.arrayBuffer()
      const dataBuffer = Buffer.from(arrayBuffer)
      
      // 根据文件类型或扩展名选择解析方式
      const filePath = document.file_path || ''
      const contentType = document.content_type || ''
      const fileExtension = filePath.split('.').pop()?.toLowerCase() || ''

      console.log(`📖 开始解析文档:`, {
        contentType,
        fileExtension,
        size: dataBuffer.length,
      })

      // 判断文件类型
      const isPdf = contentType === 'application/pdf' || fileExtension === 'pdf'
      const isMarkdown = contentType === 'text/markdown' || 
                         fileExtension === 'md' || 
                         fileExtension === 'markdown'
      const isText = contentType === 'text/plain' || 
                     fileExtension === 'txt'

      if (isPdf) {
        // PDF 解析
        console.log('📄 使用 pdf-parse 解析 PDF...')
        const pdf = getPdfParse()
        const data = await pdf(dataBuffer)
        extractedText = data.text

        console.log(`✅ PDF 解析成功:`, {
          pages: data.numpages,
          textLength: extractedText.length,
        })
      } else if (isMarkdown || isText) {
        // Markdown 和 TXT 直接读取文本
        console.log(`📄 直接读取 ${isMarkdown ? 'Markdown' : 'TXT'} 文本...`)
        extractedText = dataBuffer.toString('utf-8')

        console.log(`✅ 文本读取成功:`, {
          format: isMarkdown ? 'Markdown' : 'TXT',
          textLength: extractedText.length,
        })
      } else {
        // 未知格式，尝试作为文本读取
        console.log('⚠️ 未知文件格式，尝试作为文本读取...')
        extractedText = dataBuffer.toString('utf-8')
        
        // 检查是否是有效的文本
        if (extractedText.includes('\x00')) {
          throw new Error(`不支持的文件格式: ${contentType || fileExtension}`)
        }

        console.log(`✅ 文本读取成功 (fallback):`, {
          textLength: extractedText.length,
        })
      }

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('文档不包含文本内容')
      }
    } catch (parseError) {
      console.error('❌ 文档解析失败:', parseError)
      
      // 回滚状态
      await supabase
        .from('documents')
        .update({ status: 'failed' })
        .eq('id', id)

      return NextResponse.json(
        {
          error: '文档解析失败',
          details: parseError instanceof Error ? parseError.message : '未知错误',
        },
        { status: 500 }
      )
    }

    // ============================================================
    // Step 6: 文本分块（语义边界切分）
    // ============================================================
    // 使用智能分块：目标 500 字符，最大 800 字符，最小 100 字符
    // 优先在段落、句子边界切分，保持语义完整性
    const chunks = smartChunkText(extractedText, 500, 800, 100)

    console.log(`📦 文本分块完成: ${chunks.length} 个块（语义边界切分）`)

    if (chunks.length === 0) {
      // 回滚状态
      await supabase
        .from('documents')
        .update({ status: 'failed' })
        .eq('id', id)

      return NextResponse.json(
        { error: '文本分块失败: 无有效内容' },
        { status: 500 }
      )
    }

    // 估算成本
    const totalTokens = chunks.reduce(
      (sum, chunk) => sum + estimateTokenCount(chunk),
      0
    )
    const estimatedCost = estimateEmbeddingCost(totalTokens)

    console.log(`💰 估算成本:`, {
      totalTokens,
      estimatedCost: `$${estimatedCost.toFixed(6)}`,
    })

    // ============================================================
    // Step 7: 生成向量嵌入（批量）
    // ============================================================
    let embeddings: number[][]

    try {
      console.log(`🤖 开始生成向量嵌入...`)
      
      // 批量生成（OpenAI 支持最多 2048 个输入）
      // 如果 chunks 太多，需要分批处理
      const batchSize = 100 // 每次处理 100 个块
      embeddings = []

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batchChunks = chunks.slice(i, i + batchSize)
        console.log(
          `🔄 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}: ${batchChunks.length} 个块`
        )
        
        const batchEmbeddings = await generateEmbeddingBatch(batchChunks)
        embeddings.push(...batchEmbeddings)
      }

      console.log(`✅ 向量生成完成: ${embeddings.length} 个向量`)
    } catch (embeddingError) {
      console.error('❌ 向量生成失败:', embeddingError)
      
      // 回滚状态
      await supabase
        .from('documents')
        .update({ status: 'failed' })
        .eq('id', id)

      return NextResponse.json(
        {
          error: '向量生成失败',
          details: embeddingError instanceof Error ? embeddingError.message : '未知错误',
        },
        { status: 500 }
      )
    }

    // ============================================================
    // Step 8: 存储到 document_chunks 表
    // ============================================================
    try {
      console.log(`💾 开始存储到数据库...`)

      // 构建插入数据
      const chunksToInsert = chunks.map((content, index) => ({
        document_id: id,
        content,
        embedding: embeddings[index], // pgvector 格式
        citation_count: 0,
      }))

      // 批量插入（Supabase 限制每次约 1000 条）
      const insertBatchSize = 500
      let totalInserted = 0

      for (let i = 0; i < chunksToInsert.length; i += insertBatchSize) {
        const batch = chunksToInsert.slice(i, i + insertBatchSize)
        
        const { error: insertError } = await supabase
          .from('document_chunks')
          .insert(batch)

        if (insertError) {
          throw new Error(`数据库插入失败: ${insertError.message}`)
        }

        totalInserted += batch.length
        console.log(`✅ 已插入 ${totalInserted}/${chunksToInsert.length} 个块`)
      }

      console.log(`✅ 所有块已存储到数据库`)
    } catch (dbError) {
      console.error('❌ 数据库插入失败:', dbError)
      
      // 回滚状态
      await supabase
        .from('documents')
        .update({ status: 'failed' })
        .eq('id', id)

      return NextResponse.json(
        {
          error: '数据库存储失败',
          details: dbError instanceof Error ? dbError.message : '未知错误',
        },
        { status: 500 }
      )
    }

    // ============================================================
    // Step 9: 更新文档状态为 "ready"
    // ============================================================
    const { error: updateError2 } = await supabase
      .from('documents')
      .update({ status: 'ready' })
      .eq('id', id)

    if (updateError2) {
      console.error('❌ 状态更新失败:', updateError2)
      return NextResponse.json(
        { error: '状态更新失败（文档已处理但状态未更新）' },
        { status: 500 }
      )
    }

    console.log(`✅ 文档处理完成: ${id}`)

    // ============================================================
    // Step 10: 返回成功响应
    // ============================================================
    return NextResponse.json(
      {
        message: '文档处理成功',
        document: {
          id,
          title: document.title,
          status: 'ready',
          chunksCount: chunks.length,
          estimatedCost: `$${estimatedCost.toFixed(6)}`,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('❌ 文档处理失败:', error)
    return NextResponse.json(
      {
        error: '服务器内部错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}

