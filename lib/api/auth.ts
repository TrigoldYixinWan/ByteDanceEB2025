import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export interface AuthUser {
  id: string
  email: string
  profile: Profile | null
}

export interface SignInCredentials {
  email: string
  password: string
}

export interface SignUpCredentials extends SignInCredentials {
  fullName?: string
  role?: 'merchant' | 'admin'
}

/**
 * Sign in with email and password
 * Also fetches the user's profile to get their role
 */
export async function signIn(credentials: SignInCredentials): Promise<AuthUser> {
  const supabase = createClient()

  // Step 1: Authenticate with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  })

  if (authError) {
    throw new Error(authError.message)
  }

  if (!authData.user) {
    throw new Error('登录失败')
  }

  // Step 2: Fetch user profile from profiles table
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single()

  if (profileError) {
    console.error('Profile fetch error:', profileError)
    // Don't throw, profile might not exist yet
  }

  // Transform profile from snake_case to camelCase
  const profile: Profile | null = profileData
    ? {
        id: profileData.id,
        role: profileData.role,
        fullName: profileData.full_name,
        createdAt: profileData.created_at,
        updatedAt: profileData.updated_at,
      }
    : null

  return {
    id: authData.user.id,
    email: authData.user.email!,
    profile,
  }
}

/**
 * Sign up a new user
 */
export async function signUp(credentials: SignUpCredentials): Promise<AuthUser> {
  const supabase = createClient()

  // Step 1: Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      data: {
        full_name: credentials.fullName || null,
        role: credentials.role || 'merchant',
      },
    },
  })

  if (authError) {
    throw new Error(authError.message)
  }

  if (!authData.user) {
    throw new Error('注册失败：无法创建用户')
  }

  // Step 2: 触发器应该自动创建 profile，但我们需要确保它存在
  // 等待一小段时间让触发器执行
  await new Promise(resolve => setTimeout(resolve, 500))

  // Step 3: 尝试创建或更新 profile（如果触发器没有创建，或者需要更新字段）
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: authData.user.id,
      full_name: credentials.fullName || null,
      role: credentials.role || 'merchant',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id',
    })

  if (profileError) {
    console.error('Profile upsert error:', profileError)
    // 不抛出错误，继续尝试查询
  }

  // Step 4: 重试查询 profile（最多3次，每次等待500ms）
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
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    retries--
  }

  // Step 5: 如果仍然没有 profile，创建一个
  if (!profileData) {
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        full_name: credentials.fullName || null,
        role: credentials.role || 'merchant',
      })
      .select()
      .single()

    if (createError) {
      console.error('Final profile creation error:', createError)
      throw new Error('无法创建用户配置文件，请联系管理员')
    }
    profileData = newProfile
  }

  // Step 6: Transform profile
  const profile: Profile = {
    id: profileData.id,
    role: profileData.role,
    fullName: profileData.full_name,
    createdAt: profileData.created_at,
    updatedAt: profileData.updated_at,
  }

  return {
    id: authData.user.id,
    email: authData.user.email!,
    profile,
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}

/**
 * Get the current authenticated user and their profile
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  console.log('🔍 [getCurrentUser] Starting...')
  const supabase = createClient()

  // Step 1: Get auth user
  console.log('🔍 [getCurrentUser] Calling supabase.auth.getUser()...')
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  console.log('✅ [getCurrentUser] getUser() returned:', { user: user?.email, authError })

  if (authError || !user) {
    console.log('❌ [getCurrentUser] No user or auth error, returning null')
    return null
  }

  // Step 2: Fetch profile
  console.log('🔍 [getCurrentUser] Fetching profile for user:', user.id)
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  console.log('✅ [getCurrentUser] Profile query returned:', { profile: profileData?.role, profileError })

  if (profileError) {
    console.error('Profile fetch error:', profileError)
    // Return user without profile if profile doesn't exist
    return {
      id: user.id,
      email: user.email!,
      profile: null,
    }
  }

  // Transform profile
  const profile: Profile = {
    id: profileData.id,
    role: profileData.role,
    fullName: profileData.full_name,
    createdAt: profileData.created_at,
    updatedAt: profileData.updated_at,
  }

  console.log('✅ [getCurrentUser] Returning user with profile:', { email: user.email, role: profile.role })

  return {
    id: user.id,
    email: user.email!,
    profile,
  }
}

/**
 * Check if user has a specific role
 */
export async function hasRole(role: 'merchant' | 'admin'): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.profile?.role === role
}

