"use client";

import { ReactNode, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, LayoutDashboard, Upload, BarChart3, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/components/providers/user-provider"

interface AdminLayoutProps {
  children: ReactNode
}

function Sidebar() {
  const pathname = usePathname()
  const { user, signOut, loading: userLoading } = useUser()
  const [loading, setLoading] = useState(false)

  // Navigation items - filtered by role
  const navigationItems = [
    {
      name: "文档管理",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
      roles: ['admin'], // Only for admins
    },
    {
      name: "上传文档",
      href: "/admin/upload",
      icon: Upload,
      roles: ['admin'], // Only for admins
    },
    {
      name: "分析报告",
      href: "/admin/analytics",
      icon: BarChart3,
      roles: ['admin'], // Only for admins - CRITICAL REQUIREMENT
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
      setLoading(true)
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
        <Link href="/admin/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="text-xl">🛡️ 管理员后台</span>
        </Link>
      </div>

      <div className="flex-1 overflow-auto py-2">
        {userLoading ? (
          <div className="px-4 py-2 text-sm text-muted-foreground">加载中...</div>
        ) : (
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {filteredNavItems.map((item) => {
              const Icon = item.icon
              // 精确匹配：只有完全相等才高亮
              const isActive = pathname === item.href
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

export function AdminLayout({ children }: AdminLayoutProps) {
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
            <Link href="/admin/dashboard" className="font-semibold text-lg">
              🛡️ 管理员后台
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
