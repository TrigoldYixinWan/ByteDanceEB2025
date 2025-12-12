import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/documents
 * 获取所有文档列表（按创建时间倒序）
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // 验证用户是否已登录
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 查询所有文档
    const { data: documents, error: dbError } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('Database query error:', dbError)
      return NextResponse.json(
        { error: '获取文档列表失败', details: dbError.message },
        { status: 500 }
      )
    }

    // 🔒 为每个文档生成 URL（兼容 Public/Private Bucket）
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        let sourceUrl: string
        
        // 检查 file_path 是否存在
        if (!doc.file_path) {
          console.warn(`⚠️ Document ${doc.id} has no file_path`)
          sourceUrl = ''
          
          // 转换为前端格式（提前返回）
          return {
            id: doc.id,
            title: doc.title,
            category: doc.category,
            subcategory: doc.subcategory,
            contentType: doc.content_type,
            sourceUrl,
            filePath: doc.file_path,
            status: doc.status,
            citationCount: 0,
            createdAt: doc.created_at,
            updatedAt: doc.updated_at,
          }
        }
        
        try {
          // 尝试生成 Signed URL（Private Bucket）
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('documents')
            .createSignedUrl(doc.file_path, 3600) // 1 小时有效期

          if (signedUrlError) {
            console.warn(`⚠️ Signed URL failed for ${doc.file_path}, using public URL:`, signedUrlError)
            
            // 降级到 Public URL
            const { data: { publicUrl } } = supabase.storage
              .from('documents')
              .getPublicUrl(doc.file_path)
            
            sourceUrl = publicUrl
          } else {
            sourceUrl = signedUrlData.signedUrl
          }
        } catch (error) {
          console.error(`❌ URL generation failed for ${doc.file_path}:`, error)
          sourceUrl = '' // 空 URL 表示访问失败
        }

        // 转换为前端格式（snake_case → camelCase）
        return {
          id: doc.id,
          title: doc.title,
          category: doc.category,
          subcategory: doc.subcategory,
          contentType: doc.content_type,
          sourceUrl, // Signed URL 或 Public URL（兼容模式）
          filePath: doc.file_path,
          status: doc.status,
          citationCount: 0, // TODO: 从 document_chunks 聚合
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
        }
      })
    )

    return NextResponse.json({
      documents: documentsWithUrls,
      total: documentsWithUrls.length,
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/documents:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/documents
 * 上传新文档到 Supabase Storage 并创建数据库记录
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 验证用户是否已登录
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 解析 FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string
    const category = formData.get('category') as string
    const subcategory = formData.get('subcategory') as string | null

    // 验证必填字段
    if (!file) {
      return NextResponse.json({ error: '未提供文件' }, { status: 400 })
    }

    if (!title || !category) {
      return NextResponse.json(
        { error: '标题和类别是必填字段' },
        { status: 400 }
      )
    }

    // 验证文件类型（同时检查 MIME type 和文件扩展名）
    const allowedMimeTypes = [
      'application/pdf', 
      'text/plain', 
      'text/markdown',
      'application/octet-stream', // 某些浏览器对 .md 文件使用此类型
    ]
    const allowedExtensions = ['.pdf', '.txt', '.md', '.markdown']
    
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    const isValidMimeType = allowedMimeTypes.includes(file.type)
    const isValidExtension = allowedExtensions.includes(fileExtension)

    // 如果 MIME type 是 octet-stream，必须通过扩展名验证
    if (file.type === 'application/octet-stream' && !isValidExtension) {
      return NextResponse.json(
        { error: `不支持的文件类型: ${file.name}。仅支持 PDF, TXT, MD` },
        { status: 400 }
      )
    }

    // 如果 MIME type 不在允许列表中，且扩展名也不对
    if (!isValidMimeType && !isValidExtension) {
      return NextResponse.json(
        { error: `不支持的文件类型: ${file.type}。仅支持 PDF, TXT, MD` },
        { status: 400 }
      )
    }

    console.log(`📁 文件验证通过:`, {
      name: file.name,
      type: file.type,
      extension: fileExtension,
      size: file.size,
    })

    // 验证文件大小（50MB）
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '文件大小超过 50MB 限制' },
        { status: 400 }
      )
    }

    // 生成唯一文件路径
    const timestamp = Date.now()
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .toLowerCase()
    const filePath = `${user.id}/${timestamp}-${sanitizedFileName}`

    // 根据文件扩展名确定正确的 Content-Type
    // (某些浏览器对 .md 文件返回 application/octet-stream，Supabase 不接受)
    // 使用 text/plain 作为 .md 的 MIME type（Supabase 100% 接受）
    const getContentType = (fileName: string, originalType: string): string => {
      const ext = fileName.split('.').pop()?.toLowerCase()
      const mimeTypes: Record<string, string> = {
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'md': 'text/plain',       // 使用 text/plain（兼容性更好）
        'markdown': 'text/plain', // 使用 text/plain（兼容性更好）
      }
      return mimeTypes[ext || ''] || originalType
    }

    const contentType = getContentType(file.name, file.type)
    console.log(`📤 上传文件: ${filePath}, Content-Type: ${contentType}`)

    // 将 File 转换为 ArrayBuffer，确保 Supabase Storage 使用我们指定的 Content-Type
    // (传递 File 对象时，SDK 可能忽略 contentType 参数，使用 File.type)
    const fileArrayBuffer = await file.arrayBuffer()

    // 上传文件到 Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, fileArrayBuffer, {
        contentType: contentType, // 使用修正后的 Content-Type（ArrayBuffer 时会被尊重）
        cacheControl: '3600',
        upsert: false, // 不覆盖已存在的文件
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: '文件上传失败', details: uploadError.message },
        { status: 500 }
      )
    }

    // 🔒 安全升级: 生成 Signed URL（1 小时有效期）
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600) // 3600 秒 = 1 小时

    if (signedUrlError) {
      console.error('Signed URL generation error:', signedUrlError)
      
      // 回滚：删除已上传的文件
      await supabase.storage.from('documents').remove([filePath])
      
      return NextResponse.json(
        { error: '生成访问链接失败', details: signedUrlError.message },
        { status: 500 }
      )
    }

    // 插入数据库记录
    // 注意：source_url 存储 Signed URL（会过期，仅用于初始响应）
    // 实际访问时应通过 GET API 重新生成 Signed URL
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        title,
        category,
        subcategory: subcategory || null,
        content_type: file.type,
        source_url: signedUrlData.signedUrl, // Signed URL（会过期）
        file_path: filePath, // 永久存储路径
        status: 'pending', // 初始状态为待处理（等待 chunk 和向量化）
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insert error:', dbError)

      // 如果数据库插入失败，删除已上传的文件
      await supabase.storage.from('documents').remove([filePath])

      return NextResponse.json(
        { error: '创建文档记录失败', details: dbError.message },
        { status: 500 }
      )
    }

    // 返回格式化的文档信息
    return NextResponse.json(
      {
        message: '文档上传成功',
        document: {
          id: document.id,
          title: document.title,
          category: document.category,
          subcategory: document.subcategory,
          contentType: document.content_type,
          sourceUrl: document.source_url,
          filePath: document.file_path,
          status: document.status,
          createdAt: document.created_at,
          updatedAt: document.updated_at,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error in POST /api/documents:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

