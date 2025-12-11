/**
 * POST /api/documents/[id]/process
 * 
 * 处理文档：解析 PDF → 分块 → 生成向量 → 存储到数据库
 * 
 * ⚠️ 使用 Node.js Runtime（支持 pdf-parse）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmbeddingBatch, chunkText, estimateTokenCount, estimateEmbeddingCost } from '@/lib/ai/embedding'

// 强制使用 Node.js Runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    // Step 5: 解析 PDF 文本（使用 pdfjs-dist）
    // ============================================================
    let extractedText: string

    try {
      // 将 Blob 转换为 Uint8Array
      const arrayBuffer = await fileData.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      // 动态加载 pdfjs-dist
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
      
      // 加载 PDF 文档
      const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        useSystemFonts: true,
      })
      
      const pdfDocument = await loadingTask.promise
      const numPages = pdfDocument.numPages

      console.log(`📖 PDF 加载成功: ${numPages} 页`)

      // 提取所有页面的文本
      const textParts: string[] = []
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
        textParts.push(pageText)
      }

      extractedText = textParts.join('\n\n')

      console.log(`✅ PDF 解析成功:`, {
        pages: numPages,
        textLength: extractedText.length,
      })

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('PDF 文件不包含文本内容')
      }
    } catch (parseError) {
      console.error('❌ PDF 解析失败:', parseError)
      
      // 回滚状态
      await supabase
        .from('documents')
        .update({ status: 'failed' })
        .eq('id', id)

      return NextResponse.json(
        {
          error: 'PDF 解析失败',
          details: parseError instanceof Error ? parseError.message : '未知错误',
        },
        { status: 500 }
      )
    }

    // ============================================================
    // Step 6: 文本分块
    // ============================================================
    const chunks = chunkText(extractedText, 1000, 200) // 1000 字符，200 字符重叠

    console.log(`📦 文本分块完成: ${chunks.length} 个块`)

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

