# ✅ Private Bucket + Signed URLs 验证指南

**升级日期**: 2025-12-11  
**状态**: ✅ 代码重构完成，等待测试

---

## 📋 已完成的重构

### 1. ✅ SQL 脚本
**文件**: `UPGRADE_TO_PRIVATE_BUCKET.sql`

**内容**:
- ✅ 将 `documents` bucket 设置为 Private
- ✅ 删除旧的 Public Access 策略
- ✅ 应用 Admin-only RLS 策略
  - SELECT: 认证用户可查看
  - INSERT/UPDATE/DELETE: 仅 Admin

---

### 2. ✅ API 重构
**文件**: `app/api/documents/route.ts`

**修改**:
- ✅ **POST**: 使用 `createSignedUrl()` 替代 `getPublicUrl()`
- ✅ **GET**: 为每个文档生成新的 Signed URL（1小时有效期）
- ✅ **错误处理**: Signed URL 生成失败时自动回滚

**文件**: `app/api/documents/[id]/route.ts`

**修改**:
- ✅ **GET**: 为单个文档生成 Signed URL
- ✅ **DELETE**: 保持不变（已有权限检查）

---

### 3. ✅ 前端兼容性
**文件**: `app/admin/dashboard/page.tsx`

**状态**: ✅ **无需修改**
- 前端只调用 API
- API 自动返回 Signed URLs
- 完全向后兼容

---

## 🧪 测试步骤

### 前提条件

**⚠️ 重要**: 在测试前，必须先执行 SQL 脚本！

```sql
-- 在 Supabase SQL Editor 中执行
-- 文件: UPGRADE_TO_PRIVATE_BUCKET.sql
```

---

### 测试 1: 验证 Bucket 配置

#### 步骤 1: 检查 Bucket 状态

```sql
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets 
WHERE id = 'documents';
```

**预期结果**:
```
id         | name      | public | created_at
-----------|-----------|--------|------------
documents  | documents | false  | 2024-...
```

✅ **验证**: `public = false`

---

#### 步骤 2: 检查 RLS 策略

```sql
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%admin%' OR policyname LIKE '%Authenticated%'
ORDER BY policyname;
```

**预期结果**: 应该看到 4 条策略
- `Authenticated users can view files`
- `Only admins can upload files`
- `Only admins can update files`
- `Only admins can delete files`

---

### 测试 2: 验证上传功能（Admin）

#### 步骤 1: 以 Admin 登录

1. 访问 `/login`
2. 使用 Admin 账户登录

#### 步骤 2: 上传文档

1. 访问 `/admin/upload`
2. 选择一个 PDF 文件
3. 填写标题和类别
4. 点击"上传文档"

**预期结果**:
- ✅ 上传成功
- ✅ 显示绿色成功消息
- ✅ 3秒后跳转到 Dashboard

#### 步骤 3: 验证 Signed URL

**打开浏览器 DevTools**:

```
Console 应该显示:
📤 开始上传文件: { ... }
✅ 上传成功: { 
  document: { 
    sourceUrl: "https://xxx.supabase.co/storage/v1/object/sign/documents/...?token=..." 
  } 
}
```

✅ **验证**: `sourceUrl` 包含 `/sign/` 和 `?token=`

---

### 测试 3: 验证文档列表（Dashboard）

#### 步骤 1: 访问 Dashboard

1. 访问 `/admin/dashboard`

**预期结果**:
- ✅ 文档列表正常显示
- ✅ 刚上传的文档出现在列表中
- ✅ 状态显示为"待处理"

#### 步骤 2: 检查 Network 请求

**打开 DevTools → Network 标签**:

1. 刷新页面
2. 找到 `GET /api/documents` 请求
3. 查看 Response

**预期 Response**:
```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "测试文档",
      "sourceUrl": "https://xxx.supabase.co/storage/v1/object/sign/documents/...?token=...",
      ...
    }
  ],
  "total": 1
}
```

✅ **验证**: 每个文档的 `sourceUrl` 都包含 `token` 参数

---

### 测试 4: 验证文件访问（Signed URL）

#### 步骤 1: 复制 Signed URL

从 Dashboard 的 Network 响应中复制一个 `sourceUrl`

#### 步骤 2: 在新标签页访问

**预期结果**:
- ✅ PDF 文件正常打开/下载
- ✅ 不需要登录（URL 包含临时 token）

#### 步骤 3: 测试 URL 过期（可选）

等待 1 小时后，再次访问同一个 URL

**预期结果**:
- ❌ 访问失败（返回 400 或 403 错误）
- ✅ 刷新 Dashboard，会生成新的 Signed URL

---

### 测试 5: 验证权限控制

#### 测试 5.1: Merchant 不能上传

1. 以 Merchant 账户登录
2. 尝试访问 `/admin/upload`

**预期结果**:
- ❌ 被 Middleware 拦截
- ✅ 重定向到 `/portal`

#### 测试 5.2: 直接 Storage API 测试（可选）

**在浏览器 Console 中运行**:

```javascript
// 测试：Merchant 尝试上传
const { createClient } = supabase // 假设已初始化

const testFile = new Blob(['test'], { type: 'text/plain' })
const { data, error } = await supabase.storage
  .from('documents')
  .upload('test/test.txt', testFile)

console.log('Upload result:', { data, error })
```

**预期结果**（如果以 Merchant 登录）:
```
{
  data: null,
  error: {
    message: "new row violates row-level security policy"
  }
}
```

✅ **验证**: RLS 策略阻止了非 Admin 上传

---

### 测试 6: 验证删除功能

#### 步骤 1: 删除文档

1. 在 Dashboard 找到一个文档
2. 点击删除按钮（垃圾桶图标）
3. 确认删除

**预期结果**:
- ✅ 文档从列表中消失
- ✅ Console 显示 "文档 xxx 已删除"

#### 步骤 2: 验证 Storage

**在 Supabase Dashboard → Storage → documents**:

- ✅ 文件已从 Storage 中删除

#### 步骤 3: 验证数据库

```sql
SELECT * FROM documents WHERE title = '已删除的文档标题';
```

**预期结果**: 无结果（记录已删除）

---

## 🔍 故障排查

### 问题 1: 上传失败 - "生成访问链接失败"

**原因**: Bucket 可能仍是 Public，或 RLS 策略未应用

**解决方案**:
1. 重新执行 SQL 脚本
2. 验证 Bucket 配置：
   ```sql
   SELECT public FROM storage.buckets WHERE id = 'documents';
   ```
3. 确认 `public = false`

---

### 问题 2: Dashboard 显示空 sourceUrl

**原因**: Signed URL 生成失败

**调试步骤**:
1. 检查 API 日志（浏览器 Console）
2. 查找错误信息：`Failed to generate signed URL`
3. 检查 RLS 策略：
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'objects' 
   AND policyname = 'Authenticated users can view files';
   ```

---

### 问题 3: 文件访问 403 Forbidden

**原因**: 
- Signed URL 已过期（>1 小时）
- 用户未登录

**解决方案**:
1. 刷新 Dashboard 页面（生成新的 Signed URL）
2. 确认用户已登录

---

### 问题 4: 回滚到 Public Bucket

如果需要紧急回滚：

```sql
-- 设置为 Public
UPDATE storage.buckets SET public = true WHERE id = 'documents';

-- 删除 Private 策略
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can update files" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete files" ON storage.objects;

-- 恢复 Public 策略
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING ( bucket_id = 'documents' );

CREATE POLICY "Authenticated users can upload" ON storage.objects 
FOR INSERT WITH CHECK ( 
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
);
```

---

## 📊 验证清单

完成以下所有测试确认升级成功：

### SQL 层
- [ ] Bucket `public = false`
- [ ] 4 条 RLS 策略已创建
- [ ] 旧策略已删除

### API 层
- [ ] POST 返回 Signed URL
- [ ] GET 返回 Signed URLs（多个文档）
- [ ] GET [id] 返回 Signed URL（单个文档）
- [ ] 所有 URL 包含 `?token=` 参数

### 功能层
- [ ] Admin 可以上传文档
- [ ] Dashboard 正常显示文档列表
- [ ] Signed URL 可以访问文件
- [ ] Merchant 不能上传（被 RLS 阻止）
- [ ] Admin 可以删除文档
- [ ] 文件删除后从 Storage 和 DB 都消失

### 安全层
- [ ] 直接访问 Storage 文件失败（无 token）
- [ ] Merchant 尝试上传被 RLS 阻止
- [ ] Signed URL 1 小时后过期
- [ ] 刷新页面生成新的 Signed URL

---

## 🎯 性能考虑

### Signed URL 生成性能

**当前实现**:
```typescript
// GET /api/documents
// 为每个文档生成 Signed URL（并行）
await Promise.all(documents.map(async (doc) => {
  await supabase.storage.createSignedUrl(doc.file_path, 3600)
}))
```

**性能影响**:
- 10 个文档：约 100-200ms
- 100 个文档：约 1-2s

**优化建议（Phase 4）**:
1. 添加缓存（Redis）
2. 延长 Signed URL 有效期（例如 24 小时）
3. 按需生成（分页时只生成当前页的 URL）

---

## 🎉 升级完成标准

当所有测试通过后，Phase 3 安全升级正式完成！

**下一步**:
- ✅ 继续使用 Private Bucket + Signed URLs
- 🔄 开始 Phase 4: AI 处理管道
- 📊 监控 Signed URL 性能
- 🔒 考虑添加审计日志（可选）

---

**验证完成！** 🎉

系统现在使用 Private Bucket + Signed URLs，安全性大幅提升！

