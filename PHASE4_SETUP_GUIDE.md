# 🚀 Phase 4: RAG & Vectorization Setup Guide

**实施日期**: 2025-12-11  
**目标**: 实现 PDF 解析、文本分块、向量嵌入和存储

---

## 📋 Prerequisites Checklist

### ✅ Already Completed
- [x] `npm install openai pdf-parse` (Dependencies installed)
- [x] Private Bucket configured (`documents`)
- [x] Admin-Only RLS policies applied
- [x] Documents table ready
- [x] `document_chunks` table with `embedding` vector field

### ⚠️ Required Configuration

#### 1. OpenAI API Key

**获取 API Key**:
1. 访问 [OpenAI Platform](https://platform.openai.com/api-keys)
2. 登录/注册账户
3. 创建新的 API Key
4. 复制 API Key（格式：`sk-...`）

**添加到环境变量**:

```bash
# merchant-kb/.env.local

# Supabase (已有)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (新增)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**⚠️ 重要**: 
- 不要提交 `.env.local` 到 Git
- API Key 保密，不要泄露

---

## 📦 Implementation Summary

### A. 新增文件

#### 1. `lib/ai/embedding.ts`
**功能**: AI Embedding 服务

**核心函数**:
```typescript
// 生成单个文本的向量嵌入
generateEmbedding(text: string): Promise<number[]>

// 批量生成向量嵌入（优化 API 调用）
generateEmbeddingBatch(texts: string[]): Promise<number[][]>

// 文本分块（1000 字符，200 字符重叠）
chunkText(text: string, chunkSize?: number, overlap?: number): string[]

// 估算成本
estimateEmbeddingCost(tokenCount: number): number
```

**技术细节**:
- 模型: `text-embedding-3-small`
- 维度: 1536
- 价格: $0.00002 per 1K tokens

---

#### 2. `app/api/documents/[id]/process/route.ts`
**功能**: PDF 处理 API

**Endpoint**: `POST /api/documents/[id]/process`

**权限**: Admin Only

**处理流程**:
```
1. 验证 Admin 权限
   ↓
2. 获取文档信息（检查状态）
   ↓
3. 更新状态为 "processing"
   ↓
4. 从 Storage 下载 PDF
   ↓
5. 解析 PDF 文本
   ↓
6. 文本分块（1000 字符，200 字符重叠）
   ↓
7. 批量生成向量嵌入
   ↓
8. 存储到 document_chunks 表
   ↓
9. 更新状态为 "ready"
   ↓
10. 返回成功响应
```

**技术特性**:
- ✅ Node.js Runtime（支持 `pdf-parse`）
- ✅ 批量处理（100 个块/批次）
- ✅ 错误回滚（失败时更新状态为 `failed`）
- ✅ 详细日志（便于调试）
- ✅ 成本估算（显示 API 成本）

---

#### 3. `app/admin/dashboard/page.tsx`（更新）
**新增功能**: "处理" 按钮

**UI 变更**:
- ✅ 仅对 `status='pending'` 的文档显示"处理"按钮
- ✅ 点击后调用 `POST /api/documents/[id]/process`
- ✅ 显示加载状态（"处理中..."）
- ✅ 处理完成后显示结果（块数、成本）
- ✅ 自动刷新文档列表

---

## 🧪 Testing Guide

### Test 1: 环境变量验证

```bash
# 在项目根目录执行
cat merchant-kb/.env.local | grep OPENAI_API_KEY

# 应该看到：
# OPENAI_API_KEY=sk-proj-...
```

✅ **验证**: API Key 存在且格式正确

---

### Test 2: 服务器启动

```bash
# 停止服务器（Ctrl+C）
# 重新启动
cd merchant-kb
npm run dev
```

✅ **验证**: 无编译错误，服务器正常启动

---

### Test 3: 上传测试 PDF

1. 以 Admin 登录
2. 访问 `/admin/upload`
3. 上传一个测试 PDF 文件
4. 填写标题和类别
5. 点击"上传文档"

✅ **预期结果**: 
- 上传成功
- 跳转到 Dashboard
- 文档状态显示为"待处理"（蓝色）

---

### Test 4: 处理文档

1. 在 Dashboard 中找到刚上传的文档
2. 应该看到"处理"按钮（蓝色）
3. 点击"处理"按钮
4. 确认对话框：点击"确定"
5. 等待处理完成（可能需要 1-5 分钟，取决于 PDF 大小）

✅ **预期结果**:
- 按钮显示"处理中..."
- 文档状态变为"处理中"（黄色，旋转图标）
- 等待一段时间后，状态变为"就绪"（绿色）
- 弹出成功对话框，显示：
  ```
  文档处理成功！
  
  生成了 X 个文本块
  估算成本: $0.00XXXX
  ```

---

### Test 5: 验证数据库

```sql
-- 检查文档状态
SELECT id, title, status FROM documents WHERE status = 'ready';

-- 检查生成的文本块
SELECT 
  d.title,
  COUNT(c.id) as chunk_count
FROM documents d
LEFT JOIN document_chunks c ON c.document_id = d.id
WHERE d.status = 'ready'
GROUP BY d.id, d.title;

-- 检查向量嵌入（验证维度）
SELECT 
  id,
  document_id,
  LENGTH(content) as text_length,
  array_length(embedding, 1) as embedding_dimension
FROM document_chunks
LIMIT 5;
```

✅ **预期结果**:
- 文档状态为 `ready`
- `chunk_count` > 0（取决于 PDF 大小）
- `embedding_dimension` = 1536

---

### Test 6: 服务器日志验证

**在服务器终端中应该看到**:

```
📝 开始处理文档: uuid-here
📄 文档信息: { title: 'xxx', status: 'pending', filePath: 'xxx' }
✅ 文档状态已更新为 processing
✅ 文件下载成功: 12345 bytes
✅ PDF 解析成功: { pages: 5, textLength: 3456 }
📦 文本分块完成: 4 个块
💰 估算成本: { totalTokens: 1200, estimatedCost: '$0.000024' }
🤖 开始生成向量嵌入...
🔄 处理批次 1/1: 4 个块
✅ 向量生成完成: 4 个向量
💾 开始存储到数据库...
✅ 已插入 4/4 个块
✅ 所有块已存储到数据库
✅ 文档处理完成: uuid-here
```

---

## 🔍 Troubleshooting

### 问题 1: "OPENAI_API_KEY is not defined"

**原因**: 环境变量未配置

**解决方案**:
```bash
# 1. 检查 .env.local 文件
cat merchant-kb/.env.local | grep OPENAI

# 2. 如果不存在，添加
echo "OPENAI_API_KEY=sk-your-key-here" >> merchant-kb/.env.local

# 3. 重启服务器
npm run dev
```

---

### 问题 2: "Failed to parse PDF"

**可能原因**:
- PDF 是扫描版（纯图片，无文本）
- PDF 损坏
- PDF 加密

**解决方案**:
1. 使用包含文本的 PDF（不是扫描版）
2. 尝试其他 PDF 文件
3. 使用 OCR 工具提取扫描版 PDF 的文本（Phase 4+ 功能）

---

### 问题 3: "Embedding generation failed"

**可能原因**:
- OpenAI API Key 无效
- API 配额用尽
- 网络问题

**解决方案**:
```bash
# 1. 验证 API Key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# 2. 检查 OpenAI 账户余额
# 访问 https://platform.openai.com/usage

# 3. 检查网络连接
```

---

### 问题 4: "Database insert failed"

**可能原因**:
- `document_chunks` 表不存在
- `embedding` 字段类型错误
- RLS 策略阻止插入

**解决方案**:
```sql
-- 1. 验证表结构
\d document_chunks

-- 2. 验证 embedding 字段
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'document_chunks' 
  AND column_name = 'embedding';

-- 应该显示: vector(1536)

-- 3. 验证 RLS 策略
SELECT * FROM pg_policies 
WHERE tablename = 'document_chunks';
```

---

### 问题 5: "Processing timeout"

**原因**: 大型 PDF 处理时间过长

**解决方案**:
- 使用较小的 PDF 文件（< 20 页）进行测试
- 未来可以考虑使用后台任务队列

---

## 💰 Cost Estimation

### OpenAI API 价格

| 模型 | 价格 | 备注 |
|------|------|------|
| `text-embedding-3-small` | $0.00002 / 1K tokens | 1536 维度 |
| `text-embedding-3-large` | $0.00013 / 1K tokens | 3072 维度（更高精度） |

### 示例成本计算

**假设**: 10 页 PDF，约 5000 字符/页

```
总字符数: 50,000 字符
Token 估算: 50,000 / 2.5 ≈ 20,000 tokens
分块数: 50,000 / 1000 ≈ 50 个块

成本:
- text-embedding-3-small: 20K tokens × $0.00002/1K = $0.0004
- text-embedding-3-large: 20K tokens × $0.00013/1K = $0.0026
```

**结论**: 每个 10 页 PDF 约 **$0.0004**（小模型）或 **$0.0026**（大模型）

**推荐**: 使用 `text-embedding-3-small`（性价比高，质量足够）

---

## 📊 Performance Metrics

### 预期处理时间

| PDF 大小 | 页数 | 文本块 | 处理时间 | 成本 |
|---------|------|--------|---------|------|
| 小 | 1-5 页 | 5-25 块 | 10-30 秒 | $0.0001-0.0005 |
| 中 | 6-20 页 | 26-100 块 | 30-120 秒 | $0.0005-0.0020 |
| 大 | 21-50 页 | 101-250 块 | 2-5 分钟 | $0.0020-0.0050 |
| 超大 | 50+ 页 | 250+ 块 | 5-15 分钟 | $0.0050-0.0150 |

**注**: 实际时间取决于网络速度和 OpenAI API 响应速度

---

## ✅ Success Criteria

完成以下所有测试后，Phase 4 核心功能即为成功：

- [x] **环境配置**: OpenAI API Key 已添加
- [ ] **服务器启动**: 无编译错误
- [ ] **文件上传**: PDF 上传成功，状态为 `pending`
- [ ] **文档处理**: 点击"处理"按钮后成功处理
- [ ] **状态更新**: 文档状态从 `pending` → `processing` → `ready`
- [ ] **数据验证**: `document_chunks` 表中有数据
- [ ] **向量验证**: `embedding` 字段维度为 1536
- [ ] **UI 反馈**: 显示处理结果（块数、成本）

---

## 🎯 Next Steps (Phase 4+)

1. **语义搜索**: 实现向量相似度搜索
2. **RAG Chat**: 结合 Chat API，使用文档块生成回答
3. **引用追踪**: 实现 `citation_count` 自动更新
4. **高级分块**: 支持更智能的分块策略（按段落、标题）
5. **OCR 支持**: 处理扫描版 PDF
6. **后台任务**: 使用队列处理大文件（避免超时）

---

## 📞 Support

**如果遇到问题**，请提供：
1. 服务器终端的完整错误日志
2. 浏览器 Console 的错误信息
3. PDF 文件大小和页数
4. 数据库查询结果（如适用）

---

**Phase 4 Setup Guide 完成！** 🚀

**下一步**: 添加 `OPENAI_API_KEY` 到 `.env.local`，然后测试文档处理功能！

