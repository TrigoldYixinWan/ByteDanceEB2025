# 🚀 环境配置指南

## 问题：Supabase 凭据缺失

您看到的错误是因为应用需要 Supabase 项目的凭据才能运行。

---

## 📝 步骤 1: 获取 Supabase 凭据

### 方法：从 Supabase Dashboard 获取

1. **打开 Supabase Dashboard**
   - 访问：https://supabase.com/dashboard
   - 登录您的账户

2. **选择您的项目**
   - 如果还没有项目，点击 "New Project" 创建一个

3. **获取 API 凭据**
   - 在左侧菜单中，点击 **Settings** (⚙️ 图标)
   - 点击 **API** 选项卡
   - 您会看到两个重要的值：

   **A. Project URL**
   ```
   示例：https://abcdefghijklmnop.supabase.co
   ```
   
   **B. Anon Key（匿名/公开密钥）**
   ```
   示例：eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（很长的字符串）
   ```

---

## 📝 步骤 2: 配置环境变量

### 方法 1：手动编辑 `.env.local` 文件

1. **打开文件**
   - 在项目根目录（`merchant-kb/`）找到 `.env.local` 文件
   - 如果看不到，可能需要在编辑器中显示隐藏文件

2. **替换占位符**
   
   **原始模板：**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

   **替换后（示例）：**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzMzUxMjAwMCwiZXhwIjoxOTQ5MDg4MDAwfQ.abcdefghijklmnopqrstuvwxyz1234567890
   ```

3. **保存文件**

### 方法 2：使用命令行

```bash
# 在 PowerShell 中（merchant-kb 目录）
@"
NEXT_PUBLIC_SUPABASE_URL=你的项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Anon密钥
OPENAI_API_KEY=暂时留空
"@ | Out-File -FilePath ".env.local" -Encoding utf8
```

---

## 📝 步骤 3: 运行数据库迁移（SQL）

在继续之前，您需要在 Supabase 中创建数据库表。

### 方法：在 Supabase SQL Editor 中执行

1. **打开 SQL Editor**
   - 在 Supabase Dashboard 左侧菜单
   - 点击 **SQL Editor**

2. **创建新查询**
   - 点击 "New query" 按钮

3. **粘贴架构 SQL**
   
   在项目根目录应该有一个 `schema.sql` 文件（如果没有，请告诉我，我会创建）
   
   将整个 SQL 内容粘贴到编辑器中

4. **执行查询**
   - 点击 "Run" 按钮（或按 Ctrl+Enter）
   - 等待成功消息

5. **验证表创建**
   - 在左侧菜单点击 **Table Editor**
   - 您应该看到：
     - `profiles`
     - `documents`
     - `document_chunks`
     - `chat_sessions`
     - `chat_messages`
     - `message_citations`

---

## 📝 步骤 4: 创建测试用户

### 在 Supabase Dashboard 中：

1. **创建认证用户**
   - 点击左侧菜单的 **Authentication**
   - 点击 **Users** 选项卡
   - 点击 "Add user" → "Create new user"
   
   **商户测试用户：**
   ```
   Email: merchant@test.com
   Password: Test123456!
   ```
   
   **管理员测试用户：**
   ```
   Email: admin@test.com
   Password: Test123456!
   ```

2. **创建用户 Profiles**
   
   复制每个用户的 UUID，然后在 SQL Editor 中执行：
   
   ```sql
   -- 替换 'merchant-uuid' 和 'admin-uuid' 为实际的 UUID
   
   INSERT INTO profiles (id, role, full_name) VALUES
     ('merchant-uuid', 'merchant', '测试商户'),
     ('admin-uuid', 'admin', '测试管理员');
   ```

---

## 📝 步骤 5: 重启开发服务器

### 在终端中：

1. **停止当前服务器**
   - 按 `Ctrl+C`

2. **重新启动**
   ```bash
   npm run dev
   ```

3. **检查输出**
   - ✅ 应该不再有 Supabase 错误
   - ✅ 应该显示 "Ready in Xs"
   - ✅ 打开 http://localhost:3000

---

## 🧪 测试登录

### 访问应用：

1. **打开浏览器**
   - 访问：http://localhost:3000
   - 应该自动重定向到 `/login`

2. **测试商户登录**
   ```
   Email: merchant@test.com
   Password: Test123456!
   ```
   - ✅ 应该重定向到 `/portal`
   - ✅ 侧边栏显示 "AI 聊天" 链接

3. **测试管理员登录**
   ```
   Email: admin@test.com
   Password: Test123456!
   ```
   - ✅ 应该重定向到 `/admin/dashboard`
   - ✅ 侧边栏显示 "分析报告" 链接

---

## 🔍 常见问题

### Q: 我看不到 `.env.local` 文件
**A:** 这是一个隐藏文件。在 VS Code 中：
- 按 `Ctrl+Shift+P`
- 输入 "Open Folder"
- 确保显示隐藏文件

### Q: 我的密钥在哪里？
**A:** Supabase Dashboard → Settings → API
- 复制 "Project URL"
- 复制 "anon public" 密钥（不是 service_role！）

### Q: 错误仍然存在
**A:** 检查：
1. `.env.local` 在正确的位置（`merchant-kb/.env.local`）
2. 没有多余的空格或引号
3. 重启开发服务器
4. 清除 Next.js 缓存：`rm -rf .next`

### Q: "Cannot read properties of null"
**A:** 可能数据库表还没创建。运行 `schema.sql`

---

## 📋 完整配置检查清单

- [ ] Supabase 项目已创建
- [ ] `.env.local` 文件已创建
- [ ] `NEXT_PUBLIC_SUPABASE_URL` 已设置
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 已设置
- [ ] 数据库表已创建（schema.sql）
- [ ] 测试用户已创建（Authentication）
- [ ] Profiles 已插入（SQL）
- [ ] 开发服务器已重启
- [ ] 登录测试成功

---

## 🆘 需要帮助？

如果仍然有问题，请提供：
1. 错误消息的完整截图
2. `.env.local` 的内容（隐藏实际密钥）
3. Supabase Dashboard 中的表列表截图

---

## ✅ 成功指标

当配置正确时，您应该看到：
- ✅ 无 Supabase 错误
- ✅ 登录页面正常加载
- ✅ 可以登录
- ✅ 侧边栏根据角色显示不同链接
- ✅ 退出功能工作正常

