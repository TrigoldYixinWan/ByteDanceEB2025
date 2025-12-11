# ⚡ 快速开始指南

## 您遇到的错误

```
⨯ Error: Your project's URL and Key are required to create a Supabase client!
```

## 🔧 5分钟修复步骤

### 1️⃣ 获取 Supabase 凭据（2分钟）

访问：https://supabase.com/dashboard

1. 登录并选择您的项目（或创建新项目）
2. 点击左侧 **Settings** ⚙️
3. 点击 **API** 选项卡
4. 复制两个值：
   - **Project URL**（看起来像：`https://xxxxx.supabase.co`）
   - **anon public key**（很长的 JWT 字符串）

### 2️⃣ 配置环境变量（1分钟）

在项目根目录 `merchant-kb/` 找到 `.env.local` 文件：

```env
# 将这两行替换为您的实际值：
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

**⚠️ 重要：**
- 不要加引号
- 不要有多余空格
- 使用 `anon` key，不是 `service_role` key

### 3️⃣ 创建数据库表（1分钟）

1. 在 Supabase Dashboard，点击 **SQL Editor**
2. 点击 "New query"
3. 打开项目中的 `schema.sql` 文件
4. 复制整个内容
5. 粘贴到 SQL Editor
6. 点击 **Run** 或按 `Ctrl+Enter`
7. 等待成功消息 ✅

### 4️⃣ 创建测试用户（1分钟）

在 Supabase Dashboard：

**A. 创建认证用户**
1. 点击 **Authentication** → **Users**
2. 点击 "Add user" → "Create new user"
3. 创建两个用户：

```
商户：
Email: merchant@test.com
Password: Test123456!

管理员：
Email: admin@test.com  
Password: Test123456!
```

**B. 创建 Profiles**
1. 复制每个用户的 UUID（在用户列表中）
2. 在 **SQL Editor** 中运行：

```sql
INSERT INTO profiles (id, role, full_name) VALUES
  ('商户用户的UUID', 'merchant', '测试商户'),
  ('管理员用户的UUID', 'admin', '测试管理员');
```

### 5️⃣ 重启服务器

```bash
# 按 Ctrl+C 停止当前服务器
# 然后重新启动：
npm run dev
```

---

## ✅ 验证成功

访问 http://localhost:3000，您应该看到：
- ✅ 无 Supabase 错误
- ✅ 登录页面加载
- ✅ 可以用测试账户登录
- ✅ Merchant 看到 "AI 聊天"
- ✅ Admin 看到 "分析报告"

---

## 🆘 还是不行？

### 常见问题：

**问题 1：仍然看到 Supabase 错误**
```bash
# 检查 .env.local 位置
ls .env.local

# 如果没有，运行：
cp .env.local.example .env.local
# 然后编辑并填入您的凭据
```

**问题 2：找不到 .env.local 文件**
- 它是隐藏文件
- 在 VS Code：确保文件浏览器显示隐藏文件
- 或者手动创建：右键 → 新建文件 → 命名为 `.env.local`

**问题 3：登录后 "Profile not found"**
- 您忘记了步骤 4B
- 必须在 `profiles` 表中插入用户记录
- 使用正确的 UUID（从 Authentication > Users 复制）

**问题 4："Cannot read properties of null"**
- 数据库表可能没创建
- 重新运行 `schema.sql`
- 检查 Supabase Dashboard > Table Editor 是否有 6 个表

---

## 📚 完整文档

详细说明请参阅：
- [`SETUP_GUIDE.md`](./SETUP_GUIDE.md) - 完整配置指南
- [`MIGRATION_PHASE2.md`](./MIGRATION_PHASE2.md) - 技术文档

---

## 💡 提示

**环境变量格式示例：**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MzM1MTIwMDAsImV4cCI6MTk0OTA4ODAwMH0.1234567890abcdefghijklmnopqrstuvwxyz
```

**Profile 插入示例：**
```sql
-- 在 SQL Editor 中，用实际 UUID 替换
INSERT INTO profiles (id, role, full_name) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'merchant', '张三'),
  ('b2c3d4e5-f678-90ab-cdef-123456789012', 'admin', '李四');
```

---

**准备好了吗？开始步骤 1！** 🚀

