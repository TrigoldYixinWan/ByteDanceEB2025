# 🔧 Admin 登录问题修复指南

## 🐛 问题描述

Admin 用户登录后，被重定向到 `/portal`（商户页面）而不是 `/admin/dashboard`。

## 🔍 可能的原因

1. **数据库中的 role 不正确**（最可能）
   - Admin 用户的 `profiles.role` 可能是 `'merchant'` 而不是 `'admin'`

2. **Profile 数据缺失**
   - Admin 用户可能没有对应的 profile 记录

3. **缓存问题**
   - 浏览器或 Next.js 缓存了旧的用户状态

---

## ✅ 修复步骤

### 步骤 1: 诊断问题（在 Supabase SQL Editor 中运行）

```sql
-- 查看所有用户的角色
SELECT 
  u.email,
  p.role,
  CASE 
    WHEN p.role = 'admin' THEN '✅ 正确'
    WHEN p.role = 'merchant' THEN '⚠️ 需要修复为 admin'
    WHEN p.id IS NULL THEN '❌ 缺少 Profile'
    ELSE '❓ 未知'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.email;
```

**检查结果：**
- 如果 admin 用户的 `role` 显示为 `'merchant'` → 需要修复
- 如果显示 `NULL` → 需要创建 profile

---

### 步骤 2: 修复 Admin 角色

**在 Supabase SQL Editor 中运行：**

```sql
-- 将您的 admin 用户设置为 admin 角色
-- 替换 'admin@test.com' 为您的实际 admin 邮箱

UPDATE public.profiles 
SET role = 'admin',
    updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@test.com');

-- 验证修复
SELECT 
  u.email,
  p.role,
  '✅ 已修复为 Admin' as status
FROM auth.users u
JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'admin@test.com';
```

**如果您的 admin 邮箱不同，请修改：**
```sql
-- 例如，如果您的 admin 邮箱是 admin@example.com
UPDATE public.profiles 
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
```

---

### 步骤 3: 如果 Admin 用户没有 Profile

**运行这个来创建 profile：**

```sql
-- 为 admin 用户创建 profile（如果不存在）
INSERT INTO public.profiles (id, role, full_name, created_at, updated_at)
SELECT 
  u.id,
  'admin' as role,
  u.raw_user_meta_data->>'full_name' as full_name,
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'admin@test.com'  -- 替换为您的 admin 邮箱
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
  );
```

---

### 步骤 4: 清除缓存并重新登录

1. **清除浏览器缓存**
   - 按 `Ctrl+Shift+Delete`
   - 选择 "缓存的图片和文件"
   - 清除

2. **清除 Next.js 缓存**
   ```bash
   # 在项目目录中
   rm -rf .next
   npm run dev
   ```

3. **重新登录**
   - 访问 http://localhost:3000
   - 使用 admin 账户登录
   - 应该重定向到 `/admin/dashboard` ✅

---

## 🧪 验证修复

### 方法 1: 检查浏览器控制台

登录后，打开浏览器控制台（F12），应该看到：

```
User logged in: {
  email: "admin@test.com",
  role: "admin",  ← 应该是 "admin"
  profile: {...}
}
Redirecting to admin dashboard  ← 应该看到这个
```

### 方法 2: 检查 URL

登录后，URL 应该是：
- ✅ `http://localhost:3000/admin/dashboard`（正确）
- ❌ `http://localhost:3000/portal`（错误，说明 role 还是 merchant）

---

## 🔄 快速修复脚本

**一键修复（在 Supabase SQL Editor 中运行）：**

```sql
-- 完整修复脚本
-- 1. 检查当前状态
SELECT 
  u.email,
  p.role,
  CASE 
    WHEN p.role = 'admin' THEN '✅ 正确'
    WHEN p.role = 'merchant' THEN '⚠️ 需要修复'
    WHEN p.id IS NULL THEN '❌ 缺少 Profile'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id;

-- 2. 修复所有可能的 admin 用户（请根据实际情况修改邮箱）
UPDATE public.profiles 
SET role = 'admin', updated_at = NOW()
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('admin@test.com', 'admin@example.com')  -- 修改为您的 admin 邮箱
);

-- 3. 验证
SELECT u.email, p.role 
FROM auth.users u
JOIN public.profiles p ON u.id = p.id
WHERE p.role = 'admin';
```

---

## 📋 常见问题

### Q: 如何知道我的 admin 邮箱是什么？

**A:** 在 Supabase Dashboard：
1. 点击 **Authentication** → **Users**
2. 查看用户列表
3. 找到您想设为 admin 的用户邮箱

### Q: 修复后还是不行？

**A:** 尝试以下步骤：

1. **检查数据库**
   ```sql
   SELECT u.email, p.role 
   FROM auth.users u
   JOIN public.profiles p ON u.id = p.id
   WHERE u.email = 'your-admin-email@example.com';
   ```
   确保 `role` 是 `'admin'`（小写）

2. **检查浏览器控制台**
   - 查看是否有错误
   - 查看 "User logged in" 日志中的 role

3. **清除所有缓存**
   ```bash
   # 停止服务器
   # 删除 .next 文件夹
   rm -rf .next
   # 重新启动
   npm run dev
   ```

4. **使用无痕窗口测试**
   - 避免浏览器扩展干扰

### Q: 可以批量设置多个 admin 吗？

**A:** 可以，运行：

```sql
UPDATE public.profiles 
SET role = 'admin', updated_at = NOW()
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('admin1@test.com', 'admin2@test.com', 'admin3@test.com')
);
```

---

## ✅ 修复检查清单

- [ ] 在 Supabase 中检查了用户角色
- [ ] 确认 admin 用户的 role 是 `'admin'`
- [ ] 运行了 UPDATE 语句修复角色
- [ ] 验证了修复结果（SELECT 查询）
- [ ] 清除了浏览器缓存
- [ ] 清除了 Next.js 缓存（删除 .next）
- [ ] 重新启动了开发服务器
- [ ] 在无痕窗口测试登录
- [ ] 检查了浏览器控制台日志
- [ ] 确认重定向到 `/admin/dashboard`

---

## 🎯 预期结果

修复后，当您用 admin 账户登录时：

1. ✅ 登录成功
2. ✅ 控制台显示：`role: "admin"`
3. ✅ 控制台显示：`Redirecting to admin dashboard`
4. ✅ URL 变为：`http://localhost:3000/admin/dashboard`
5. ✅ 侧边栏显示 "分析报告" 链接
6. ✅ 侧边栏显示用户信息（邮箱和 "admin" 角色）

---

**现在立即在 Supabase SQL Editor 中运行诊断查询，然后修复角色！** 🚀

