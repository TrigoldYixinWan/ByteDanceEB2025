import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * DELETE /api/documents/[id]
 * 删除文档（从 Storage 和 Database）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // 验证用户是否已登录
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 验证用户角色（仅 admin 可删除）
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: '权限不足：仅管理员可删除文档' },
        { status: 403 }
      )
    }

    // 查询文档信息（获取 file_path）
    const { data: document, error: queryError } = await supabase
      .from('documents')
      .select('file_path')
      .eq('id', id)
      .single()

    if (queryError || !document) {
      return NextResponse.json(
        { error: '文档不存在', details: queryError?.message },
        { status: 404 }
      )
    }

    // 从 Storage 删除文件
    if (document.file_path) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.file_path])

      if (storageError) {
        console.error('Storage delete error:', storageError)
        // 不中断流程，继续删除数据库记录
      }
    }

    // 从数据库删除记录
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)

    if (dbError) {
      console.error('Database delete error:', dbError)
      return NextResponse.json(
        { error: '删除文档记录失败', details: dbError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: '文档删除成功',
        id,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error in DELETE /api/documents/[id]:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/documents/[id]
 * 获取单个文档详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // 验证用户是否已登录
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 查询文档详情
    const { data: document, error: queryError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    if (queryError || !document) {
      return NextResponse.json(
        { error: '文档不存在', details: queryError?.message },
        { status: 404 }
      )
    }

    // 🔒 生成 URL（兼容 Public/Private Bucket）
    let sourceUrl: string
    
    try {
      // 尝试生成 Signed URL（Private Bucket）
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_path, 3600) // 1 小时有效期

      if (signedUrlError) {
        console.warn('⚠️ Signed URL failed, using public URL:', signedUrlError)
        
        // 降级到 Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(document.file_path)
        
        sourceUrl = publicUrl
      } else {
        sourceUrl = signedUrlData.signedUrl
      }
    } catch (error) {
      console.error('❌ URL generation error:', error)
      return NextResponse.json(
        { error: '生成访问链接失败', details: error instanceof Error ? error.message : '未知错误' },
        { status: 500 }
      )
    }

    // 转换为前端格式
    return NextResponse.json({
      document: {
        id: document.id,
        title: document.title,
        category: document.category,
        subcategory: document.subcategory,
        contentType: document.content_type,
        sourceUrl, // Signed URL 或 Public URL（兼容模式）
        filePath: document.file_path,
        status: document.status,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
      },
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/documents/[id]:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

