# 📋 Phase 3 技术设计审查文档

**文档日期**: 2025-12-11  
**阶段**: Phase 3 - Document Management  
**状态**: ⚠️ 已实施，等待审查和批准

---

## ⚠️ 重要：Phase 3 已经实施完成

在之前的对话中，Phase 3 已经完成实施（包括 API Routes、Upload Page 和 Dashboard 集成）。本文档总结当前的技术实施方案，并根据您的偏好提供改进建议。

---

## 📑 目录

1. [Storage Strategy & Security](#1-storage-strategy--security)
2. [Upload Transaction Logic](#2-upload-transaction-logic)
3. [API Response Structure](#3-api-response-structure)
4. [技术架构图](#技术架构图)
5. [改进建议](#改进建议)
6. [决策表](#决策表)
7. [下一步行动](#下一步行动)

---

## 1. Storage Strategy & Security

### ✅ 当前实施方案

#### Bucket 配置
```yaml
Bucket Name: "documents"
Public/Private: Public ⚠️ (MVP 快速开发)
File Size Limit: 50MB
Allowed MIME Types: application/pdf, text/plain, text/markdown
```

#### 文件路径结构
```
{userId}/{timestamp}-{sanitizedFileName}

示例:
550e8400-e29b-41d4-a716-446655440000/1702345678000-merchant-guide.pdf
```

**设计理由**:
- ✅ 避免文件名冲突（使用时间戳）
- ✅ 按用户隔离文件（使用 userId）
- ✅ 保持文件名可读性（sanitized 原始文件名）

#### 当前的 RLS 策略

```sql
-- 公开读取（任何人都可以访问）
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'documents' );

-- 认证用户可上传
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK ( 
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
);

-- 认证用户可删除
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING ( 
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
);
```

**当前策略的问题**:
- ⚠️ 任何人都可以访问文件（只要知道 URL）
- ⚠️ 所有认证用户都可以上传/删除（不区分 Admin/Merchant）
- ⚠️ 缺少审计追踪

---

### 🎯 您的偏好分析

您提到：
> "Since these are business documents, I prefer Private Buckets with Signed URLs or Proxy downloads."

**我完全同意！** 商业文档应该有更严格的访问控制。

### 🔒 推荐方案对比

#### 方案 A: Public Bucket（当前实现）

**优势**:
- ✅ 实现简单
- ✅ 性能最佳（直接访问）
- ✅ 无需额外 API 调用

**劣势**:
- ❌ 安全性低（任何人可访问）
- ❌ 无法撤销访问权限
- ❌ 无法追踪谁访问了文件

**适用场景**: MVP 快速验证、公开文档

---

#### 方案 B: Private Bucket + Signed URLs（推荐）

**优势**:
- ✅ **安全性高**：文件不可直接访问
- ✅ **临时访问**：URL 有过期时间（例如 1 小时）
- ✅ **访问控制**：可以按用户/角色生成不同权限的 URL
- ✅ **可撤销**：更改权限后旧 URL 失效

**劣势**:
- ⚠️ 需要每次生成 Signed URL（轻微性能开销）
- ⚠️ 实现稍复杂（需要额外 API 端点）

**适用场景**: **生产环境推荐**，商业文档、敏感信息

**实现示例**:
```typescript
// 生成 1 小时有效的 Signed URL
const { data: signedUrl, error } = await supabase.storage
  .from('documents')
  .createSignedUrl(filePath, 3600) // 3600 秒 = 1 小时

// 返回: 
// https://xxx.supabase.co/storage/v1/object/sign/documents/path?token=xxx
```

---

#### 方案 C: Private Bucket + Proxy Download（最高安全）

**优势**:
- ✅ **最高安全性**：完全控制访问
- ✅ **完整审计**：记录每次下载
- ✅ **动态权限检查**：每次下载时验证权限
- ✅ **可以添加额外逻辑**（如水印、日志）

**劣势**:
- ❌ 性能最差（需要代理所有流量）
- ❌ 实现最复杂
- ❌ 服务器带宽消耗大

**适用场景**: 极高安全需求、需要详细审计的场景

**实现示例**:
```typescript
// app/api/documents/[id]/download/route.ts

export async function GET(request, { params }) {
  // 1. 验证用户权限
  const hasPermission = await checkUserPermission(user, documentId)
  if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  
  // 2. 从 Storage 下载文件
  const { data: fileBlob } = await supabase.storage
    .from('documents')
    .download(filePath)
  
  // 3. 记录审计日志
  await logDownload(user.id, documentId)
  
  // 4. 返回文件流
  return new NextResponse(fileBlob, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
```

---

### 📊 方案对比表

| 维度 | Public Bucket | Private + Signed URL | Private + Proxy |
|------|--------------|---------------------|-----------------|
| **安全性** | ⚠️ 低 | ✅ 高 | ✅ 最高 |
| **性能** | ✅ 最快 | ✅ 快 | ⚠️ 慢 |
| **实现复杂度** | ✅ 简单 | ⚠️ 中等 | ❌ 复杂 |
| **服务器负载** | ✅ 无 | ✅ 低 | ❌ 高 |
| **审计追踪** | ❌ 无 | ⚠️ 有限 | ✅ 完整 |
| **访问控制** | ❌ 无 | ✅ 时间限制 | ✅ 动态检查 |
| **成本** | ✅ 最低 | ✅ 低 | ⚠️ 中等 |
| **推荐场景** | MVP 测试 | **生产环境** | 极高安全需求 |

---

### 🎯 我的推荐

**阶段性策略**:

```
Phase 3 (当前): Public Bucket
  ↓ (快速开发和测试)
  
Phase 3.5 (您批准后): Private Bucket + Signed URLs ⭐
  ↓ (生产环境)
  
Phase 5 (可选): Private Bucket + Proxy Download
  ↓ (如果需要更严格的审计)
```

**推荐：立即升级到方案 B（Private + Signed URL）**

理由：
1. ✅ 安全性大幅提升
2. ✅ 性能影响很小
3. ✅ 实现成本可接受（约 2 小时）
4. ✅ 符合商业文档的安全要求

---

## 2. Upload Transaction Logic

### ✅ 当前实施方案

#### 上传方式：Server-side Upload（通过 API Route）

```
Client → API Route → Supabase Storage
  ↓                      ↓
  |                   Supabase DB
  |                      ↓
  └──────────────────────┘
```

#### 详细流程

```typescript
// app/api/documents/route.ts

POST /api/documents

┌─────────────────────────────────────────────────────────┐
│ 步骤 1: 验证用户认证                                     │
├─────────────────────────────────────────────────────────┤
│ const { data: { user }, error } = await supabase.auth.getUser() │
│                                                          │
│ if (error || !user) {                                   │
│   return NextResponse.json({ error: '未授权' }, 401)    │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 步骤 2: 验证文件                                         │
├─────────────────────────────────────────────────────────┤
│ ✅ 文件类型: ['application/pdf', 'text/plain', ...]    │
│ ✅ 文件大小: <= 50MB                                    │
│ ✅ 必填字段: title, category                            │
│                                                          │
│ if (!allowedTypes.includes(file.type)) {               │
│   return NextResponse.json({ error: '文件类型不支持' }) │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 步骤 3: 生成唯一文件路径                                │
├─────────────────────────────────────────────────────────┤
│ const timestamp = Date.now()                            │
│ const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-') │
│ const filePath = `${user.id}/${timestamp}-${sanitizedFileName}` │
│                                                          │
│ 示例: "uuid/1702345678000-merchant-guide.pdf"          │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 步骤 4: 上传文件到 Supabase Storage                     │
├─────────────────────────────────────────────────────────┤
│ const { data: uploadData, error: uploadError } =       │
│   await supabase.storage                                │
│     .from('documents')                                  │
│     .upload(filePath, file, {                           │
│       contentType: file.type,                           │
│       cacheControl: '3600',                             │
│       upsert: false  // 不覆盖已存在文件               │
│     })                                                   │
│                                                          │
│ if (uploadError) {                                      │
│   return NextResponse.json({ error: '上传失败' }, 500)  │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 步骤 5: 获取文件 URL                                     │
├─────────────────────────────────────────────────────────┤
│ // 当前: Public URL                                     │
│ const { data: { publicUrl } } =                         │
│   supabase.storage.from('documents').getPublicUrl(filePath) │
│                                                          │
│ // 推荐: Signed URL (Private Bucket)                    │
│ const { data: signedUrl } =                             │
│   await supabase.storage.from('documents')              │
│     .createSignedUrl(filePath, 3600)                    │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 步骤 6: 插入数据库记录                                   │
├─────────────────────────────────────────────────────────┤
│ const { data: document, error: dbError } =              │
│   await supabase.from('documents').insert({             │
│     title,                                              │
│     category,                                           │
│     subcategory,                                        │
│     content_type: file.type,                            │
│     source_url: publicUrl,                              │
│     file_path: filePath,                                │
│     status: 'pending'  // 待处理状态                    │
│   }).select().single()                                  │
│                                                          │
│ if (dbError) {                                          │
│   // ⚠️ 关键: 回滚 - 删除已上传的文件                   │
│   await supabase.storage.from('documents').remove([filePath]) │
│   return NextResponse.json({ error: 'DB插入失败' }, 500) │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 步骤 7: 返回成功响应                                     │
├─────────────────────────────────────────────────────────┤
│ return NextResponse.json({                              │
│   message: '文档上传成功',                              │
│   document: { id, title, status, ... }                  │
│ }, { status: 201 })                                     │
└─────────────────────────────────────────────────────────┘
```

---

### 🔄 一致性保证机制

#### 场景 1: 文件上传成功，数据库插入失败

```typescript
✅ 已处理: 自动回滚（删除已上传的文件）

if (dbError) {
  console.error('Database insert error:', dbError)
  
  // 回滚：删除 Storage 中的文件
  await supabase.storage.from('documents').remove([filePath])
  
  return NextResponse.json(
    { error: '创建文档记录失败', details: dbError.message },
    { status: 500 }
  )
}
```

**测试验证**:
```bash
# 模拟 DB 插入失败
# 1. 上传文件成功
# 2. DB 插入报错
# 3. Storage 文件自动删除
# 结果: 无孤立文件
```

---

#### 场景 2: 文件上传失败

```typescript
✅ 已处理: 立即返回错误，不执行后续步骤

if (uploadError) {
  console.error('Storage upload error:', uploadError)
  return NextResponse.json(
    { error: '文件上传失败', details: uploadError.message },
    { status: 500 }
  )
}

// DB 插入不会执行
```

---

#### 场景 3: 回滚删除失败（极端情况）

```typescript
⚠️ 当前未完全处理

if (dbError) {
  const { error: deleteError } = await supabase.storage
    .from('documents')
    .remove([filePath])
  
  if (deleteError) {
    // 删除失败 → Storage 有孤立文件
    console.error('Rollback failed:', deleteError)
    // TODO: 记录到错误表，稍后清理
  }
}
```

**问题**: 
- Storage 有文件
- DB 无记录
- 浪费存储空间

**解决方案**: 定期清理任务（Phase 4）

```typescript
// app/api/cron/cleanup-orphaned-files/route.ts

export async function GET() {
  // 1. 列出 Storage 所有文件
  const { data: files } = await supabase.storage
    .from('documents')
    .list()
  
  // 2. 查询 DB 中的文件路径
  const { data: dbFiles } = await supabase
    .from('documents')
    .select('file_path')
  
  // 3. 找出孤立文件
  const orphanedFiles = files.filter(f => 
    !dbFiles.some(d => d.file_path === f.name)
  )
  
  // 4. 删除孤立文件
  if (orphanedFiles.length > 0) {
    await supabase.storage
      .from('documents')
      .remove(orphanedFiles.map(f => f.name))
  }
  
  return NextResponse.json({ cleaned: orphanedFiles.length })
}
```

---

### 🎯 上传方式对比：Client vs Server

#### 方案 A: Server-side Upload（当前实现）

**流程**:
```
Client → API Route → Storage + DB
```

**优势**:
- ✅ **更好的验证**: 在服务器端验证文件类型、大小
- ✅ **统一的错误处理**: 所有逻辑在一个地方
- ✅ **更好的一致性**: 事务性操作（上传 + DB 插入）
- ✅ **安全性**: 客户端不需要直接访问 Storage
- ✅ **审计**: 记录所有上传操作

**劣势**:
- ⚠️ **服务器负载**: 文件需要经过服务器
- ⚠️ **上传速度**: 比直接上传略慢
- ⚠️ **带宽消耗**: 服务器需要中转文件

**适用场景**:
- ✅ MVP 阶段（当前）
- ✅ 需要严格验证
- ✅ 需要事务一致性
- ✅ 上传量不大（< 1000 次/天）

---

#### 方案 B: Client-side Upload

**流程**:
```
Client → Storage (直接)
  ↓
API Route → DB only
```

**优势**:
- ✅ **上传速度快**: 直接上传到 Storage
- ✅ **服务器负载低**: 不经过服务器
- ✅ **可以显示真实进度**: XMLHttpRequest 支持进度监听

**劣势**:
- ❌ **一致性难保证**: 文件已上传，但 DB 插入可能失败
- ❌ **需要客户端 Storage 权限**: RLS 策略更复杂
- ❌ **验证在客户端**: 可能被绕过
- ❌ **难以回滚**: 客户端无法删除已上传的文件

**实现示例**:
```typescript
// 客户端代码
const { data, error } = await supabase.storage
  .from('documents')
  .upload(filePath, file, {
    onUploadProgress: (progress) => {
      setProgress(progress.loaded / progress.total * 100)
    }
  })

// 上传成功后，调用 API 创建 DB 记录
if (!error) {
  await fetch('/api/documents', {
    method: 'POST',
    body: JSON.stringify({
      file_path: filePath,
      title,
      category
    })
  })
}
```

**一致性问题**:
```
1. 客户端上传文件成功
2. 调用 API 创建 DB 记录
3. 如果 API 失败 → 孤立文件（客户端无法删除）
```

**适用场景**:
- 高并发上传（> 10000 次/天）
- 大文件上传（> 100MB）
- 需要实时进度条

---

### 📊 上传方式对比表

| 维度 | Server Upload | Client Upload |
|------|--------------|---------------|
| **一致性保证** | ✅ 强 | ⚠️ 弱 |
| **上传速度** | ⚠️ 中等 | ✅ 快 |
| **服务器负载** | ⚠️ 高 | ✅ 低 |
| **安全性** | ✅ 高 | ⚠️ 中等 |
| **实现复杂度** | ✅ 简单 | ⚠️ 复杂 |
| **错误处理** | ✅ 统一 | ⚠️ 分散 |
| **真实进度** | ❌ 难 | ✅ 容易 |
| **推荐场景** | **MVP, 中小规模** | 高并发 |

---

### 🎯 我的推荐

**当前阶段（Phase 3）**: 
- ✅ **保持 Server Upload**
- 理由：一致性 > 性能，MVP 阶段上传量不大

**未来优化（Phase 5+）**:
- 🔄 **考虑 Client Upload**
- 条件：如果上传量 > 1000次/天 或 文件 > 50MB

**混合方案**:
```typescript
// 小文件 (< 10MB): Server Upload
// 大文件 (> 10MB): Client Upload with resumable upload

if (file.size < 10 * 1024 * 1024) {
  await serverUpload(file)
} else {
  await clientUpload(file)
}
```

---

## 3. API Response Structure

### ✅ 当前实施的接口定义

#### GET /api/documents

**用途**: 获取所有文档列表（管理员视图）

**请求**:
```http
GET /api/documents
Authorization: Bearer {supabase_token}
```

**响应接口**:
```typescript
interface GetDocumentsResponse {
  documents: Document[]
  total: number
}

interface Document {
  id: string              // UUID
  title: string           // 文档标题
  category: string        // 文档类别
  subcategory: string | null  // 子类别（可选）
  contentType: string     // MIME 类型
  sourceUrl: string       // 文件访问 URL
  filePath: string        // Storage 路径
  status: DocumentStatus  // 文档状态
  citationCount: number   // 引用次数
  createdAt: string       // ISO 8601 时间戳
  updatedAt: string       // ISO 8601 时间戳
}

type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed'
```

**实际响应示例**:
```json
{
  "documents": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "title": "商户入驻指南",
      "category": "招商入驻",
      "subcategory": "新手指南",
      "contentType": "application/pdf",
      "sourceUrl": "https://xxx.supabase.co/storage/v1/object/public/documents/user-id/123-guide.pdf",
      "filePath": "user-id/1702345678000-guide.pdf",
      "status": "pending",
      "citationCount": 0,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "title": "商品管理规则",
      "category": "商品管理",
      "subcategory": null,
      "contentType": "application/pdf",
      "sourceUrl": "https://xxx.supabase.co/storage/v1/object/public/documents/user-id/124-rules.pdf",
      "filePath": "user-id/1702345678001-rules.pdf",
      "status": "ready",
      "citationCount": 15,
      "createdAt": "2024-01-14T10:00:00Z",
      "updatedAt": "2024-01-14T12:30:00Z"
    }
  ],
  "total": 2
}
```

**错误响应**:
```json
{
  "error": "未授权访问",
  "details": "User not authenticated"
}
```

**HTTP 状态码**:
- `200 OK`: 成功
- `401 Unauthorized`: 未登录
- `500 Internal Server Error`: 服务器错误

---

#### POST /api/documents

**用途**: 上传新文档

**请求**:
```http
POST /api/documents
Content-Type: multipart/form-data
Authorization: Bearer {supabase_token}

FormData:
- file: File (必填)
- title: string (必填)
- category: string (必填)
- subcategory: string (可选)
```

**请求示例（代码）**:
```typescript
const formData = new FormData()
formData.append('file', file)
formData.append('title', '商户入驻指南')
formData.append('category', '招商入驻')
formData.append('subcategory', '新手指南')

const response = await fetch('/api/documents', {
  method: 'POST',
  body: formData
})
```

**响应接口**:
```typescript
interface PostDocumentResponse {
  message: string
  document: Document
}
```

**成功响应示例**:
```json
{
  "message": "文档上传成功",
  "document": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "title": "商户入驻指南",
    "category": "招商入驻",
    "subcategory": "新手指南",
    "contentType": "application/pdf",
    "sourceUrl": "https://xxx.supabase.co/storage/v1/object/public/documents/...",
    "filePath": "user-id/1702345678002-guide.pdf",
    "status": "pending",
    "createdAt": "2024-01-15T14:30:00Z",
    "updatedAt": "2024-01-15T14:30:00Z"
  }
}
```

**错误响应示例**:
```json
{
  "error": "不支持的文件类型: image/png。仅支持 PDF, TXT, MD",
  "details": "Invalid file type"
}
```

**HTTP 状态码**:
- `201 Created`: 上传成功
- `400 Bad Request`: 验证失败（文件类型、大小、必填字段）
- `401 Unauthorized`: 未登录
- `500 Internal Server Error`: 上传失败

---

#### DELETE /api/documents/[id]

**用途**: 删除文档（仅 Admin）

**请求**:
```http
DELETE /api/documents/{documentId}
Authorization: Bearer {supabase_token}
```

**响应接口**:
```typescript
interface DeleteDocumentResponse {
  message: string
  id: string
}
```

**成功响应示例**:
```json
{
  "message": "文档删除成功",
  "id": "550e8400-e29b-41d4-a716-446655440001"
}
```

**错误响应示例**:
```json
{
  "error": "权限不足：仅管理员可删除文档"
}
```

**HTTP 状态码**:
- `200 OK`: 删除成功
- `401 Unauthorized`: 未登录
- `403 Forbidden`: 权限不足（非 Admin）
- `404 Not Found`: 文档不存在
- `500 Internal Server Error`: 删除失败

---

#### GET /api/documents/[id]

**用途**: 获取单个文档详情

**请求**:
```http
GET /api/documents/{documentId}
Authorization: Bearer {supabase_token}
```

**响应接口**:
```typescript
interface GetDocumentResponse {
  document: Document
}
```

**成功响应示例**:
```json
{
  "document": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "title": "商户入驻指南",
    "category": "招商入驻",
    "subcategory": "新手指南",
    "contentType": "application/pdf",
    "sourceUrl": "https://...",
    "filePath": "user-id/file.pdf",
    "status": "ready",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

**HTTP 状态码**:
- `200 OK`: 成功
- `401 Unauthorized`: 未登录
- `404 Not Found`: 文档不存在

---

### 📊 完整的 TypeScript 类型定义

```typescript
// types/api.ts

/**
 * 文档状态
 * - pending: 已上传，待处理
 * - processing: 正在处理（chunk + 向量化）
 * - ready: 处理完成，可用于 RAG
 * - failed: 处理失败
 */
export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed'

/**
 * 文档对象（前端格式，camelCase）
 */
export interface Document {
  id: string
  title: string
  category: string
  subcategory: string | null
  contentType: string
  sourceUrl: string
  filePath: string
  status: DocumentStatus
  citationCount: number
  createdAt: string
  updatedAt: string
}

/**
 * GET /api/documents 响应
 */
export interface GetDocumentsResponse {
  documents: Document[]
  total: number
}

/**
 * POST /api/documents 响应
 */
export interface PostDocumentResponse {
  message: string
  document: Document
}

/**
 * DELETE /api/documents/[id] 响应
 */
export interface DeleteDocumentResponse {
  message: string
  id: string
}

/**
 * GET /api/documents/[id] 响应
 */
export interface GetDocumentResponse {
  document: Document
}

/**
 * API 错误响应
 */
export interface ApiError {
  error: string
  details?: string
}
```

---

### 🔄 数据转换逻辑

由于数据库使用 `snake_case`，前端使用 `camelCase`，需要进行转换：

```typescript
// API 中的转换函数
function transformDocument(dbDoc: DbDocument): Document {
  return {
    id: dbDoc.id,
    title: dbDoc.title,
    category: dbDoc.category,
    subcategory: dbDoc.subcategory,
    contentType: dbDoc.content_type,
    sourceUrl: dbDoc.source_url,
    filePath: dbDoc.file_path,
    status: dbDoc.status,
    citationCount: 0, // TODO: 从 document_chunks 聚合
    createdAt: dbDoc.created_at,
    updatedAt: dbDoc.updated_at,
  }
}

// 使用示例
const { data: documents } = await supabase
  .from('documents')
  .select('*')

const formattedDocuments = documents.map(transformDocument)
```

---

## 📐 技术架构图

### 完整架构流程

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Admin UI)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  app/admin/upload/page.tsx                             │ │
│  │                                                         │ │
│  │  1. 用户选择/拖放文件                                   │ │
│  │  2. 显示文件预览（名称、大小、类型）                    │ │
│  │  3. 填写表单（标题、类别、子类别）                      │ │
│  │  4. 点击"上传文档"按钮                                 │ │
│  │  5. 显示上传进度条 (0% → 100%)                         │ │
│  │  6. 显示成功消息                                        │ │
│  │  7. 3秒后跳转到 Dashboard                              │ │
│  └────────────────┬───────────────────────────────────────┘ │
└───────────────────┼─────────────────────────────────────────┘
                    │
                    │ HTTP POST
                    │ /api/documents
                    │ Content-Type: multipart/form-data
                    │ Authorization: Bearer {token}
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                 API Route (Next.js Server)                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  app/api/documents/route.ts                            │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ Step 1: Auth验证                                 │ │ │
│  │  │ supabase.auth.getUser()                          │ │ │
│  │  │ ✅ 验证用户是否登录                              │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                    ↓                                    │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ Step 2: 文件验证                                 │ │ │
│  │  │ ✅ 类型: PDF/TXT/MD                              │ │ │
│  │  │ ✅ 大小: <= 50MB                                 │ │ │
│  │  │ ✅ 必填: title, category                         │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                    ↓                                    │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ Step 3: 生成路径                                 │ │ │
│  │  │ {userId}/{timestamp}-{fileName}                  │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                    ↓                                    │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ Step 4: 上传到 Storage ─────────────────────┐   │ │ │
│  │  │ supabase.storage.from('documents').upload()  │   │ │ │
│  │  └──────────────────────────────────────────────│───┘ │ │
│  │                    ↓                             │     │ │
│  │  ┌──────────────────────────────────────────────│───┐ │ │
│  │  │ Step 5: 获取 URL                             │   │ │ │
│  │  │ getPublicUrl() / createSignedUrl()           │   │ │ │
│  │  └──────────────────────────────────────────────│───┘ │ │
│  │                    ↓                             │     │ │
│  │  ┌──────────────────────────────────────────────│───┐ │ │
│  │  │ Step 6: 插入 DB ──────────────────────────┐  │   │ │ │
│  │  │ supabase.from('documents').insert()        │  │   │ │ │
│  │  │                                             │  │   │ │ │
│  │  │ ⚠️ 如果失败 → 回滚 Storage                 │  │   │ │ │
│  │  └─────────────────────────────────────────────┼──┼───┘ │ │
│  │                    ↓                             │  │     │ │
│  │  ┌──────────────────────────────────────────────│──│───┐ │ │
│  │  │ Step 7: 返回响应                             │  │   │ │ │
│  │  │ { message, document }                        │  │   │ │ │
│  │  └──────────────────────────────────────────────┼──┼───┘ │ │
│  └────────────────────────────────────────────────┼──┼─────┘ │
└───────────────────────────────────────────────────┼──┼───────┘
                                                     │  │
                    ┌────────────────────────────────┘  │
                    │                                    │
                    ▼                                    ▼
┌──────────────────────────────────┐ ┌──────────────────────────────────┐
│    Supabase Storage              │ │    Supabase Database             │
│  ┌────────────────────────────┐  │ │  ┌────────────────────────────┐  │
│  │  Bucket: "documents"       │  │ │  │  Table: "documents"        │  │
│  │                            │  │ │  │                            │  │
│  │  Public/Private: 🔓/🔒    │  │ │  │  Columns:                  │  │
│  │                            │  │ │  │  - id (UUID, PK)           │  │
│  │  Files:                    │  │ │  │  - title (TEXT)            │  │
│  │  └─ {userId}/              │  │ │  │  - category (TEXT)         │  │
│  │     └─ {timestamp}-{file}  │  │ │  │  - file_path (TEXT)        │  │
│  │                            │  │ │  │  - status (ENUM)           │  │
│  │  RLS Policies:             │  │ │  │  - created_at (TIMESTAMP)  │  │
│  │  - Public Read (当前)      │  │ │  │                            │  │
│  │  - Auth Upload             │  │ │  │  RLS: Enabled              │  │
│  └────────────────────────────┘  │ │  └────────────────────────────┘  │
└──────────────────────────────────┘ └──────────────────────────────────┘
```

---

## 🔧 改进建议

基于您的偏好（Private Bucket + Signed URLs），以下是具体的改进步骤：

### 🔒 改进 1: 切换到 Private Bucket + Signed URLs

#### 步骤 1: 修改 Bucket 配置

**在 Supabase Dashboard 中**:
1. 进入 Storage → documents bucket
2. 点击 Settings（设置）
3. **取消勾选** "Public bucket"
4. 保存

或者**通过 SQL**:
```sql
UPDATE storage.buckets 
SET public = false 
WHERE id = 'documents';
```

---

#### 步骤 2: 更新 RLS 策略

```sql
-- 删除旧策略
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- 新策略 1: 只有认证用户可以查看（通过 Signed URL）
CREATE POLICY "Authenticated users can view files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);

-- 新策略 2: 只有 Admin 可以上传
CREATE POLICY "Only admins can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 新策略 3: 只有 Admin 可以删除
CREATE POLICY "Only admins can delete files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

---

#### 步骤 3: 修改 API - 生成 Signed URLs

**修改 `app/api/documents/route.ts`**:

```typescript
// POST /api/documents

// 修改前（Public URL）
const {
  data: { publicUrl },
} = supabase.storage.from('documents').getPublicUrl(filePath)

// 修改后（Signed URL）
const { data: signedUrlData, error: signedUrlError } = await supabase.storage
  .from('documents')
  .createSignedUrl(filePath, 3600) // 1小时有效期

if (signedUrlError) {
  console.error('Signed URL error:', signedUrlError)
  // 回滚
  await supabase.storage.from('documents').remove([filePath])
  return NextResponse.json({ error: '生成访问链接失败' }, { status: 500 })
}

const sourceUrl = signedUrlData.signedUrl
```

**修改 `app/api/documents/route.ts` (GET)**:

```typescript
// GET /api/documents

const { data: documents, error: dbError } = await supabase
  .from('documents')
  .select('*')
  .order('created_at', { ascending: false })

// 为每个文档生成新的 Signed URL
const documentsWithSignedUrls = await Promise.all(
  documents.map(async (doc) => {
    const { data: signedUrl } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 3600) // 1小时有效期
    
    return {
      ...transformDocument(doc),
      sourceUrl: signedUrl.signedUrl,
    }
  })
)

return NextResponse.json({
  documents: documentsWithSignedUrls,
  total: documentsWithSignedUrls.length,
})
```

---

#### 步骤 4: 添加文件下载 API（可选）

**创建 `app/api/documents/[id]/download/route.ts`**:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // 1. 验证用户认证
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 2. 获取文档信息
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('file_path, content_type, title')
      .eq('id', id)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 })
    }

    // 3. 生成临时 Signed URL（60秒有效）
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.file_path, 60)

    if (urlError) {
      return NextResponse.json({ error: '生成下载链接失败' }, { status: 500 })
    }

    // 4. 记录下载日志（可选）
    // await logDownload(user.id, id)

    // 5. 重定向到 Signed URL
    return NextResponse.redirect(signedUrl.signedUrl)
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
```

**前端使用**:
```typescript
// 点击"下载"按钮
const handleDownload = async (docId: string) => {
  window.open(`/api/documents/${docId}/download`, '_blank')
}
```

---

### 🔐 改进 2: 加强数据库 RLS 策略

```sql
-- documents 表 RLS 策略

-- 所有认证用户可以查看
CREATE POLICY "Authenticated users can view documents"
ON documents FOR SELECT
USING ( auth.role() = 'authenticated' );

-- 只有 Admin 可以插入
CREATE POLICY "Only admins can insert documents"
ON documents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 只有 Admin 可以更新
CREATE POLICY "Only admins can update documents"
ON documents FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 只有 Admin 可以删除
CREATE POLICY "Only admins can delete documents"
ON documents FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

---

### 📊 改进 3: 添加下载审计日志（可选）

**创建审计表**:
```sql
CREATE TABLE document_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  document_id UUID REFERENCES documents(id),
  action TEXT NOT NULL, -- 'view', 'download', 'delete'
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_access_logs_user ON document_access_logs(user_id);
CREATE INDEX idx_document_access_logs_document ON document_access_logs(document_id);
CREATE INDEX idx_document_access_logs_created ON document_access_logs(created_at);
```

**在 API 中记录日志**:
```typescript
async function logDocumentAccess(
  userId: string,
  documentId: string,
  action: string,
  request: NextRequest
) {
  const supabase = await createClient()
  
  await supabase.from('document_access_logs').insert({
    user_id: userId,
    document_id: documentId,
    action,
    ip_address: request.ip || request.headers.get('x-forwarded-for'),
    user_agent: request.headers.get('user-agent'),
  })
}

// 在下载 API 中使用
await logDocumentAccess(user.id, id, 'download', request)
```

---

## 📊 决策表

| 问题 | 当前实现 | 您的偏好 | 推荐方案 | 优先级 |
|------|---------|---------|---------|--------|
| **Bucket 类型** | Public | Private | ✅ 切换到 Private | 🔴 高 |
| **文件访问** | 公开 URL | Signed URL | ✅ 使用 Signed URL | 🔴 高 |
| **上传方式** | Server Upload | - | ✅ 保持 Server Upload | ✅ 保持 |
| **Storage RLS** | 基础（认证用户） | Admin only | ✅ 加强为 Admin only | 🟡 中 |
| **Database RLS** | 基础 | Admin only | ✅ 加强为 Admin only | 🟡 中 |
| **一致性保证** | 回滚机制 | - | ✅ 当前已足够 | ✅ 完成 |
| **审计日志** | 无 | 有 | 🔵 添加（可选） | 🟢 低 |
| **下载 API** | 无 | 有 | 🔵 添加（可选） | 🟢 低 |

---

## 🚀 下一步行动

### 选项 A: 保持当前实现（快速 MVP）

**优势**:
- ✅ 立即可用
- ✅ 无需修改代码
- ✅ 快速验证业务逻辑

**劣势**:
- ⚠️ 安全性较低
- ⚠️ 不适合生产环境

**建议**: 
- 用于开发和测试
- 计划在上线前升级

---

### 选项 B: 立即升级到 Private Bucket（推荐）

**工作量估算**: 
- ⏱️ 约 2-3 小时
- 📝 修改 3 个文件
- 🧪 测试 1 小时

**实施步骤**:
1. ✅ 修改 Bucket 配置（5分钟）
2. ✅ 更新 RLS 策略（15分钟）
3. ✅ 修改 API 代码（1小时）
4. ✅ 测试上传和访问（1小时）
5. ✅ 更新文档（30分钟）

**建议**: 
- ✅ **立即实施**
- 理由：安全性提升大，工作量可接受

---

### 选项 C: 分阶段升级

**Phase 3.1**: 
- ✅ 切换到 Private Bucket + Signed URLs

**Phase 3.2**:
- ✅ 加强 RLS 策略（Admin only）

**Phase 3.3**:
- 🔵 添加下载 API
- 🔵 添加审计日志

---

## ❓ 请您决策

**我需要您的批准以下事项**：

### 1. Storage 策略（必选）

- [ ] **选项 A**: 保持 Public Bucket（当前实现）
  - 优势：无需修改
  - 劣势：安全性低
  
- [ ] **选项 B**: 切换到 Private Bucket + Signed URLs（推荐）
  - 优势：安全性高
  - 劣势：需要 2-3 小时修改

### 2. 上传方式（必选）

- [ ] **选项 A**: 保持 Server Upload（当前实现，推荐）
  - 优势：一致性强，安全性高
  - 劣势：服务器负载略高
  
- [ ] **选项 B**: 改为 Client Upload
  - 优势：上传速度快，服务器负载低
  - 劣势：一致性难保证

### 3. RLS 策略（必选）

- [ ] **选项 A**: 保持基础策略（认证用户）
  - 所有认证用户都可以上传/删除
  
- [ ] **选项 B**: 升级为 Admin only（推荐）
  - 只有 Admin 可以上传/删除
  - Merchant 只能查看

### 4. 附加功能（可选）

- [ ] 添加下载 API（`/api/documents/[id]/download`）
- [ ] 添加审计日志表（记录访问记录）
- [ ] 定期清理孤立文件的 Cron Job

---

## 📝 总结

### ✅ 当前实施状态

| 功能 | 状态 |
|------|------|
| 文件上传 | ✅ 已实现（Server Upload） |
| 文件删除 | ✅ 已实现 |
| 文档列表 | ✅ 已实现 |
| 事务回滚 | ✅ 已实现 |
| Public Bucket | ✅ 已配置 |
| Signed URLs | ❌ 未实现 |
| Admin-only RLS | ❌ 未实现 |
| 审计日志 | ❌ 未实现 |

### 🎯 推荐升级路径

```
当前状态（Phase 3 MVP）
  ↓
立即升级（推荐）
  → Private Bucket + Signed URLs
  → Admin-only RLS
  ↓
可选增强（Phase 4+）
  → 下载 API
  → 审计日志
  → 清理任务
```

---

## 📧 等待您的反馈

请告诉我您的选择：

1. **Storage 策略**: Public 还是 Private？
2. **上传方式**: Server 还是 Client？
3. **RLS 策略**: 基础 还是 Admin-only？
4. **附加功能**: 需要哪些？

确认后，我将立即开始实施！🚀

---

**文档结束**  
如有疑问，请随时提出！

