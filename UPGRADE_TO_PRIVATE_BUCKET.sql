-- ============================================================
-- Phase 3 Security Upgrade: Private Bucket + Signed URLs
-- ============================================================
-- 执行日期: 2025-12-11
-- 目标: 将 documents bucket 从 Public 升级到 Private
--       并应用 Admin-only RLS 策略
-- ============================================================

-- ============================================================
-- PART 1: 更新 Bucket 配置
-- ============================================================

-- 将 documents bucket 设置为 Private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'documents';

-- 验证 Bucket 配置
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets 
WHERE id = 'documents';

-- 预期结果: public = false


-- ============================================================
-- PART 2: 清理旧的 RLS 策略
-- ============================================================

-- 删除所有旧的 storage.objects 策略（如果存在）
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- 验证旧策略已删除
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects';


-- ============================================================
-- PART 3: 应用新的 RLS 策略（Admin-only）
-- ============================================================

-- -------------------------------------------------------------
-- 策略 1: SELECT - 认证用户可以查看（通过 Signed URL）
-- -------------------------------------------------------------
CREATE POLICY "Authenticated users can view files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);

COMMENT ON POLICY "Authenticated users can view files" ON storage.objects IS 
'允许所有认证用户查看 documents bucket 中的文件（需要通过 Signed URL 访问）';


-- -------------------------------------------------------------
-- 策略 2: INSERT - 仅 Admin 可以上传文件
-- -------------------------------------------------------------
CREATE POLICY "Only admins can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (
    -- 检查用户是否是 Admin
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
);

COMMENT ON POLICY "Only admins can upload files" ON storage.objects IS 
'仅允许 Admin 角色的用户上传文件到 documents bucket';


-- -------------------------------------------------------------
-- 策略 3: UPDATE - 仅 Admin 可以更新文件
-- -------------------------------------------------------------
CREATE POLICY "Only admins can update files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
);

COMMENT ON POLICY "Only admins can update files" ON storage.objects IS 
'仅允许 Admin 角色的用户更新 documents bucket 中的文件';


-- -------------------------------------------------------------
-- 策略 4: DELETE - 仅 Admin 可以删除文件
-- -------------------------------------------------------------
CREATE POLICY "Only admins can delete files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
);

COMMENT ON POLICY "Only admins can delete files" ON storage.objects IS 
'仅允许 Admin 角色的用户删除 documents bucket 中的文件';


-- ============================================================
-- PART 4: 更新 documents 表的 RLS 策略（可选但推荐）
-- ============================================================

-- 启用 RLS（如果尚未启用）
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 清理旧策略
DROP POLICY IF EXISTS "Public documents are viewable by everyone" ON documents;
DROP POLICY IF EXISTS "Users can insert documents" ON documents;

-- 新策略 1: SELECT - 所有认证用户可以查看
CREATE POLICY "Authenticated users can view documents"
ON documents FOR SELECT
USING ( auth.role() = 'authenticated' );

-- 新策略 2: INSERT - 仅 Admin 可以插入
CREATE POLICY "Only admins can insert documents"
ON documents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 新策略 3: UPDATE - 仅 Admin 可以更新
CREATE POLICY "Only admins can update documents"
ON documents FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 新策略 4: DELETE - 仅 Admin 可以删除
CREATE POLICY "Only admins can delete documents"
ON documents FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);


-- ============================================================
-- PART 5: 验证新策略
-- ============================================================

-- 查看所有 storage.objects 的策略
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%admin%' OR policyname LIKE '%Authenticated%'
ORDER BY policyname;

-- 查看 documents 表的策略
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'documents'
ORDER BY policyname;


-- ============================================================
-- PART 6: 测试查询（可选）
-- ============================================================

-- 测试 1: 验证当前用户的角色
SELECT 
  auth.uid() as user_id,
  p.role,
  p.full_name
FROM profiles p
WHERE p.id = auth.uid();

-- 测试 2: 验证 documents 数量
SELECT COUNT(*) as total_documents
FROM documents;

-- 测试 3: 验证 storage 文件数量
SELECT COUNT(*) as total_files
FROM storage.objects
WHERE bucket_id = 'documents';


-- ============================================================
-- 执行完成提示
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Phase 3 Security Upgrade 执行完成！';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ Bucket "documents" 已设置为 Private';
  RAISE NOTICE '✅ RLS 策略已更新为 Admin-only';
  RAISE NOTICE '✅ 认证用户可以查看（需要 Signed URL）';
  RAISE NOTICE '✅ 仅 Admin 可以上传/更新/删除';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 更新 API 代码以使用 Signed URLs';
  RAISE NOTICE '2. 测试上传和查看功能';
  RAISE NOTICE '3. 验证 Admin 权限';
  RAISE NOTICE '============================================================';
END $$;


-- ============================================================
-- 回滚脚本（紧急情况使用）
-- ============================================================
-- 如果需要回滚到 Public Bucket，请执行以下语句：
-- 
-- UPDATE storage.buckets SET public = true WHERE id = 'documents';
-- 
-- DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
-- DROP POLICY IF EXISTS "Only admins can upload files" ON storage.objects;
-- DROP POLICY IF EXISTS "Only admins can update files" ON storage.objects;
-- DROP POLICY IF EXISTS "Only admins can delete files" ON storage.objects;
-- 
-- CREATE POLICY "Public Access" ON storage.objects 
-- FOR SELECT USING ( bucket_id = 'documents' );
-- 
-- ============================================================

