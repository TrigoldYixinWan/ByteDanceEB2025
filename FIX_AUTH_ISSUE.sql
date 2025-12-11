-- ============================================
-- 完整修复：登录卡住问题
-- ============================================
-- 修复 RLS 权限 + 创建缺失的 profiles
-- ============================================

-- 步骤 1: 诊断当前状态
SELECT '=== 当前用户状态 ===' as step;

SELECT 
  u.id,
  u.email,
  u.created_at,
  p.role,
  CASE 
    WHEN p.id IS NULL THEN '❌ 缺少 Profile'
    ELSE '✅ Profile 存在'
  END as profile_status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- 步骤 2: 修复 RLS 策略
SELECT '=== 修复 RLS 策略 ===' as step;

-- 删除旧策略
DROP POLICY IF EXISTS "Public access to profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;

-- 创建新的、更宽松的策略（适用于 MVP）
CREATE POLICY "Allow all operations on profiles"
ON profiles
FOR ALL
USING (true)
WITH CHECK (true);

-- 步骤 3: 为缺失的用户创建 profiles
SELECT '=== 创建缺失的 Profiles ===' as step;

INSERT INTO profiles (id, role, full_name, created_at, updated_at)
SELECT 
  u.id,
  COALESCE(
    (u.raw_user_meta_data->>'role')::text,
    'merchant'
  ) as role,
  u.raw_user_meta_data->>'full_name' as full_name,
  NOW() as created_at,
  NOW() as updated_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- 步骤 4: 验证修复结果
SELECT '=== 验证结果 ===' as step;

SELECT 
  u.email,
  p.role,
  p.full_name,
  p.created_at,
  '✅ 已修复' as status
FROM auth.users u
INNER JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- 步骤 5: 检查 RLS 状态
SELECT '=== RLS 策略状态 ===' as step;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles';

-- 完成
DO $$
BEGIN
  RAISE NOTICE '✅ 修复完成！';
  RAISE NOTICE '现在可以尝试登录了';
  RAISE NOTICE '如果还有问题，请检查浏览器控制台';
END $$;

