# 🏛️ Merchant Knowledge Base - Project Heritage

**文档目的**: 为新对话窗口提供项目上下文，快速理解任务主线

**最后更新**: 2025-01-11

---

## 🎯 项目目标

构建一个 **AI 驱动的商户知识库系统**，帮助商户快速获取平台规则和政策信息。

### 核心功能
1. **文档管理** - Admin 上传 PDF/Markdown/TXT 文档
2. **RAG 管道** - 文档解析 → 分块 → 向量嵌入 → 存储
3. **AI 问答** - 商户通过自然语言查询知识库
4. **引用追踪** - 热力图显示高频引用的文档

### 用户角色
| 角色 | 权限 |
|------|------|
| **Admin** | 上传/删除文档、查看分析报告 |
| **Merchant** | 浏览知识库、AI 问答 |

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 16.0.8 (App Router, Turbopack) |
| **UI** | Tailwind CSS + shadcn/ui |
| **后端** | Next.js API Routes (Node.js Runtime) |
| **数据库** | Supabase PostgreSQL + pgvector |
| **存储** | Supabase Storage (Private Bucket) |
| **认证** | Supabase Auth |
| **AI** | OpenAI API (text-embedding-3-small) |
| **PDF解析** | pdf-parse@1.1.1 |

---

## ✅ 已完成的 Milestones

### Phase 1: 项目基础 ✅
- [x] Next.js 项目初始化
- [x] Supabase 项目配置
- [x] 数据库 Schema 设计 (`schema.sql`)
- [x] shadcn/ui 组件库集成

### Phase 2: 认证系统 ✅
- [x] Supabase Auth 集成
- [x] 登录/注册页面 (`/login`)
- [x] UserProvider 全局状态管理
- [x] 角色检查 (Admin/Merchant)
- [x] 自动 Profile 创建触发器
- [x] Token Refresh 处理优化

### Phase 3: 文档管理 ✅
- [x] Admin Dashboard (`/admin/dashboard`)
- [x] 文档上传页面 (`/admin/upload`)
- [x] Supabase Storage 配置 (Private Bucket)
- [x] Signed URL 生成
- [x] 文档 CRUD API (`/api/documents`)
- [x] 文件类型验证 (PDF, MD, TXT)

### Phase 4: RAG 管道 ✅
- [x] PDF 解析 (`pdf-parse@1.1.1`)
- [x] Markdown/TXT 解析 (UTF-8)
- [x] 文本分块 (`chunkText()`, 1000字符/块, 200重叠)
- [x] OpenAI Embedding 生成 (`text-embedding-3-small`)
- [x] `document_chunks` 表存储
- [x] 处理状态管理 (pending → processing → ready)

---

## 🔄 当前状态

### 工作正常 ✅
- 登录/注册/登出
- Admin 上传 PDF 文档
- PDF 解析和向量嵌入
- 文档列表显示
- 文档删除

### 刚修复，待测试 ⚠️
- **MD/TXT 文件上传** - 修改了 Content-Type 为 `text/plain`
- 需要重启服务器后测试

### 未实现 ❌
- AI 问答功能 (`/portal/chat`)
- 语义搜索 API
- 引用热力图
- 文档详情页面 (真实数据)

---

## 📁 关键文件路径

### 核心配置
```
merchant-kb/
├── .env.local                    # 环境变量 (Supabase, OpenAI)
├── schema.sql                    # 数据库 Schema
├── package.json                  # 依赖 (pdf-parse@1.1.1)
└── test/data/05-versions-space.pdf  # pdf-parse 需要的测试文件
```

### 认证相关
```
├── lib/
│   ├── api/auth.ts               # signIn, signUp, signOut, getCurrentUser
│   └── supabase/
│       ├── client.ts             # 浏览器端 Supabase 客户端
│       └── server.ts             # 服务器端 Supabase 客户端
├── components/
│   └── providers/user-provider.tsx  # 全局用户状态
```

### API 路由
```
├── app/api/
│   └── documents/
│       ├── route.ts              # GET (列表), POST (上传)
│       └── [id]/
│           ├── route.ts          # DELETE, GET (单个)
│           └── process/route.ts  # POST (PDF解析+向量嵌入)
```

### 页面
```
├── app/
│   ├── login/page.tsx            # 登录/注册
│   ├── admin/
│   │   ├── dashboard/page.tsx    # 文档管理
│   │   ├── upload/page.tsx       # 上传页面
│   │   └── analytics/page.tsx    # 分析报告 (Mock)
│   └── portal/
│       ├── page.tsx              # 商户首页
│       ├── chat/page.tsx         # AI 问答 (Mock)
│       └── knowledge/[id]/page.tsx  # 文档详情 (Mock)
```

### AI 服务
```
├── lib/ai/
│   └── embedding.ts              # generateEmbedding, chunkText
```

---

## 🗄️ 数据库结构

### 核心表
```sql
profiles        -- 用户配置 (role: admin/merchant)
documents       -- 文档元信息 (title, category, status, file_path)
document_chunks -- 文本块 + 向量 (content, embedding VECTOR(1536))
chat_sessions   -- 聊天会话
chat_messages   -- 聊天消息
message_citations -- 消息引用 (用于热力图)
```

### 文档状态流转
```
pending → processing → ready
                    → failed (如果解析失败)
```

---

## 🔑 环境变量

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
OPENAI_API_KEY=sk-proj-xxx
```

---

## 🐛 已解决的关键问题

### 1. pdf-parse 测试文件问题
**问题**: `ENOENT: no such file or directory, open '.../test/data/05-versions-space.pdf'`
**解决**: 创建 `test/data/05-versions-space.pdf` 文件

### 2. pdf-parse v2.x Canvas 依赖
**问题**: `DOMMatrix is not defined`
**解决**: 降级到 `pdf-parse@1.1.1`

### 3. MD 文件 MIME type
**问题**: 浏览器上传 `.md` 返回 `application/octet-stream`，Supabase 拒绝
**解决**: 根据扩展名强制设置 Content-Type 为 `text/plain`

### 4. 侧边栏加载问题
**问题**: 侧边栏一直显示"加载中"
**解决**: 修复 UserProvider 的 useEffect 依赖和 Token Refresh 处理

---

## 📋 下一步工作建议

### 优先级 P0
1. **测试 MD/TXT 上传** - 重启服务器后验证
2. **实现 AI 问答** - `/api/chat` + 语义搜索

### 优先级 P1
3. **文档详情页** - 连接真实数据
4. **商户首页** - 显示 `status='ready'` 的文档

### 优先级 P2
5. **引用热力图** - 统计 `citation_count`
6. **分析报告** - 真实数据可视化

---

## 📝 测试账户

```
Admin: admin@test.com
Merchant: (注册新账户默认为 merchant)
```

---

## 🔗 相关文档

| 文档 | 用途 |
|------|------|
| `schema.sql` | 完整数据库 Schema |
| `ENV_SETUP_GUIDE.md` | 环境配置指南 |
| `AS_BUILT_TECHNICAL_REPORT.md` | 技术架构报告 |
| `PHASE3_TECHNICAL_DESIGN_REVIEW.md` | Phase 3 设计文档 |
| `PDF_PROCESSING_DIAGNOSTIC_REPORT.md` | PDF 问题诊断报告 |

---

## 💡 快速启动命令

```bash
cd merchant-kb
npm install
npm run dev
# 访问 http://localhost:3000
```

---

**祝下次对话顺利！** 🚀

