-- ============================================
-- 检查 RAG 系统数据就绪状态
-- ============================================

-- 1. 检查 ready 状态的文档数量
SELECT 
  status,
  COUNT(*) as count
FROM documents
GROUP BY status;

-- 2. 检查有 embedding 的文档块数量
SELECT 
  COUNT(*) as total_chunks,
  COUNT(embedding) as chunks_with_embedding,
  COUNT(*) - COUNT(embedding) as chunks_without_embedding
FROM document_chunks;

-- 3. 检查文档和块的关联
SELECT 
  d.id,
  d.title,
  d.status,
  COUNT(dc.id) as chunk_count
FROM documents d
LEFT JOIN document_chunks dc ON d.id = dc.document_id
GROUP BY d.id, d.title, d.status
ORDER BY d.created_at DESC;

-- 4. 测试搜索函数是否工作
-- （使用一个已有的 embedding 进行测试）
SELECT 
  chunk_id,
  document_title,
  similarity,
  LEFT(content, 100) as content_preview
FROM match_documents(
  (SELECT embedding FROM document_chunks WHERE embedding IS NOT NULL LIMIT 1),
  0.5,  -- 较低阈值用于测试
  5
);

-- ============================================
-- 如果上述查询都有数据，RAG 系统已就绪！
-- ============================================

