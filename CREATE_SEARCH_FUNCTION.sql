-- ============================================
-- 创建语义搜索 RPC 函数
-- ============================================
-- 在 Supabase SQL Editor 中执行此脚本
-- 此函数用于 RAG 系统的向量相似度搜索

-- 删除已存在的函数（如果有）
DROP FUNCTION IF EXISTS match_documents(vector(1536), float, int);

-- 创建向量搜索函数
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  document_category text,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id AS chunk_id,
    dc.document_id,
    d.title AS document_title,
    d.category AS document_category,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE d.status = 'ready'
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION match_documents(vector(1536), float, int) TO authenticated;
GRANT EXECUTE ON FUNCTION match_documents(vector(1536), float, int) TO anon;

-- ============================================
-- 验证函数创建成功
-- ============================================
-- 运行以下查询验证：
-- SELECT * FROM match_documents(
--   (SELECT embedding FROM document_chunks LIMIT 1),
--   0.7,
--   5
-- );

-- ============================================
-- 🎉 完成！
-- ============================================
-- 此函数支持：
-- - 余弦相似度搜索 (<=> 操作符)
-- - 相似度阈值过滤
-- - 只搜索 status='ready' 的文档
-- - 返回文档元信息（标题、类别）

