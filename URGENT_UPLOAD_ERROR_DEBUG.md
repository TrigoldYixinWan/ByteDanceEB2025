# 🚨 紧急调试：文件上传错误

**错误**: `❌ 上传失败: {}`  
**日期**: 2025-12-11

---

## 🔍 错误分析

### 错误信息
```
❌ 上传失败: {}
文件上传失败
```

**问题**: `errorData` 是空对象 `{}`，说明 API 返回了错误状态码，但响应体可能：
1. 不是 JSON 格式
2. 是空的
3. API 抛出了异常

---

## 🛠️ 立即检查的事项

### 检查 1: 您是否执行了 SQL 脚本？

**⚠️ 重要**: 如果您**还没有**执行 `UPGRADE_TO_PRIVATE_BUCKET.sql`，请**暂时不要执行**！

**原因**: 
- 我们升级到了 Private Bucket + Signed URLs
- 但如果 SQL 没有执行，Bucket 仍然是 Public
- API 代码期望 Private Bucket，会导致冲突

---

### 检查 2: 查看详细错误信息

我已经更新了上传页面，添加了详细的调试日志。

**请执行以下操作**:

1. 刷新 `/admin/upload` 页面
2. 打开浏览器 DevTools（F12）
3. 切换到 **Console** 标签
4. 尝试重新上传文件
5. 查看 Console 中的错误信息

**新的日志应该显示**:
```
📤 开始上传文件: { ... }
❌ HTTP Error: 500 Internal Server Error
📄 Response Text: { "error": "具体错误信息" }
❌ 上传失败: { error: "具体错误信息" }
```

**请把这些详细的错误信息发给我！**

---

### 检查 3: 查看 Network 请求详情

**在 DevTools → Network 标签**:

1. 清除之前的请求（垃圾桶图标）
2. 尝试上传文件
3. 找到 `POST /api/documents` 请求
4. 点击查看详情

**检查以下信息**:
- **Status Code**: 是 400? 500? 还是其他?
- **Response**: 完整的错误响应
- **Headers**: 有没有 CORS 或其他错误

**请截图或复制这些信息！**

---

## 🔧 可能的原因和解决方案

### 原因 1: RLS 策略冲突（最可能）

**症状**: 
- 上传请求被 RLS 阻止
- 返回 403 或 500 错误

**原因**:
- SQL 脚本已执行（Bucket 变为 Private）
- 但当前用户可能不是 Admin
- 或 RLS 策略配置有问题

**解决方案**:

#### 方案 A: 验证当前用户角色

```sql
-- 在 Supabase SQL Editor 中运行
SELECT 
  id,
  role,
  full_name,
  (SELECT email FROM auth.users WHERE id = profiles.id) as email
FROM profiles 
WHERE id = auth.uid();
```

**如果 role 不是 'admin'**:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE id = auth.uid();
```

---

#### 方案 B: 临时回滚到 Public Bucket

如果需要紧急恢复功能：

```sql
-- 临时回滚到 Public Bucket
UPDATE storage.buckets SET public = true WHERE id = 'documents';

-- 删除 Private 策略
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can update files" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete files" ON storage.objects;

-- 恢复简单的 Public 策略
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING ( bucket_id = 'documents' );

CREATE POLICY "Authenticated users can upload" ON storage.objects 
FOR INSERT WITH CHECK ( 
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
);
```

**然后修改 API 代码回到 Public URL**:
```typescript
// app/api/documents/route.ts

// 临时改回 Public URL
const { data: { publicUrl } } = supabase.storage
  .from('documents')
  .getPublicUrl(filePath)

// 注释掉 Signed URL 代码
// const { data: signedUrlData } = await supabase.storage...
```

---

### 原因 2: API 代码错误

**症状**: 
- API 抛出异常
- 返回 500 错误

**调试步骤**:

1. 查看服务器终端（运行 `npm run dev` 的终端）
2. 查找错误堆栈信息
3. 可能的错误：
   - `createSignedUrl is not a function`
   - `TypeError: Cannot read property...`

**解决方案**: 
- 请复制服务器终端的错误信息
- 我将根据错误信息修复代码

---

### 原因 3: Bucket 不存在

**症状**: 
- "Bucket 'documents' not found"

**解决方案**:
```sql
-- 检查 Bucket 是否存在
SELECT * FROM storage.buckets WHERE id = 'documents';

-- 如果不存在，创建
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);
```

---

### 原因 4: .env.local 配置问题

**检查环境变量**:

```bash
# 查看 .env.local
cat merchant-kb/.env.local
```

**必须包含**:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**验证**:
- ✅ URL 不是占位符
- ✅ KEY 是完整的（很长的字符串）
- ✅ 没有多余的引号或空格

---

## 🔄 推荐的调试流程

### 步骤 1: 收集完整的错误信息

**刷新页面后，重新上传，查看 Console**:

应该看到类似：
```
📤 开始上传文件: { ... }
❌ HTTP Error: 500 Internal Server Error
📄 Response Text: { "error": "xxxxx", "details": "xxxxx" }
❌ 上传失败: { error: "xxxxx" }
```

**请复制完整的错误信息给我！**

---

### 步骤 2: 检查服务器终端

**在运行 `npm run dev` 的终端中查找错误**:

可能看到：
```
Error in POST /api/documents:
  at ...
  ReferenceError: xxx is not defined
  TypeError: Cannot read property 'xxx' of undefined
```

**请复制服务器端的错误信息！**

---

### 步骤 3: 检查 Bucket 配置

```sql
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets 
WHERE id = 'documents';
```

**告诉我**:
- Bucket 是否存在？
- `public` 字段是 `true` 还是 `false`？

---

### 步骤 4: 检查用户角色

```sql
SELECT 
  p.id,
  p.role,
  p.full_name,
  u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'your@email.com'; -- 替换为您的邮箱
```

**告诉我**:
- 您的 `role` 是什么？

---

## 🚑 紧急修复方案

### 快速修复 1: 回滚 API 代码（使用 Public URL）

如果您还**没有执行 SQL 脚本**，API 代码期望 Private Bucket，但 Bucket 仍是 Public，会导致冲突。

**临时解决方案**：我先把 API 改回使用 Public URL

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">merchant-kb/app/api/documents/route.ts
