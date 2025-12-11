# 🚀 Phase 3 实施指南 - 真实文档管理

**状态**: ✅ 实施完成  
**日期**: 2025-12-11  
**目标**: 将 Mock 文档数据替换为真实的 Supabase Storage + Database 集成

---

## 📋 目录

1. [实施概览](#1-实施概览)
2. [前置要求：Storage Bucket 设置](#2-前置要求storage-bucket-设置)
3. [API 实现详情](#3-api-实现详情)
4. [前端集成详情](#4-前端集成详情)
5. [测试步骤](#5-测试步骤)
6. [故障排除](#6-故障排除)
7. [下一步](#7-下一步)

---

## 1. 实施概览

### 已实现的功能

| 功能 | 状态 | 文件 |
|------|------|------|
| **POST /api/documents** | ✅ | `app/api/documents/route.ts` |
| **GET /api/documents** | ✅ | `app/api/documents/route.ts` |
| **DELETE /api/documents/[id]** | ✅ | `app/api/documents/[id]/route.ts` |
| **GET /api/documents/[id]** | ✅ | `app/api/documents/[id]/route.ts` |
| **Admin Dashboard 集成** | ✅ | `app/admin/dashboard/page.tsx` |
| **Upload Page 集成** | ✅ | `app/admin/upload/page.tsx` |

### 架构流程

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 (Admin UI)                          │
│  ┌──────────────────┐          ┌──────────────────┐         │
│  │  Upload Page     │          │  Dashboard Page   │         │
│  │  上传表单         │          │  文档列表         │         │
│  └────────┬─────────┘          └────────┬─────────┘         │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            │ POST /api/documents          │ GET/DELETE /api/documents
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Routes (Next.js)                        │
│  ┌──────────────────────────────────────────────────┐       │
│  │  app/api/documents/route.ts                      │       │
│  │  - POST: 上传文件 + 创建 DB 记录                  │       │
│  │  - GET: 获取文档列表                              │       │
│  └──────────────────────────────────────────────────┘       │
│  ┌──────────────────────────────────────────────────┐       │
│  │  app/api/documents/[id]/route.ts                 │       │
│  │  - DELETE: 删除文件 + DB 记录                     │       │
│  │  - GET: 获取单个文档详情                          │       │
│  └──────────────────────────────────────────────────┘       │
└────────────┬─────────────────────────┬────────────────────────┘
             │                         │
             │ Supabase Client         │
             ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Backend                          │
│  ┌──────────────────┐          ┌──────────────────┐         │
│  │  Storage         │          │  Database        │         │
│  │  Bucket:         │          │  Table:          │         │
│  │  'documents'     │          │  'documents'     │         │
│  └──────────────────┘          └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 前置要求：Storage Bucket 设置

### ⚠️ 重要：在测试 API 之前，必须完成此步骤！

参考文档：`SETUP_STORAGE_BUCKET.md`

### 快速设置（Dashboard 方式）

1. 访问 Supabase Dashboard → **Storage**
2. 点击 **"New bucket"**
3. 配置：
   ```
   Name: documents
   Public bucket: ✅ 勾选
   File size limit: 52428800 (50MB)
   Allowed MIME types: application/pdf,text/plain,text/markdown
   ```
4. 点击 **"Create bucket"**

### 验证 Bucket

在 SQL Editor 中运行：
```sql
SELECT * FROM storage.buckets WHERE id = 'documents';
```

应该返回一行记录。

---

## 3. API 实现详情

### 3.1 POST /api/documents

**功能**: 上传文件到 Storage + 创建 DB 记录

#### 请求
```typescript
// Method: POST
// Content-Type: multipart/form-data

FormData {
  file: File,
  title: string,
  category: string,
  subcategory?: string
}
```

#### 流程
1. ✅ 验证用户是否已登录
2. ✅ 验证文件类型（PDF/TXT/MD）
3. ✅ 验证文件大小（< 50MB）
4. ✅ 生成唯一文件路径：`{userId}/{timestamp}-{fileName}`
5. ✅ 上传文件到 `storage.buckets.documents`
6. ✅ 获取公开 URL
7. ✅ 插入记录到 `documents` 表
8. ✅ 如果 DB 插入失败，回滚（删除已上传的文件）

#### 响应（成功 - 201）
```json
{
  "message": "文档上传成功",
  "document": {
    "id": "uuid",
    "title": "文档标题",
    "category": "快速开始",
    "subcategory": null,
    "contentType": "application/pdf",
    "sourceUrl": "https://<project>.supabase.co/storage/v1/object/public/documents/...",
    "filePath": "user-id/1702345678000-file.pdf",
    "status": "processing",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

#### 响应（错误）
```json
{
  "error": "错误信息",
  "details": "详细错误描述"
}
```

---

### 3.2 GET /api/documents

**功能**: 获取所有文档列表

#### 请求
```typescript
// Method: GET
// No body
```

#### 流程
1. ✅ 验证用户是否已登录
2. ✅ 查询 `documents` 表（按 `created_at` 倒序）
3. ✅ 转换为 camelCase 格式

#### 响应（成功 - 200）
```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "文档标题",
      "category": "快速开始",
      "subcategory": null,
      "contentType": "application/pdf",
      "sourceUrl": "https://...",
      "filePath": "user-id/file.pdf",
      "status": "processing",
      "citationCount": 0,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

### 3.3 DELETE /api/documents/[id]

**功能**: 删除文档（Storage + DB）

#### 请求
```typescript
// Method: DELETE
// URL: /api/documents/{documentId}
```

#### 流程
1. ✅ 验证用户是否已登录
2. ✅ 验证用户角色（仅 `admin` 可删除）
3. ✅ 查询文档获取 `file_path`
4. ✅ 从 Storage 删除文件
5. ✅ 从 DB 删除记录

#### 响应（成功 - 200）
```json
{
  "message": "文档删除成功",
  "id": "uuid"
}
```

#### 响应（错误 - 403）
```json
{
  "error": "权限不足：仅管理员可删除文档"
}
```

---

### 3.4 GET /api/documents/[id]

**功能**: 获取单个文档详情

#### 请求
```typescript
// Method: GET
// URL: /api/documents/{documentId}
```

#### 响应（成功 - 200）
```json
{
  "document": {
    "id": "uuid",
    "title": "文档标题",
    // ... 完整文档信息
  }
}
```

---

## 4. 前端集成详情

### 4.1 Admin Dashboard (`app/admin/dashboard/page.tsx`)

#### 关键变更

**之前（Mock）**:
```typescript
const MOCK_DOCUMENTS = [/* 硬编码数据 */]
const [documents, setDocuments] = useState(MOCK_DOCUMENTS)
```

**现在（真实 API）**:
```typescript
const [documents, setDocuments] = useState<Document[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

const fetchDocuments = async () => {
  const response = await fetch('/api/documents')
  const data = await response.json()
  setDocuments(data.documents || [])
}

useEffect(() => {
  fetchDocuments()
}, [])
```

#### 新增状态

1. **Loading State** - 显示加载动画
   ```tsx
   {loading && (
     <div className="flex items-center justify-center py-12">
       <RefreshCw className="h-8 w-8 animate-spin" />
       <p>加载文档列表...</p>
     </div>
   )}
   ```

2. **Error State** - 显示错误并提供重试按钮
   ```tsx
   {error && (
     <Alert variant="destructive">
       <AlertCircle className="h-4 w-4" />
       <AlertDescription>
         {error}
         <Button onClick={fetchDocuments}>重试</Button>
       </AlertDescription>
     </Alert>
   )}
   ```

3. **Empty State** - 显示空状态并引导用户上传
   ```tsx
   {!loading && documents.length === 0 && (
     <div className="text-center py-12">
       <FileText className="h-12 w-12 mb-4" />
       <h3>还没有文档</h3>
       <Link href="/admin/upload">
         <Button>上传文档</Button>
       </Link>
     </div>
   )}
   ```

#### 删除功能

**之前（Mock）**:
```typescript
await new Promise(resolve => setTimeout(resolve, 500))
setDocuments(prev => prev.filter(doc => doc.id !== docId))
```

**现在（真实 API）**:
```typescript
const response = await fetch(`/api/documents/${docId}`, {
  method: 'DELETE',
})

if (!response.ok) {
  throw new Error('删除文档失败')
}

setDocuments(prev => prev.filter(doc => doc.id !== docId))
```

---

### 4.2 Upload Page (`app/admin/upload/page.tsx`)

#### 关键变更

**之前（Mock）**:
```typescript
setTimeout(() => {
  alert("文档上传成功！")
  setLoading(false)
}, 2000)
```

**现在（真实 API）**:
```typescript
const uploadFormData = new FormData()
uploadFormData.append('file', formData.file)
uploadFormData.append('title', formData.title)
uploadFormData.append('category', formData.category)
uploadFormData.append('subcategory', formData.subcategory)

const response = await fetch('/api/documents', {
  method: 'POST',
  body: uploadFormData,
})

if (!response.ok) {
  throw new Error('上传失败')
}

// 成功后跳转到仪表板
setTimeout(() => {
  router.push('/admin/dashboard')
}, 2000)
```

#### 新增功能

1. **Success Alert** - 绿色成功提示
   ```tsx
   {success && (
     <Alert className="border-green-500 bg-green-50">
       <CheckCircle2 className="text-green-600" />
       <AlertDescription>
         文档上传成功！正在处理中... 即将跳转到仪表板。
       </AlertDescription>
     </Alert>
   )}
   ```

2. **Error Alert** - 红色错误提示
   ```tsx
   {error && (
     <Alert variant="destructive">
       <AlertCircle />
       <AlertDescription>{error}</AlertDescription>
     </Alert>
   )}
   ```

3. **类别更新** - 改为中文类别
   ```typescript
   const CATEGORIES = [
     "快速开始",
     "产品管理",
     "财务与支付",
     "平台规则",
     "账户设置",
     "故障排除",
   ]
   ```

---

## 5. 测试步骤

### 准备工作

1. ✅ 确认 Storage Bucket `documents` 已创建
2. ✅ 确认 `documents` 表存在
3. ✅ 确认以 Admin 角色登录

---

### 测试 1: 上传文档

#### 步骤
1. 访问 `/admin/upload`
2. 选择一个 PDF/TXT/MD 文件（< 50MB）
3. 填写标题：`测试文档 1`
4. 选择类别：`快速开始`
5. （可选）填写子类别：`新手指南`
6. 点击 **"开始处理"**

#### 预期结果
- ✅ 显示 "处理中..." 按钮（禁用状态）
- ✅ 上传成功后显示绿色 Alert：`文档上传成功！正在处理中... 即将跳转到仪表板。`
- ✅ 2秒后自动跳转到 `/admin/dashboard`

#### 验证（Supabase Dashboard）

**Storage**:
```
Bucket: documents
  └─ {your-user-id}/
      └─ {timestamp}-{filename}.pdf
```

**Database**:
```sql
SELECT * FROM documents ORDER BY created_at DESC LIMIT 1;
```

应该看到新插入的记录：
- `title`: "测试文档 1"
- `category`: "快速开始"
- `status`: "processing"
- `file_path`: "user-id/timestamp-file.pdf"
- `source_url`: "https://..."

---

### 测试 2: 查看文档列表

#### 步骤
1. 在 `/admin/dashboard` 页面
2. 观察表格

#### 预期结果
- ✅ 显示加载动画（短暂）
- ✅ 加载完成后显示文档列表
- ✅ 刚上传的 "测试文档 1" 出现在列表顶部
- ✅ 状态显示为 "处理中"（黄色图标）
- ✅ 引用数显示为 `0`

#### 如果列表为空
- ✅ 显示空状态 UI
- ✅ 显示 "还没有文档" 提示
- ✅ 显示 "上传文档" 按钮

---

### 测试 3: 删除文档

#### 步骤
1. 在 `/admin/dashboard` 文档列表中
2. 点击 "测试文档 1" 行的删除按钮（垃圾桶图标）
3. 在确认对话框点击 **"确定"**

#### 预期结果
- ✅ 删除按钮显示加载动画（旋转图标）
- ✅ 文档从列表中消失
- ✅ 控制台输出：`文档 "测试文档 1" 已删除`

#### 验证（Supabase Dashboard）

**Storage**:
- ✅ 文件已从 `documents` bucket 中删除

**Database**:
```sql
SELECT * FROM documents WHERE title = '测试文档 1';
```
- ✅ 返回空结果（记录已删除）

---

### 测试 4: 错误处理

#### 测试 4.1: 未选择文件
1. 访问 `/admin/upload`
2. 填写标题和类别
3. **不选择文件**
4. 点击 "开始处理"

**预期**: 按钮应该是禁用状态（无法点击）

#### 测试 4.2: 文件类型错误
1. 选择一个不支持的文件（如 `.docx`, `.jpg`）
2. 尝试上传

**预期**: 显示红色 Alert：`不支持的文件类型...`

#### 测试 4.3: 文件过大
1. 选择一个 > 50MB 的文件
2. 尝试上传

**预期**: 显示红色 Alert：`文件大小超过 50MB 限制`

#### 测试 4.4: 非 Admin 用户删除
1. 以 Merchant 角色登录（如果可能）
2. 尝试访问 `/admin/dashboard`（Middleware 会拦截）

**预期**: 重定向到 `/portal`

---

### 测试 5: 网络错误处理

#### 模拟 API 错误
在浏览器 DevTools Console 中：
```javascript
// 拦截 fetch 请求（临时测试）
const originalFetch = window.fetch
window.fetch = () => Promise.reject(new Error('Network error'))
```

然后刷新 Dashboard 页面。

**预期**:
- ✅ 显示红色错误 Alert
- ✅ 显示 "重试" 按钮
- ✅ 点击 "重试" 后重新获取数据

**恢复正常**:
```javascript
window.fetch = originalFetch
```

---

## 6. 故障排除

### 问题 1: "未授权访问" (401)

**原因**: 用户未登录或 token 过期

**解决方案**:
1. 刷新页面
2. 重新登录
3. 检查 Supabase 配置（`.env.local`）

---

### 问题 2: "Bucket 'documents' not found"

**原因**: Storage Bucket 未创建

**解决方案**:
1. 参考 `SETUP_STORAGE_BUCKET.md`
2. 在 Supabase Dashboard 创建 bucket
3. 验证：
   ```sql
   SELECT * FROM storage.buckets WHERE id = 'documents';
   ```

---

### 问题 3: "权限不足：仅管理员可删除文档" (403)

**原因**: 当前用户 role 不是 `admin`

**解决方案**:
1. 检查当前用户角色：
   ```sql
   SELECT * FROM profiles WHERE id = '{your-user-id}';
   ```
2. 如果需要，更新为 admin：
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = '{your-user-id}';
   ```

---

### 问题 4: "文件上传失败" (500)

**可能原因**:
- Storage RLS 策略阻止上传
- Network 问题
- 文件损坏

**调试步骤**:
1. 查看浏览器 Console 错误详情
2. 查看 API 响应中的 `details` 字段
3. 检查 Storage 策略：
   ```sql
   SELECT * FROM storage.policies WHERE bucket_id = 'documents';
   ```
4. 确认有 "Authenticated users can upload" 策略

---

### 问题 5: Dashboard 显示空列表（但 DB 有数据）

**原因**: API 返回数据格式不匹配

**调试步骤**:
1. 打开浏览器 DevTools → Network
2. 查看 `/api/documents` 请求
3. 检查响应格式：
   ```json
   {
     "documents": [...],
     "total": N
   }
   ```
4. 查看 Console 是否有错误

---

### 问题 6: CORS 错误

**原因**: 通常不会在 Next.js API Routes 中出现

**如果出现**:
- 确认您使用的是 `/api/documents`（相对路径）
- 不要使用 `http://localhost:3000/api/documents`（绝对路径）

---

## 7. 下一步

### Phase 3 完成后的状态

| 功能 | 状态 |
|------|------|
| ✅ 文档上传（Storage + DB） | 完成 |
| ✅ 文档列表展示（真实数据） | 完成 |
| ✅ 文档删除（Storage + DB） | 完成 |
| ⚠️ PDF 解析 | **未实现** |
| ⚠️ 文本切分（Chunking） | **未实现** |
| ⚠️ 向量化（Embeddings） | **未实现** |
| ⚠️ RAG 聊天 | **未实现** |

---

### Phase 4: AI 处理管道（下一阶段）

#### 目标
实现文档处理和 RAG（检索增强生成）功能。

#### 任务清单

1. **PDF 解析**
   - [ ] 使用 `pdf-parse` 或 `pdfjs-dist` 提取文本
   - [ ] 处理多页 PDF
   - [ ] 支持 TXT 和 MD 文件

2. **文本切分（Chunking）**
   - [ ] 实现 RecursiveCharacterTextSplitter
   - [ ] 配置 chunk_size: 1000, chunk_overlap: 200
   - [ ] 插入 `document_chunks` 表

3. **向量化（Embeddings）**
   - [ ] 集成 OpenAI Embeddings API
   - [ ] 生成 1536 维向量
   - [ ] 存储到 `document_chunks.embedding`

4. **后台任务**
   - [ ] 创建 API: `POST /api/process-document`
   - [ ] 监听文档上传事件
   - [ ] 更新文档 status: processing → ready

5. **RAG 聊天**
   - [ ] 实现向量搜索（pgvector）
   - [ ] 集成 LLM API (OpenAI/Claude)
   - [ ] 记录 `message_citations`
   - [ ] 自动更新 `citation_count`

---

## 总结

### ✅ Phase 3 成功标准

- [x] Storage Bucket `documents` 已创建
- [x] API Routes 实现并测试通过
- [x] Admin Dashboard 显示真实数据
- [x] Upload Page 连接真实 API
- [x] 文档可以成功上传和删除
- [x] 错误处理完善

### 🎉 恭喜！

您已经完成了 Phase 3 的核心功能实现。系统现在可以：
- ✅ 上传真实文件到 Supabase Storage
- ✅ 在数据库中创建和管理文档记录
- ✅ 在前端展示真实数据
- ✅ 提供完善的错误处理和用户反馈

**下一步**: 准备 Phase 4，实现 AI 处理和 RAG 功能！

---

**文档结束** | 版本: 1.0 | 日期: 2025-12-11

