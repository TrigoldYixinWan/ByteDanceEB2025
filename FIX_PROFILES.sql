-- ============================================
-- 修复：为现有用户创建 Profile
-- ============================================
-- 这个脚本会为所有没有 profile 的 auth.users 创建 profile 记录

-- 查看哪些用户缺少 profile
SELECT 
  u.id,
  u.email,
  u.created_at,
  CASE 
    WHEN p.id IS NULL THEN '❌ 缺少 Profile'
    ELSE '✅ Profile 存在'
  END as profile_status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- ============================================
-- 为缺少 profile 的用户创建记录
-- ============================================

-- 为所有缺少 profile 的用户创建 merchant profile
INSERT INTO public.profiles (id, role, full_name, created_at, updated_at)
SELECT 
  u.id,
  'merchant' as role,  -- 默认为 merchant
  u.raw_user_meta_data->>'full_name' as full_name,
  NOW() as created_at,
  NOW() as updated_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL  -- 只插入缺少 profile 的用户
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 验证：检查所有用户现在都有 profile
-- ============================================

SELECT 
  u.id,
  u.email,
  p.role,
  p.full_name,
  CASE 
    WHEN p.id IS NULL THEN '❌ 仍然缺少'
    ELSE '✅ 已修复'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- ============================================
-- (可选) 将特定用户提升为 admin
-- ============================================

-- 如果您想将某个用户设为 admin，运行：
-- UPDATE public.profiles 
-- SET role = 'admin' 
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@test.com');

-- 成功消息
DO $$
BEGIN
  RAISE NOTICE '✅ Profile 修复完成！';
  RAISE NOTICE '✅ 所有用户现在都应该有 profile 了';
  RAISE NOTICE '提示：如需创建 admin 用户，请取消注释上面的 UPDATE 语句';
END $$;

