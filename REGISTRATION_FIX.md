# 🔧 注册卡住问题修复

## 🐛 问题描述

注册新用户后：
- ✅ 数据库已创建用户（`auth.users`）
- ✅ Profile 可能已创建（通过触发器）
- ❌ 页面卡在"注册中..."状态
- ❌ 无法重定向

## 🔍 根本原因

### 问题 1: Profile 查询失败

**原因：**
1. 触发器创建 profile 需要时间（异步）
2. 代码立即查询 profile 可能查询不到
3. 如果 profile 为 null，代码会显示错误但可能卡住

### 问题 2: 没有重试机制

**原因：**
- 如果触发器延迟，第一次查询会失败
- 代码没有重试逻辑

### 问题 3: 加载状态未正确清除

**原因：**
- 重定向前没有清除 `loading` 状态
- 导致 UI 一直显示"注册中..."

---

## ✅ 已实施的修复

### 修复 1: 添加重试机制

```typescript
// 重试查询 profile（最多3次，每次等待500ms）
let profileData = null
let retries = 3

while (retries > 0 && !profileData) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single()

  if (!error && data) {
    profileData = data
    break
  }

  if (retries > 1) {
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  retries--
}
```

### 修复 2: 使用 upsert 确保 Profile 存在

```typescript
// 使用 upsert 确保 profile 存在（如果触发器失败）
await supabase
  .from('profiles')
  .upsert({
    id: authData.user.id,
    full_name: credentials.fullName || null,
    role: credentials.role || 'merchant',
  }, {
    onConflict: 'id',
  })
```

### 修复 3: 添加最终回退

```typescript
// 如果重试后仍然没有 profile，手动创建
if (!profileData) {
  const { data: newProfile } = await supabase
    .from('profiles')
    .insert({...})
    .select()
    .single()
  
  profileData = newProfile
}
```

### 修复 4: 正确清除加载状态

```typescript
// 在重定向前清除加载状态
setLoading(false)
router.push('/portal')
```

### 修复 5: 传递 metadata 给 Supabase

```typescript
// 在 signUp 时传递 metadata，触发器可以使用
await supabase.auth.signUp({
  email: credentials.email,
  password: credentials.password,
  options: {
    data: {
      full_name: credentials.fullName || null,
      role: credentials.role || 'merchant',
    },
  },
})
```

---

## 🧪 测试修复

### 步骤 1: 清除浏览器缓存

```bash
# 清除 Next.js 缓存
rm -rf .next
npm run dev
```

### 步骤 2: 测试注册

1. **访问登录页面**
2. **点击 "立即注册"**
3. **填写表单**：
   ```
   姓名：测试用户（可选）
   邮箱：newuser@test.com
   密码：Test123456!
   ```
4. **点击 "注册"**

### 步骤 3: 检查结果

**期望行为：**
- ✅ 显示"注册中..."（短暂）
- ✅ 控制台显示：`User authenticated: { email: "...", role: "merchant", ... }`
- ✅ 控制台显示：`Redirecting to merchant portal`
- ✅ 自动重定向到 `/portal`
- ✅ 不再卡住

**如果仍然卡住：**
- 打开浏览器控制台（F12）
- 查看是否有错误消息
- 检查 Network 标签，查看 API 请求状态

---

## 🔍 诊断步骤

### 如果问题仍然存在

#### 1. 检查浏览器控制台

查看是否有错误：
- `Profile missing for user: ...`
- `Profile fetch error: ...`
- `无法创建用户配置文件`

#### 2. 检查数据库

在 Supabase SQL Editor 中运行：

```sql
-- 检查最新注册的用户
SELECT 
  u.id,
  u.email,
  u.created_at,
  p.role,
  p.full_name,
  CASE 
    WHEN p.id IS NULL THEN '❌ 缺少 Profile'
    ELSE '✅ Profile 存在'
  END as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 5;
```

#### 3. 检查触发器

```sql
-- 检查触发器是否存在
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

#### 4. 手动创建 Profile（临时修复）

如果用户已创建但没有 profile：

```sql
-- 替换 'user-email@example.com' 为实际邮箱
INSERT INTO profiles (id, role, full_name)
SELECT 
  u.id,
  'merchant',
  u.raw_user_meta_data->>'full_name'
FROM auth.users u
WHERE u.email = 'user-email@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = u.id
  );
```

---

## 📋 修复检查清单

- [x] 添加了重试机制（最多3次）
- [x] 使用 upsert 确保 profile 存在
- [x] 添加了最终回退（手动创建 profile）
- [x] 在重定向前清除 loading 状态
- [x] 传递 metadata 给 Supabase Auth
- [x] 改进了错误日志

---

## 🎯 预期行为

修复后，注册流程应该是：

```
1. 用户填写表单
   ↓
2. 点击"注册"
   ↓
3. 显示"注册中..."（loading=true）
   ↓
4. 创建 auth.users 记录
   ↓
5. 触发器自动创建 profile（或手动创建）
   ↓
6. 查询 profile（带重试）
   ↓
7. 获取到 profile ✅
   ↓
8. 清除 loading 状态
   ↓
9. 重定向到 /portal ✅
```

---

## 🆘 如果仍然有问题

请提供：
1. 浏览器控制台的完整错误消息
2. Network 标签中的 API 请求状态
3. 数据库中用户的 profile 状态（运行上面的 SQL）

---

**现在请测试注册功能，应该不会再卡住了！** 🚀

