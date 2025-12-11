"use client";

import { ReactNode, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, Home, MessageSquare, FileText, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/components/providers/user-provider"

interface MerchantLayoutProps {
  children: ReactNode
}

function Sidebar() {
  const pathname = usePathname()
  const { user, signOut, loading: userLoading } = useUser()
  const [loading, setLoading] = useState(false)

  // Navigation items - filtered by role
  const navigationItems = [
    {
      name: "知识库主页",
      href: "/portal",
      icon: Home,
      roles: ['merchant'], // Only for merchants
    },
    {
      name: "AI 聊天",
      href: "/portal/chat",
      icon: MessageSquare,
      roles: ['merchant'], // Only for merchants - CRITICAL REQUIREMENT
    },
    {
      name: "文档浏览",
      href: "/portal/knowledge/demo-id",
      icon: FileText,
      roles: ['merchant'], // Only for merchants
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
                (item.href !== '/portal' && pathname?.startsWith(item.href + "/"))
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
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 border-r bg-card">
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
