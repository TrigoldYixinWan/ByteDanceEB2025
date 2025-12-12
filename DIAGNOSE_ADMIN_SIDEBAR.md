# 🔍 管理员侧边栏"加载中"问题诊断

## 问题现象
侧边栏一直显示"加载中..."，不显示导航菜单

---

## 🎯 快速诊断步骤

### Step 1: 打开浏览器控制台

1. 访问 `/admin/dashboard`
2. 按 `F12` 打开 DevTools
3. 切换到 **Console** 标签

### Step 2: 检查是否有错误

**查找以下错误**:
- ❌ `Profile fetch error:` 
- ❌ `Error fetching user:`
- ❌ `Network error`
- ❌ `CORS error`

如果有错误，请把**完整错误信息**发给我！

---

### Step 3: 检查用户登录状态

**在 Console 中执行**:

```javascript
// 检查用户状态
const checkAuth = async () => {
  const response = await fetch('/api/auth/user')
  const data = await response.json()
  console.log('Auth Status:', data)
}
checkAuth()
```

**预期结果**:
```json
{
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "profile": {
      "role": "admin",  // ✅ 必须是 "admin"
      "fullName": "..."
    }
  }
}
```

**如果返回 `null` 或者 `profile` 为 `null`**:
- 🚨 **问题**: 用户未登录或 profile 丢失

---

### Step 4: 检查 Network 请求

**在 DevTools 中**:
1. 切换到 **Network** 标签
2. 刷新页面
3. 查找失败的请求（红色）

**常见问题**:
- `/api/profiles` 返回 404
- Supabase API 超时
- CORS 错误

---

## 🛠️ 可能的原因 & 解决方案

### 原因 1: 用户未登录或 Session 过期

**症状**:
- 侧边栏显示"加载中..."
- Console 无错误（或显示 `Profile fetch error: {}`）

**解决方案**:
```bash
# 退出登录并重新登录
1. 访问 /login
2. 使用 Admin 账户登录
3. 验证跳转到 /admin/dashboard
```

---

### 原因 2: Profile 表缺失记录

**症状**:
- Console 显示 `Profile fetch error: {}`

**解决方案（在 Supabase SQL Editor 执行）**:

```sql
-- 检查当前用户的 profile
SELECT 
  p.id,
  p.role,
  p.full_name,
  u.email
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'your-admin-email@example.com';  -- 替换为你的邮箱
```

**如果没有结果**:
```sql
-- 手动创建 profile
INSERT INTO profiles (id, role, full_name)
VALUES (
  'your-user-id',  -- 替换为实际的 user id
  'admin',
  'Admin User'
);
```

---

### 原因 3: `loading` 状态没有被设置为 `false`

**症状**:
- 侧边栏永远显示"加载中..."
- Console 无错误

**临时修复**: 添加调试日志

**修改 `components/providers/user-provider.tsx`**:

在 `fetchUser` 函数中添加日志：

```typescript
const fetchUser = async () => {
  console.log('🔍 [UserProvider] fetchUser started')
  try {
    const currentUser = await getCurrentUser()
    console.log('✅ [UserProvider] getCurrentUser returned:', currentUser)
    setUser(currentUser)
  } catch (error) {
    console.error('❌ [UserProvider] Error fetching user:', error)
    setUser(null)
  } finally {
    console.log('✅ [UserProvider] setLoading(false)')
    setLoading(false)
  }
}
```

**刷新页面后检查 Console**:
- 应该看到 `🔍 [UserProvider] fetchUser started`
- 应该看到 `✅ [UserProvider] setLoading(false)`

**如果没有看到这些日志**:
- 🚨 **问题**: `UserProvider` 没有被正确挂载
- **检查**: `app/layout.tsx` 是否包含 `<UserProvider>`

---

### 原因 4: `getCurrentUser()` 卡住

**症状**:
- 看到 `fetchUser started` 但没有 `setLoading(false)`

**修复**: 添加超时保护

**修改 `components/providers/user-provider.tsx`**:

```typescript
const fetchUser = async () => {
  try {
    // 添加超时保护
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('User fetch timeout')), 5000)
    })

    const currentUser = await Promise.race([
      getCurrentUser(),
      timeoutPromise
    ])

    setUser(currentUser as AuthUser | null)
  } catch (error) {
    console.error('Error fetching user:', error)
    setUser(null)
  } finally {
    setLoading(false)
  }
}
```

---

## 🚀 快速修复：强制显示侧边栏

如果你想暂时绕过加载状态，可以修改 `admin-layout.tsx`:

```typescript
// 将第 72 行改为：
{false && userLoading ? (  // ⚠️ 临时修复：强制跳过加载
  <div className="px-4 py-2 text-sm text-muted-foreground">加载中...</div>
) : (
```

**⚠️ 这只是临时方案，不会解决根本问题！**

---

## 📋 诊断报告模板

请按以下格式提供诊断信息：

```
1. Console 错误：
   [粘贴 Console 中的错误信息]

2. Auth Status：
   [粘贴 checkAuth() 的输出]

3. Network 请求：
   有/没有 失败的请求
   [如果有，粘贴请求详情]

4. 当前登录用户：
   邮箱: xxx@example.com
   角色: admin / merchant / 未知
```

---

**请执行 Step 1-4，然后把结果告诉我！** 🔍

