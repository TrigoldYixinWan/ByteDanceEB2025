-- ============================================================
-- 验证文档已存储在数据库
-- ============================================================

-- 1. 查看所有文档
SELECT 
  id,
  title,
  category,
  subcategory,
  status,
  content_type,
  file_path,
  created_at
FROM documents
ORDER BY created_at DESC;

-- 2. 统计各状态的文档数量
SELECT 
  status,
  COUNT(*) as count
FROM documents
GROUP BY status
ORDER BY status;

-- 3. 验证文件路径不为空
SELECT 
  COUNT(*) as total_documents,
  COUNT(file_path) as documents_with_file,
  COUNT(*) - COUNT(file_path) as documents_missing_file
FROM documents;

-- 4. 查看最近上传的文档（完整信息）
SELECT *
FROM documents
ORDER BY created_at DESC
LIMIT 5;

