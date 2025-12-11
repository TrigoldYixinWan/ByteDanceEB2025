-- ============================================================
-- 创建 Documents Storage Bucket
-- ============================================================

-- 1. 创建 Bucket（Public 模式，方便 MVP 开发）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',              -- Bucket ID
  'documents',              -- Bucket 名称
  true,                     -- Public（可以后续升级到 Private）
  52428800,                 -- 50MB 文件大小限制
  ARRAY[
    'application/pdf',
    'text/plain',
    'text/markdown'
  ]
)
ON CONFLICT (id) DO NOTHING;  -- 如果已存在，跳过

-- 2. 设置 Storage RLS 策略（允许认证用户访问）

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Public Access to documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their documents" ON storage.objects;

-- 创建新策略
CREATE POLICY "Public Access to documents bucket"
ON storage.objects FOR SELECT
USING ( bucket_id = 'documents' );

CREATE POLICY "Authenticated users can upload to documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete their documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

-- 3. 验证 Bucket 创建成功
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id = 'documents';

-- ============================================================
-- 执行完毕！
-- ============================================================
SELECT '✅ Bucket "documents" 已创建（Public 模式）' AS status;
SELECT '📝 您可以随时使用 UPGRADE_TO_PRIVATE_BUCKET.sql 升级到 Private 模式' AS note;

