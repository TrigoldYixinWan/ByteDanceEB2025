"use client";

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { signIn, signUp } from "@/lib/api/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2 } from "lucide-react"

type AuthMode = "login" | "signup"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // 防止自动填充的技巧：组件挂载后再移除 readonly，并清除任何可能的默认值
  useEffect(() => {
    setMounted(true)
    // 确保表单字段是空的
    setEmail("")
    setPassword("")
    setFullName("")
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let user

      if (mode === "signup") {
        // 注册模式
        user = await signUp({ 
          email, 
          password, 
          fullName: fullName || undefined,
          role: 'merchant' // 默认注册为商户
        })

        // 注册成功：返回登录界面
        setLoading(false)
        setSuccess(`注册成功！账户 ${user.email} 已创建，请使用您的凭据登录。`)
        setError(null)
        
        // 切换到登录模式
        setMode("login")
        
        // 清空密码和姓名，但保留邮箱方便用户直接登录
        setPassword("")
        setFullName("")
        // 保留 email，方便用户直接登录
        
        return // 不继续执行登录逻辑
      } else {
        // 登录模式
        user = await signIn({ email, password })
      }

      // 登录逻辑（仅登录模式）
      // Check profile role and redirect accordingly
      if (!user.profile) {
        console.error('Profile missing for user:', user.email)
        setError("用户配置文件未找到，请联系管理员")
        setLoading(false)
        return
      }

      const role = user.profile.role
      
      // Debug: Log the role for troubleshooting
      console.log('User authenticated:', {
        email: user.email,
        role: role,
        profile: user.profile
      })

      // Redirect based on role
      if (role === 'admin') {
        console.log('Redirecting to admin dashboard')
        setLoading(false) // 停止加载状态
        router.push('/admin/dashboard')
        router.refresh() // Force refresh to ensure navigation
      } else if (role === 'merchant') {
        console.log('Redirecting to merchant portal')
        setLoading(false) // 停止加载状态
        router.push('/portal')
        router.refresh() // Force refresh to ensure navigation
      } else {
        console.error('Unknown role:', role)
        setError(`未知的用户角色: ${role}`)
        setLoading(false)
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError(err instanceof Error ? err.message : mode === 'signup' ? '注册失败，请检查信息' : '登录失败，请检查您的凭据')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center">商户门户</CardTitle>
          <CardDescription className="text-center">
            {mode === "login" ? "登录以访问您的知识库" : "创建新账户"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" noValidate>
            {/* 隐藏的假输入框来欺骗浏览器自动填充 */}
            <input type="text" name="fake-username" autoComplete="off" style={{ display: 'none' }} tabIndex={-1} />
            <input type="password" name="fake-password" autoComplete="off" style={{ display: 'none' }} tabIndex={-1} />
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/50">
                <CheckCircle2 className="text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">姓名（可选）</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="您的姓名"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  autoComplete="off"
                  name="fullName"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                name="email-input"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="off"
                readOnly={!mounted}
                onFocus={(e) => {
                  if (e.target.readOnly) {
                    e.target.readOnly = false
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
                readOnly={!mounted}
                onFocus={(e) => {
                  if (e.target.readOnly) {
                    e.target.readOnly = false
                  }
                }}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === "login" ? "登录中..." : "注册中..."}
                </>
              ) : (
                mode === "login" ? "登录" : "注册"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login")
                setError(null)
                setSuccess(null)
                // 清除表单数据
                setEmail("")
                setPassword("")
                setFullName("")
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              disabled={loading}
            >
              {mode === "login" ? (
                <>还没有账户？<span className="font-semibold ml-1">立即注册</span></>
              ) : (
                <>已有账户？<span className="font-semibold ml-1">返回登录</span></>
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
