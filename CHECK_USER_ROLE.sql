-- ============================================
-- 诊断：检查用户角色
-- ============================================
-- 运行这个查询来查看所有用户的角色

SELECT 
  u.id,
  u.email,
  u.created_at as user_created,
  p.role,
  p.full_name,
  p.created_at as profile_created,
  CASE 
    WHEN p.id IS NULL THEN '❌ 缺少 Profile'
    WHEN p.role = 'admin' THEN '✅ Admin'
    WHEN p.role = 'merchant' THEN '✅ Merchant'
    ELSE '⚠️ 未知角色'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- ============================================
-- 如果发现 Admin 用户的 role 是 'merchant'，运行这个修复：
-- ============================================

-- 将特定用户提升为 admin（替换 email）
-- UPDATE public.profiles 
-- SET role = 'admin' 
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@test.com');

-- 验证修复
-- SELECT u.email, p.role 
-- FROM auth.users u
-- JOIN public.profiles p ON u.id = p.id
-- WHERE u.email = 'admin@test.com';

