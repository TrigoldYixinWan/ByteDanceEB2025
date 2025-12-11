-- ============================================
-- 修复：将 Admin 用户正确设置为 admin 角色
-- ============================================

-- 步骤 1: 查看所有用户的当前角色
SELECT '=== 当前所有用户的角色 ===' as step;

SELECT 
  u.id,
  u.email,
  p.role as current_role,
  CASE 
    WHEN p.role = 'admin' THEN '✅ 正确'
    WHEN p.role = 'merchant' THEN '⚠️ 需要修复'
    WHEN p.id IS NULL THEN '❌ 缺少 Profile'
    ELSE '❓ 未知'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.email;

-- 步骤 2: 修复 Admin 用户（请替换为您的实际 admin 邮箱）
SELECT '=== 修复 Admin 用户 ===' as step;

-- 方法 1: 如果您知道 admin 用户的邮箱，运行这个：
UPDATE public.profiles 
SET role = 'admin',
    updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@test.com');

-- 如果上面的邮箱不对，请修改为您的实际 admin 邮箱
-- 例如：WHERE email = 'your-admin-email@example.com'

-- 步骤 3: 验证修复结果
SELECT '=== 验证修复结果 ===' as step;

SELECT 
  u.email,
  p.role,
  CASE 
    WHEN p.role = 'admin' THEN '✅ Admin 用户'
    WHEN p.role = 'merchant' THEN '✅ Merchant 用户'
    ELSE '❌ 未知角色'
  END as status
FROM auth.users u
INNER JOIN public.profiles p ON u.id = p.id
ORDER BY p.role DESC, u.email;

-- 步骤 4: 如果您有多个用户需要设置为 admin
-- 取消注释并修改邮箱列表：

-- UPDATE public.profiles 
-- SET role = 'admin',
--     updated_at = NOW()
-- WHERE id IN (
--   SELECT id FROM auth.users 
--   WHERE email IN ('admin1@test.com', 'admin2@test.com')
-- );

-- 完成消息
DO $$
BEGIN
  RAISE NOTICE '✅ 修复完成！';
  RAISE NOTICE '请刷新浏览器并重新登录 Admin 账户';
  RAISE NOTICE '应该会重定向到 /admin/dashboard';
END $$;

