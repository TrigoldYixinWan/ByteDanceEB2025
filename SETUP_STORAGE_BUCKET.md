# 📦 Supabase Storage Bucket 设置指南

## 目标
创建一个名为 `documents` 的 Storage Bucket 用于存储上传的文档（PDF, TXT, MD）。

---

## 方法 1: 通过 Supabase Dashboard (推荐)

### 步骤 1: 访问 Storage 页面
1. 登录 Supabase Dashboard: https://supabase.com/dashboard
2. 选择您的项目
3. 在左侧菜单点击 **Storage**

### 步骤 2: 创建 Bucket
1. 点击 **"New bucket"** 按钮
2. 填写配置：
   ```
   Name: documents
   Public bucket: ✅ 勾选（开发模式，稍后可以改为私有）
   File size limit: 52428800 (50MB)
   Allowed MIME types: application/pdf,text/plain,text/markdown
   ```
3. 点击 **"Create bucket"**

### 步骤 3: 配置访问策略 (RLS)

如果您勾选了 "Public bucket"，系统会自动创建以下策略：
```sql
-- 允许所有人读取
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'documents' );

-- 允许认证用户上传
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK ( 
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
);

-- 允许认证用户删除自己上传的文件
CREATE POLICY "Users can delete own uploads"
ON storage.objects FOR DELETE
USING ( 
  bucket_id = 'documents' 
  AND auth.uid() = owner 
);
```

**⚠️ 临时开发策略（允许所有认证用户删除任何文件）**:
```sql
-- 临时：允许所有认证用户删除任何文件
DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;

CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING ( 
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
);
```

---

## 方法 2: 通过 SQL (高级)

在 Supabase SQL Editor 中执行：

```sql
-- 1. 创建 bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true);

-- 2. 设置访问策略
-- SELECT 策略（公开读取）
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'documents' );

-- INSERT 策略（认证用户可上传）
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK ( 
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
);

-- DELETE 策略（认证用户可删除）
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING ( 
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
);

-- UPDATE 策略（认证用户可更新）
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING ( 
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
);
```

---

## 验证 Bucket 是否创建成功

### 方法 1: Dashboard 检查
1. 在 Storage 页面查看是否有 `documents` bucket
2. 尝试手动上传一个测试文件

### 方法 2: SQL 查询
```sql
SELECT * FROM storage.buckets WHERE id = 'documents';
```

应该返回：
```
id         | name      | owner | public | created_at
-----------|-----------|-------|--------|------------
documents  | documents | null  | true   | 2024-...
```

### 方法 3: API 测试（在浏览器控制台）
```javascript
const { createClient } = supabaseClient // 假设已初始化

const { data, error } = await supabase
  .storage
  .from('documents')
  .list()

console.log('Buckets:', data, error)
```

---

## 文件命名规范

在代码中，我们将使用以下命名格式：
```
{userId}/{timestamp}-{sanitizedFileName}

例如:
550e8400-e29b-41d4-a716-446655440000/1702345678000-merchant-guide.pdf
```

这样可以：
- ✅ 避免文件名冲突
- ✅ 追踪上传者
- ✅ 保持文件名可读性

---

## 获取文件的公开 URL

```typescript
const { data } = supabase
  .storage
  .from('documents')
  .getPublicUrl('path/to/file.pdf')

console.log(data.publicUrl)
// https://<project-ref>.supabase.co/storage/v1/object/public/documents/path/to/file.pdf
```

---

## 下一步

完成 Storage Bucket 设置后，继续执行 Phase 3 的 API 开发。

**⚠️ 重要**: 请在实施 API 之前确认 `documents` bucket 已创建成功。

