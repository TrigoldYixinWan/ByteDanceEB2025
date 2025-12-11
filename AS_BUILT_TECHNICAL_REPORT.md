# 📋 系统当前实施状态技术报告 (As-Built Technical Report)

**生成日期**: 2025-12-11  
**系统版本**: Phase 2 Complete (Real Auth Implementation)  
**状态**: ✅ MVP Ready (Mock Data for Documents/Chat)

---

## 📖 目录

1. [系统架构概览](#1-系统架构概览)
2. [认证与用户状态架构](#2-认证与用户状态架构)
3. [侧边栏逻辑与角色权限](#3-侧边栏逻辑与角色权限)
4. [中间件与路由保护](#4-中间件与路由保护)
5. [数据库连接状态](#5-数据库连接状态)
6. [API 状态检查](#6-api-状态检查)
7. [文件结构与关键路径](#7-文件结构与关键路径)
8. [已知问题与限制](#8-已知问题与限制)
9. [下一步计划](#9-下一步计划)

---

## 1. 系统架构概览

### 技术栈
- **Frontend**: Next.js 15 (App Router) + React 19
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **ORM**: @supabase/supabase-js + @supabase/ssr
- **Vector Store**: pgvector (for future RAG)
- **Type Safety**: TypeScript 5.x

### 部署架构
```
┌─────────────────────────────────────────────────────────┐
│                     Next.js Frontend                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   /login    │  │  /portal/*  │  │  /admin/*   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Supabase Client (Browser)
                     │ Supabase Middleware (Server)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Supabase Backend                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Auth      │  │   Database  │  │   Storage   │     │
│  │  (auth.*)   │  │  (public.*) │  │  (files)    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 认证与用户状态架构

### 2.1 调用链 (Call Chain)

```
用户登录/注册 
  ↓
lib/api/auth.ts (signIn / signUp)
  ↓
Supabase Auth API (signInWithPassword / signUp)
  ↓
✅ Auth Success → 返回 authData.user
  ↓
查询 public.profiles 表 (根据 user.id)
  ↓
✅ Profile Found → 返回 { id, email, profile }
  ↓
app/login/page.tsx 接收 AuthUser
  ↓
根据 profile.role 重定向:
  - admin → /admin/dashboard
  - merchant → /portal
  ↓
UserProvider 通过 onAuthStateChange 监听
  ↓
全局 useUser() hook 可用
```

### 2.2 核心代码 - `lib/api/auth.ts`

#### **signIn 函数**
```typescript
export async function signIn(credentials: SignInCredentials): Promise<AuthUser> {
  const supabase = createClient()

  // Step 1: Authenticate with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  })

  if (authError) throw new Error(authError.message)
  if (!authData.user) throw new Error('登录失败')

  // Step 2: Fetch user profile from profiles table
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single()

  if (profileError) {
    console.error('Profile fetch error:', profileError)
  }

  // Step 3: Transform profile from snake_case to camelCase
  const profile: Profile | null = profileData
    ? {
        id: profileData.id,
        role: profileData.role,
        fullName: profileData.full_name,
        createdAt: profileData.created_at,
        updatedAt: profileData.updated_at,
      }
    : null

  return { id: authData.user.id, email: authData.user.email!, profile }
}
```

#### **signUp 函数** (带重试机制)
```typescript
export async function signUp(credentials: SignUpCredentials): Promise<AuthUser> {
  const supabase = createClient()

  // Step 1: Create auth user (传递 metadata 给触发器)
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

  if (authError) throw new Error(authError.message)
  if (!authData.user) throw new Error('注册失败：无法创建用户')

  // Step 2: 等待触发器执行 (500ms)
  await new Promise(resolve => setTimeout(resolve, 500))

  // Step 3: Upsert profile (确保存在)
  await supabase
    .from('profiles')
    .upsert({
      id: authData.user.id,
      full_name: credentials.fullName || null,
      role: credentials.role || 'merchant',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

  // Step 4: 重试查询 profile (最多3次，每次等待500ms)
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

  // Step 5: 如果仍然没有，手动插入
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
      throw new Error('无法创建用户配置文件，请联系管理员')
    }
    profileData = newProfile
  }

  return {
    id: authData.user.id,
    email: authData.user.email!,
    profile: { /* transformed profile */ },
  }
}
```

#### **getCurrentUser 函数**
```typescript
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = createClient()

  // Step 1: Get auth user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) return null

  // Step 2: Fetch profile
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('Profile fetch error:', profileError)
    return {
      id: user.id,
      email: user.email!,
      profile: null, // 允许没有 profile 的情况
    }
  }

  return {
    id: user.id,
    email: user.email!,
    profile: { /* transformed profile */ },
  }
}
```

### 2.3 核心代码 - `components/providers/user-provider.tsx`

#### **UserProvider 组件**
```typescript
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // 初始化：获取当前用户
  const fetchUser = async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      console.error('Error fetching user:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()

    // 监听 Auth 状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await fetchUser() // 重新获取用户和 profile
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          router.push('/login')
        } else if (event === 'TOKEN_REFRESHED') {
          await fetchUser()
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  const signOut = async () => {
    try {
      await authSignOut()
      setUser(null)
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  return (
    <UserContext.Provider value={{ user, loading, signOut, refreshUser: fetchUser }}>
      {children}
    </UserContext.Provider>
  )
}
```

#### **useUser Hook**
```typescript
export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
```

**使用方式**:
```typescript
const { user, loading, signOut } = useUser()

console.log(user?.profile?.role) // 'admin' | 'merchant'
console.log(user?.email)
```

---

## 3. 侧边栏逻辑与角色权限

### 3.1 Merchant Sidebar (商户侧边栏)

**文件**: `components/merchant-layout.tsx`

#### **导航项定义**
```typescript
const navigationItems = [
  {
    name: "知识库主页",
    href: "/portal",
    icon: Home,
    roles: ['merchant'], // 只有 merchant 可见
  },
  {
    name: "AI 聊天",
    href: "/portal/chat",
    icon: MessageSquare,
    roles: ['merchant'], // ✅ 关键需求：Chat 仅对 merchant 可见
  },
  {
    name: "文档浏览",
    href: "/portal/knowledge/demo-id",
    icon: FileText,
    roles: ['merchant'],
  },
]
```

#### **角色过滤逻辑**
```typescript
const { user, signOut, loading: userLoading } = useUser()

// 根据当前用户的 role 过滤导航项
const filteredNavItems = navigationItems.filter((item) =>
  item.roles.includes(user?.profile?.role || '')
)
```

**结果**: 如果 `user.profile.role !== 'merchant'`，所有项都会被过滤掉。

#### **高亮状态逻辑**
```typescript
const pathname = usePathname()

const isActive = pathname === item.href || 
  (item.href !== '/portal' && pathname?.startsWith(item.href + "/"))
```

**逻辑说明**:
- `/portal` 只有在完全匹配时才高亮（避免在 `/portal/chat` 时也高亮）
- 其他路径支持子路径高亮（例如 `/portal/chat/123` 也会高亮 `/portal/chat`）

---

### 3.2 Admin Sidebar (管理员侧边栏)

**文件**: `components/admin-layout.tsx`

#### **导航项定义**
```typescript
const navigationItems = [
  {
    name: "文档管理",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    roles: ['admin'], // 只有 admin 可见
  },
  {
    name: "上传文档",
    href: "/admin/upload",
    icon: Upload,
    roles: ['admin'],
  },
  {
    name: "分析报告",
    href: "/admin/analytics",
    icon: BarChart3,
    roles: ['admin'], // ✅ 关键需求：Analytics 仅对 admin 可见
  },
]
```

#### **角色过滤逻辑**
```typescript
const { user } = useUser()

const filteredNavItems = navigationItems.filter((item) =>
  item.roles.includes(user?.profile?.role || '')
)
```

**结果**: 如果 `user.profile.role !== 'admin'`，所有项都会被过滤掉。

---

### 3.3 退出登录按钮

**两个 Layout 都实现了相同的退出逻辑**:

```typescript
const [loading, setLoading] = useState(false)
const { signOut } = useUser()

const handleSignOut = async (e: React.MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  
  try {
    setLoading(true)
    await signOut() // 调用 UserProvider 的 signOut
  } catch (error) {
    console.error('Logout error:', error)
    alert('退出登录失败，请重试')
  } finally {
    setLoading(false)
  }
}

<Button onClick={handleSignOut} disabled={loading}>
  <LogOut className="mr-2 h-4 w-4" />
  退出登录
</Button>
```

**流程**:
1. 调用 `await signOut()`
2. UserProvider 执行 `supabase.auth.signOut()`
3. 监听器触发 `SIGNED_OUT` 事件
4. 自动 `router.push('/login')`

---

## 4. 中间件与路由保护

### 4.1 Middleware 配置

**文件**: `middleware.ts`

```typescript
import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**作用**: 对所有路径（除静态资源）执行 `updateSession`。

---

### 4.2 Middleware 实现

**文件**: `lib/supabase/middleware.ts`

#### **完整逻辑**
```typescript
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          // 同步 cookies 到 request 和 response
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // ✅ 获取当前用户
  const { data: { user } } = await supabase.auth.getUser()

  // 路由分类
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  const isPortalRoute = request.nextUrl.pathname.startsWith('/portal')
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')

  // ✅ 规则 1: 未登录用户访问登录页 → 允许
  if (isAuthRoute && !user) {
    return supabaseResponse
  }

  // ✅ 规则 2: 未登录用户访问受保护路由 → 重定向到 /login
  if (!user && (isPortalRoute || isAdminRoute)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ✅ 规则 3: 已登录用户 → 获取 profile 并强制角色检查
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError)
      // Profile 不存在 → 重定向到登录页
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    const userRole = profile.role

    // ✅ 规则 4: Admin 路由严格要求 admin 角色
    if (isAdminRoute && userRole !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/portal' // Merchant 重定向到 /portal
      return NextResponse.redirect(url)
    }

    // ✅ 规则 5: Portal 路由严格要求 merchant 角色
    if (isPortalRoute && userRole !== 'merchant') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/dashboard' // Admin 重定向到 /admin/dashboard
      return NextResponse.redirect(url)
    }

    // ✅ 规则 6: 已登录用户访问登录页 → 根据角色重定向
    if (isAuthRoute) {
      const url = request.nextUrl.clone()
      url.pathname = userRole === 'admin' ? '/admin/dashboard' : '/portal'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
```

---

### 4.3 路由保护总结表

| 用户状态 | 访问路由 | 结果 |
|---------|---------|------|
| ❌ 未登录 | `/login` | ✅ 允许访问 |
| ❌ 未登录 | `/portal/*` | ❌ 重定向到 `/login` |
| ❌ 未登录 | `/admin/*` | ❌ 重定向到 `/login` |
| ✅ Merchant | `/portal/*` | ✅ 允许访问 |
| ✅ Merchant | `/admin/*` | ❌ 重定向到 `/portal` |
| ✅ Admin | `/admin/*` | ✅ 允许访问 |
| ✅ Admin | `/portal/*` | ❌ 重定向到 `/admin/dashboard` |
| ✅ 任何角色 | `/login` | ❌ 重定向到对应的 dashboard |

---

## 5. 数据库连接状态

### 5.1 Supabase 客户端配置

#### **Browser Client** (`lib/supabase/client.ts`)
```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**用途**: 客户端组件（React Components）

---

#### **Server Client** (`lib/supabase/server.ts`)
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component 调用时忽略
          }
        },
      },
    }
  )
}
```

**用途**: Server Components, Server Actions, Route Handlers

---

### 5.2 数据库 Schema (已实施)

#### **表结构**

| 表名 | 状态 | 说明 |
|------|------|------|
| `profiles` | ✅ 已连接 | 用户角色和配置 |
| `documents` | ⚠️ Mock 数据 | 知识库文档 |
| `document_chunks` | ⚠️ Mock 数据 | 文档切片（向量化） |
| `chat_sessions` | ⚠️ Mock 数据 | 聊天会话 |
| `chat_messages` | ⚠️ Mock 数据 | 聊天消息 |
| `message_citations` | ⚠️ Mock 数据 | 消息引用关系 |

#### **Profiles 表字段**
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'merchant',
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### **Database Trigger (已部署)**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'merchant')::user_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

### 5.3 RLS (Row Level Security) 状态

**当前策略**: ⚠️ **开发模式 - 公开访问（用于快速 MVP）**

```sql
-- Profiles 表：允许所有操作（临时）
CREATE POLICY "Public Access" ON profiles FOR ALL USING (true);

-- ⚠️ 生产环境需要锁定：
-- CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
-- CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
```

**计划**: 在 Phase 3 实施严格的 RLS。

---

## 6. API 状态检查

### 6.1 已实现的 API

| 功能 | 状态 | 实现方式 | 数据来源 |
|------|------|---------|---------|
| **用户认证** | ✅ 真实 API | `lib/api/auth.ts` | Supabase Auth |
| **获取 Profile** | ✅ 真实 API | `lib/api/auth.ts` | Supabase DB (`profiles`) |
| **创建 Profile** | ✅ 真实 API | Database Trigger + Manual Upsert | Supabase DB |
| **退出登录** | ✅ 真实 API | `signOut()` | Supabase Auth |
| **获取文档列表** | ❌ Mock 数据 | 硬编码在 `app/admin/dashboard/page.tsx` | `MOCK_DOCUMENTS` |
| **上传文档** | ❌ Mock 数据 | 硬编码在 `app/admin/upload/page.tsx` | `setTimeout` 模拟 |
| **AI 聊天** | ❌ Mock 数据 | 硬编码在 `app/portal/chat/page.tsx` | `MOCK_SOURCES` |
| **文档详情** | ❌ Mock 数据 | 硬编码在 `app/portal/knowledge/[id]/page.tsx` | `MOCK_DOCUMENT` |

---

### 6.2 Mock 数据示例

#### **Admin Dashboard** (`app/admin/dashboard/page.tsx`)
```typescript
const MOCK_DOCUMENTS: Document[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440001", // UUID
    title: "如何设置您的商户账户",
    category: "快速开始",
    status: "ready",
    citationCount: 24,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
  // ... 更多 mock 数据
]
```

#### **Portal Chat** (`app/portal/chat/page.tsx`)
```typescript
const MOCK_SOURCES: MessageSource[] = [
  { 
    id: "550e8400-e29b-41d4-a716-446655440002", 
    title: "支付处理指南", 
    category: "财务与支付" 
  },
  // ... 更多 mock 数据
]
```

---

### 6.3 API 路由 (未实现)

**目录**: `app/api/` → ❌ **不存在**

**需要实现的 API**:
- `POST /api/documents/upload` - 上传文档
- `GET /api/documents` - 获取文档列表
- `GET /api/documents/[id]` - 获取文档详情
- `DELETE /api/documents/[id]` - 删除文档
- `POST /api/chat/messages` - 发送聊天消息
- `GET /api/chat/sessions` - 获取聊天会话
- `GET /api/analytics/stats` - 获取统计数据

---

## 7. 文件结构与关键路径

### 7.1 目录树（简化版）

```
merchant-kb/
├── app/
│   ├── layout.tsx              # 根布局（包裹 UserProvider）
│   ├── page.tsx                # 首页（重定向到 /login）
│   ├── login/
│   │   └── page.tsx            # ✅ 登录/注册页（真实 Auth）
│   ├── portal/                 # Merchant 路由
│   │   ├── page.tsx            # ✅ 知识库主页（Mock 数据）
│   │   ├── chat/
│   │   │   └── page.tsx        # ✅ AI 聊天（Mock 数据）
│   │   └── knowledge/[id]/
│   │       └── page.tsx        # ✅ 文档详情（Mock 数据）
│   └── admin/                  # Admin 路由
│       ├── dashboard/
│       │   └── page.tsx        # ✅ 文档管理（Mock 数据）
│       ├── upload/
│       │   └── page.tsx        # ✅ 上传页面（Mock 数据）
│       └── analytics/
│           └── page.tsx        # ✅ 分析页面（Mock 数据）
├── components/
│   ├── merchant-layout.tsx     # ✅ Merchant Sidebar + Layout
│   ├── admin-layout.tsx        # ✅ Admin Sidebar + Layout
│   ├── providers/
│   │   └── user-provider.tsx   # ✅ 全局用户状态管理
│   └── ui/                     # shadcn/ui 组件
├── lib/
│   ├── api/
│   │   └── auth.ts             # ✅ Auth API（真实实现）
│   └── supabase/
│       ├── client.ts           # ✅ Browser Client
│       ├── server.ts           # ✅ Server Client
│       └── middleware.ts       # ✅ Session + 路由保护
├── types/
│   ├── index.ts                # ✅ Frontend 类型（camelCase）
│   └── database.ts             # ✅ Database 类型（snake_case）
├── middleware.ts               # ✅ Next.js Middleware 入口
└── schema.sql                  # ✅ 完整数据库 Schema
```

---

### 7.2 关键文件依赖图

```
app/layout.tsx
  ├─> components/providers/user-provider.tsx
  │     ├─> lib/api/auth.ts (getCurrentUser)
  │     └─> lib/supabase/client.ts
  │
  └─> app/login/page.tsx
        ├─> lib/api/auth.ts (signIn, signUp)
        └─> useRouter (重定向)

app/portal/page.tsx
  └─> components/merchant-layout.tsx
        ├─> components/providers/user-provider.tsx (useUser)
        └─> 过滤导航项 (roles: ['merchant'])

app/admin/dashboard/page.tsx
  └─> components/admin-layout.tsx
        ├─> components/providers/user-provider.tsx (useUser)
        └─> 过滤导航项 (roles: ['admin'])

middleware.ts
  └─> lib/supabase/middleware.ts
        ├─> 获取 user (supabase.auth.getUser)
        ├─> 查询 profile (supabase.from('profiles'))
        └─> 根据 role 重定向
```

---

## 8. 已知问题与限制

### 8.1 ✅ 已解决的问题

| 问题 | 状态 | 解决方案 |
|------|------|---------|
| 登录后卡住 | ✅ 已解决 | 添加了 `setLoading(false)` 在重定向前 |
| Profile 不存在 | ✅ 已解决 | 添加了 Database Trigger + 手动 Upsert + 重试机制 |
| Admin 进入 Merchant 页面 | ✅ 已解决 | 修改数据库中的 `role` 为 `'admin'` |
| 自动填充用户名/密码 | ✅ 已解决 | 添加 `autoComplete="off"` + 假输入框 + `readOnly` 技巧 |
| 退出登录失效 | ✅ 已解决 | 修复了 `handleSignOut` 的 `loading` 状态和异步逻辑 |
| 注册后卡在"注册中..." | ✅ 已解决 | 重构了 `signUp` 函数，添加重试机制和 Upsert |
| 注册成功后自动登录 | ✅ 已解决 | 注册成功后返回登录界面，显示成功消息 |

---

### 8.2 ⚠️ 当前限制

#### **1. Mock 数据（未连接数据库）**
- 📄 **文档列表**: 硬编码在 `app/admin/dashboard/page.tsx`
- 💬 **聊天消息**: 硬编码在 `app/portal/chat/page.tsx`
- 📊 **统计数据**: 硬编码在 `app/admin/analytics/page.tsx`

#### **2. RLS 安全策略**
- ⚠️ 所有表都是公开访问（`FOR ALL USING (true)`）
- ⚠️ 生产环境需要严格的 RLS 策略

#### **3. 文件上传功能**
- ❌ Supabase Storage 未连接
- ❌ PDF 解析和向量化未实现

#### **4. AI 聊天功能**
- ❌ 没有真实的 LLM API 调用
- ❌ 没有 RAG（检索增强生成）
- ❌ 没有向量搜索

#### **5. 分析和热力图**
- ❌ `citation_count` 未通过触发器自动更新
- ❌ 没有真实的分析数据

---

### 8.3 🔄 Hydration Warning (非关键)

**错误信息**:
```
Warning: A tree hydrated but some attributes of the server rendered HTML 
didn't match the client properties.
```

**原因**: 
- 浏览器扩展（如密码管理器）在 HTML 加载后注入属性（如 `fdprocessedid`）
- 不影响功能，只是控制台警告

**解决方案**: 
- 在隐身模式下测试（无扩展）
- 或忽略此警告

---

## 9. 下一步计划

### Phase 3: 文档管理 API (真实数据库连接)

#### **任务清单**

1. **创建 API Routes**
   - [ ] `POST /api/documents/upload` - 上传到 Supabase Storage
   - [ ] `GET /api/documents` - 从数据库获取文档列表
   - [ ] `DELETE /api/documents/[id]` - 删除文档

2. **连接 Upload 页面**
   - [ ] 上传文件到 Supabase Storage
   - [ ] 插入记录到 `documents` 表
   - [ ] 更新 status 为 `processing`

3. **连接 Dashboard 页面**
   - [ ] 替换 `MOCK_DOCUMENTS` 为真实 API 调用
   - [ ] 实现分页和搜索

4. **PDF 处理（后台任务）**
   - [ ] 解析 PDF 内容
   - [ ] 切分文本块
   - [ ] 生成 embeddings（OpenAI API）
   - [ ] 插入 `document_chunks` 表

---

### Phase 4: AI 聊天 API (RAG Implementation)

#### **任务清单**

1. **创建 Chat API**
   - [ ] `POST /api/chat/messages` - 发送消息
   - [ ] `GET /api/chat/sessions` - 获取会话列表

2. **RAG 流程**
   - [ ] 用户消息 → 生成 embedding
   - [ ] 向量搜索 `document_chunks` (pgvector)
   - [ ] 构建 prompt (system + context + user message)
   - [ ] 调用 LLM API (OpenAI/Claude)
   - [ ] 记录 `message_citations`

3. **连接 Chat 页面**
   - [ ] 替换 `MOCK_SOURCES` 为真实 API
   - [ ] 流式响应 (SSE)

---

### Phase 5: 分析与安全

#### **任务清单**

1. **实现触发器**
   - [ ] `citation_count` 自动更新
   - [ ] 创建触发器：`ON INSERT message_citations → UPDATE document_chunks`

2. **Analytics API**
   - [ ] `GET /api/analytics/stats` - 统计数据
   - [ ] `GET /api/analytics/heatmap` - 热力图数据

3. **RLS 策略**
   - [ ] `profiles`: 用户只能查看/更新自己的 profile
   - [ ] `documents`: 所有用户可查看，只有 admin 可创建/删除
   - [ ] `chat_sessions`: 用户只能访问自己的会话
   - [ ] `chat_messages`: 用户只能访问自己会话的消息

4. **部署**
   - [ ] 环境变量配置（生产环境）
   - [ ] Vercel/Netlify 部署
   - [ ] 性能优化

---

## 10. 总结

### ✅ 已完成（Phase 2）

- **认证系统**: 完整的 Supabase Auth 集成
- **用户状态管理**: 全局 UserProvider + useUser hook
- **路由保护**: Middleware 强制角色检查
- **侧边栏逻辑**: 基于角色的动态导航
- **UI 完整性**: 所有页面都有完整的 UI（使用 Mock 数据）
- **注册流程**: 带重试机制和成功提示的完整注册流程

### ⚠️ 当前限制

- 文档、聊天、分析功能使用 **Mock 数据**
- RLS 策略为 **开发模式（公开访问）**
- 没有真实的 LLM API 或 RAG

### 🎯 MVP 状态

**核心功能**: ✅ 认证和授权完全可用  
**UI 完整性**: ✅ 所有页面可访问  
**数据连接**: ⚠️ 部分连接（仅 Auth + Profiles）  
**生产就绪**: ❌ 需要 Phase 3-5

---

**报告结束** | 生成时间: 2025-12-11

