"use client";

import { ReactNode, useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, Home, MessageSquare, FileText, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/components/providers/user-provider"

// localStorage key prefix for last viewed document (per user)
const LAST_VIEWED_DOC_KEY_PREFIX = 'merchant-kb-last-viewed-doc'

// 获取带用户 ID 的 localStorage key
function getStorageKey(userId: string | undefined): string {
  return userId ? `${LAST_VIEWED_DOC_KEY_PREFIX}-${userId}` : LAST_VIEWED_DOC_KEY_PREFIX
}

// 获取最后访问的文档信息（需要传入用户 ID）
export function getLastViewedDocument(userId?: string): { id: string; title: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const key = getStorageKey(userId)
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to get last viewed document:', e)
  }
  return null
}

// 保存最后访问的文档信息（需要传入用户 ID）
export function setLastViewedDocument(id: string, title: string, userId?: string) {
  if (typeof window === 'undefined') return
  try {
    const key = getStorageKey(userId)
    localStorage.setItem(key, JSON.stringify({ id, title }))
  } catch (e) {
    console.error('Failed to save last viewed document:', e)
  }
}

interface MerchantLayoutProps {
  children: ReactNode
}

function Sidebar() {
  const pathname = usePathname()
  const { user, signOut, loading: userLoading } = useUser()
  const [loading, setLoading] = useState(false)

  // 最后访问的文档
  const [lastViewedDoc, setLastViewedDoc] = useState<{ id: string; title: string } | null>(null)

  // 从 localStorage 加载最后访问的文档（依赖用户 ID）
  useEffect(() => {
    if (userLoading) return // 等待用户加载完成
    
    const userId = user?.id
    setLastViewedDoc(getLastViewedDocument(userId))
    
    // 监听 storage 事件，以便在其他页面更新时同步
    const handleStorageChange = (e: StorageEvent) => {
      const expectedKey = getStorageKey(userId)
      if (e.key === expectedKey) {
        setLastViewedDoc(getLastViewedDocument(userId))
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [user?.id, userLoading])

  // 监听路径变化，刷新最后访问的文档
  useEffect(() => {
    if (pathname?.startsWith('/portal/knowledge/')) {
      // 延迟一点读取，确保详情页已经保存了
      const timer = setTimeout(() => {
        setLastViewedDoc(getLastViewedDocument(user?.id))
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [pathname, user?.id])

  // 导航项
  const navigationItems = [
    {
      name: "知识库主页",
      href: "/portal",
      icon: Home,
      roles: ['merchant'],
      disabled: false,
    },
    {
      name: "AI 聊天",
      href: "/portal/chat",
      icon: MessageSquare,
      roles: ['merchant'],
      disabled: false,
    },
    {
      // 动态显示最后访问的文档，或显示占位符
      name: lastViewedDoc 
        ? (lastViewedDoc.title.length > 12 
            ? lastViewedDoc.title.slice(0, 12) + '...' 
            : lastViewedDoc.title)
        : "文档浏览",
      href: lastViewedDoc 
        ? `/portal/knowledge/${lastViewedDoc.id}` 
        : "#",
      icon: FileText,
      roles: ['merchant'],
      disabled: !lastViewedDoc,
    },
  ]

  // Filter navigation items based on user role
  const filteredNavItems = navigationItems.filter((item) =>
    item.roles.includes(user?.profile?.role || '')
  )

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    try {
      setLoading(true) // 使用 loading 状态
      await signOut()
    } catch (error) {
      console.error('Logout error:', error)
      alert('退出登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <Link href="/portal" className="flex items-center gap-2 font-semibold">
          <span className="text-xl">🏪 商户门户</span>
        </Link>
      </div>

      <div className="flex-1 overflow-auto py-2">
        {userLoading ? (
          <div className="px-4 py-2 text-sm text-muted-foreground">加载中...</div>
        ) : (
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {filteredNavItems.map((item) => {
              const Icon = item.icon
              // 精确匹配：只有完全相等或者是子路径时才高亮
              // 但 /portal 不应该在 /portal/chat 时高亮
              const isActive = pathname === item.href || 
                (item.href !== '/portal' && item.href !== '#' && pathname?.startsWith(item.href + "/"))
              
              // 禁用状态（没有访问过文档）
              if (item.disabled) {
                return (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground/50 cursor-not-allowed"
                    title="请先访问一篇文档"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                    <span className="text-xs ml-auto">(无记录)</span>
                  </div>
                )
              }
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                    isActive
                      ? "bg-primary text-primary-foreground hover:text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        )}
      </div>

      <div className="mt-auto p-4 border-t">
        {user && (
          <div className="mb-3 px-2">
            <p className="text-xs text-muted-foreground">登录为</p>
            <p className="text-sm font-medium truncate">{user.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.profile?.role}</p>
          </div>
        )}
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleSignOut}
          disabled={loading}
        >
          <LogOut className="mr-2 h-4 w-4" />
          退出登录
        </Button>
      </div>
    </div>
  )
}

export function MerchantLayout({ children }: MerchantLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar - 固定在视窗左侧 */}
      <aside className="hidden lg:block w-64 border-r bg-card h-screen sticky top-0">
        <Sidebar />
      </aside>

      {/* Mobile Header & Menu */}
      <div className="flex flex-col flex-1">
        <header className="lg:hidden flex h-14 items-center gap-4 border-b bg-card px-4">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">切换菜单</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <Sidebar />
            </SheetContent>
          </Sheet>
          <div className="flex-1">
            <Link href="/portal" className="font-semibold text-lg">
              🏪 商户门户
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
