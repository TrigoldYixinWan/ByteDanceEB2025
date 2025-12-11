# 🔧 环境变量配置完整指南

## 🚨 常见错误："Failed to Fetch"

如果您看到这个错误：
```
Failed to fetch
supabase.auth.signInWithPassword
```

**原因**：`.env.local` 文件中的 Supabase 凭据是占位符，不是真实值。

---

## 📋 正确配置步骤

### 第 1 步：获取 Supabase 凭据

1. **访问 Supabase Dashboard**
   ```
   https://supabase.com/dashboard
   ```

2. **登录并选择您的项目**
   - 如果没有项目，点击 "New Project" 创建

3. **导航到 API 设置**
   - 点击左侧菜单的 **⚙️ Settings**
   - 点击 **API** 选项卡

4. **找到并复制这两个值**：

   **A. Project URL**
   - 位置：页面顶部 "Configuration" 部分
   - 标签：`Project URL`
   - 格式：`https://xxxxx.supabase.co`
   - 示例：`https://xyzabcdefg.supabase.co`

   **B. anon public key**
   - 位置：页面中部 "Project API keys" 部分
   - 找到标记为 `anon` 或 `public` 的那一行
   - ⚠️ **不要**使用 `service_role` key
   - 格式：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (很长的字符串)

---

### 第 2 步：编辑 `.env.local` 文件

#### 方法 1：使用文本编辑器

1. 在 VS Code 或任何编辑器中打开：
   ```
   merchant-kb/.env.local
   ```

2. 找到这两行：
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **替换**为您的实际值：
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xyzabcdefg.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emFiY2RlZmciLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzMzUxMjAwMCwiZXhwIjoxOTQ5MDg4MDAwfQ.dGVzdC1rZXktMTIzNDU2Nzg5MA
   ```

4. **保存文件**

#### 方法 2：使用命令行（PowerShell）

```powershell
cd d:\ByteDanceCode\Knowledge_Management\merchant-kb

# 用您的实际值替换
@"
NEXT_PUBLIC_SUPABASE_URL=https://你的项目ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的完整anon-key
OPENAI_API_KEY=your-openai-api-key-here
"@ | Out-File -FilePath ".env.local" -Encoding utf8
```

---

### 第 3 步：验证配置

运行验证命令：

```powershell
# 检查文件内容
Get-Content .env.local

# 确保看到的是真实值，不是占位符
```

**正确的输出示例**：
```
NEXT_PUBLIC_SUPABASE_URL=https://xyzabcdefg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...
OPENAI_API_KEY=your-openai-api-key-here
```

**错误的输出（还是占位符）**：
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co  ❌
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here  ❌
```

---

### 第 4 步：重启开发服务器

**重要**：修改 `.env.local` 后必须重启服务器！

```bash
# 1. 停止当前服务器
按 Ctrl+C

# 2. 重新启动
npm run dev
```

---

## ✅ 成功标志

重启后，您应该看到：

```
✓ Ready in 2s
○ Compiling /login ...
GET /login 200 in 3.9s
```

**无以下错误**：
- ❌ "Your project's URL and Key are required"
- ❌ "Failed to fetch"
- ❌ "Invalid API key"

---

## 🔍 常见配置错误

### 错误 1：使用了错误的 Key

```env
# ❌ 错误：使用了 service_role key
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...service-role-key...

# ✅ 正确：使用 anon public key
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...anon-key...
```

**如何区分**：
- Supabase Dashboard 中有两个 key
- 使用标记为 `anon` 或 `public` 的那个
- **不要**使用标记为 `service_role` 的

### 错误 2：URL 格式错误

```env
# ❌ 错误格式
NEXT_PUBLIC_SUPABASE_URL=xyzabcdefg.supabase.co  # 缺少 https://
NEXT_PUBLIC_SUPABASE_URL="https://xyzabcdefg.supabase.co"  # 不需要引号

# ✅ 正确格式
NEXT_PUBLIC_SUPABASE_URL=https://xyzabcdefg.supabase.co
```

### 错误 3：有多余空格

```env
# ❌ 错误：等号后有空格
NEXT_PUBLIC_SUPABASE_URL= https://xyzabcdefg.supabase.co

# ✅ 正确：紧挨着等号
NEXT_PUBLIC_SUPABASE_URL=https://xyzabcdefg.supabase.co
```

### 错误 4：Key 不完整

Anon key 通常很长（~200+ 字符），确保复制完整：

```env
# ❌ 错误：key 被截断
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M

# ✅ 正确：完整的 key
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emFiY2RlZmciLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzMzUxMjAwMCwiZXhwIjoxOTQ5MDg4MDAwfQ.完整的签名部分
```

---

## 🧪 测试配置

### 方法 1：通过浏览器测试

1. 访问：http://localhost:3000
2. 尝试登录
3. 如果配置正确：
   - ✅ 表单可以提交
   - ✅ 看到加载状态
   - ✅ 得到具体错误（如"Invalid credentials"）而不是"Failed to fetch"

### 方法 2：通过开发工具测试

打开浏览器开发工具（F12）→ Network 标签：
- ✅ 应该看到对 `supabase.co` 的请求
- ✅ 请求状态不应该是 `(failed)`

---

## 📝 完整配置模板

```env
# Supabase Configuration
# 从 Supabase Dashboard > Settings > API 获取

# Project URL - 从 "Project URL" 复制
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-ID].supabase.co

# Anon Key - 从 "Project API keys" 的 "anon public" 行复制
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ[很长的字符串]

# OpenAI (可选 - 聊天功能需要)
OPENAI_API_KEY=sk-[您的OpenAI密钥]
```

---

## 🆘 仍然有问题？

### 调试检查清单

- [ ] URL 以 `https://` 开头
- [ ] URL 以 `.supabase.co` 结尾
- [ ] Anon key 以 `eyJ` 开头
- [ ] Anon key 长度 > 100 字符
- [ ] 文件名是 `.env.local`（不是 `.env` 或 `.env.local.txt`）
- [ ] 文件在 `merchant-kb/` 目录下
- [ ] 已重启开发服务器
- [ ] 浏览器已刷新

### 如果还是失败

1. **验证 Supabase 项目状态**
   - 在 Dashboard 中确认项目是 "Active"
   - 不是 "Paused" 或 "Inactive"

2. **检查网络连接**
   - 尝试访问：`https://[YOUR-PROJECT-ID].supabase.co`
   - 应该返回一些 JSON 响应

3. **清除 Next.js 缓存**
   ```bash
   rm -rf .next
   npm run dev
   ```

---

## 📚 相关文档

- [Supabase Auth 文档](https://supabase.com/docs/guides/auth)
- [Next.js 环境变量](https://nextjs.org/docs/basic-features/environment-variables)

---

**配置完成后，继续进行用户创建和测试！** 🚀

