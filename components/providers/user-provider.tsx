"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, signOut as authSignOut } from '@/lib/api/auth'
import type { AuthUser } from '@/lib/api/auth'

interface UserContextType {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // Fetch current user on mount
  const fetchUser = async () => {
    console.log('🔍 [UserProvider] fetchUser started')
    
    try {
      const currentUser = await getCurrentUser()
      console.log('✅ [UserProvider] getCurrentUser returned:', currentUser?.email)
      setUser(currentUser)
    } catch (error) {
      console.error('❌ [UserProvider] Error fetching user:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 [UserProvider] Auth state change:', event)
      
      if (event === 'SIGNED_IN' && session) {
        await fetchUser()
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        router.push('/login')
      } else if (event === 'TOKEN_REFRESHED') {
        // ⚠️ Token refresh 时不重新获取用户
        // 用户数据不会因为 token refresh 而改变
        console.log('✅ [UserProvider] Token refreshed, keeping existing user')
        // 不调用 fetchUser()，保持现有用户数据
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const refreshUser = async () => {
    await fetchUser()
  }

  return (
    <UserContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

