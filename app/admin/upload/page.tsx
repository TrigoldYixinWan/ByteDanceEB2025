"use client";

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, UploadCloud, CheckCircle2, AlertCircle, FileText, Trash2 } from "lucide-react"

const CATEGORIES = [
  "商品管理",
  "实施细则",
  "招商入驻",
  "经营成长",
  "规则解读",
  "资金结算",
  "违规管理",
  "其他内容",
]

export default function AdminUploadPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    file: null as File | null,
    title: "",
    category: "",
    subcategory: "",
  })
  const [loading, setLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [filePreview, setFilePreview] = useState<{
    name: string
    size: string
    type: string
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setFormData({ ...formData, file })
      
      // 显示文件预览信息
      setFilePreview({
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type,
      })
      
      // 清除之前的错误
      setError(null)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      setFormData({ ...formData, file })
      
      // 显示文件预览信息
      setFilePreview({
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type,
      })
      
      // 清除之前的错误
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    setUploadProgress(0)

    try {
      // 验证文件
      if (!formData.file) {
        throw new Error('请选择要上传的文件')
      }

      // 验证标题和类别
      if (!formData.title.trim()) {
        throw new Error('请输入文档标题')
      }

      if (!formData.category) {
        throw new Error('请选择文档类别')
      }

      // 模拟上传进度（因为 fetch 不支持进度）
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      // 创建 FormData
      const uploadFormData = new FormData()
      uploadFormData.append('file', formData.file)
      uploadFormData.append('title', formData.title.trim())
      uploadFormData.append('category', formData.category)
      if (formData.subcategory && formData.subcategory.trim()) {
        uploadFormData.append('subcategory', formData.subcategory.trim())
      }

      console.log('📤 开始上传文件:', {
        fileName: formData.file.name,
        fileSize: formatFileSize(formData.file.size),
        title: formData.title,
        category: formData.category,
      })

      // 调用 API
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: uploadFormData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      // 详细的错误调试
      if (!response.ok) {
        console.error('❌ HTTP Error:', response.status, response.statusText)
        
        // 尝试解析错误响应
        let errorData
        try {
          const responseText = await response.text()
          console.error('📄 Response Text:', responseText)
          
          // 尝试解析为 JSON
          if (responseText) {
            errorData = JSON.parse(responseText)
          } else {
            errorData = { error: `HTTP ${response.status}: ${response.statusText}` }
          }
        } catch (parseError) {
          console.error('❌ JSON Parse Error:', parseError)
          errorData = { error: `服务器返回错误（状态码: ${response.status}）` }
        }
        
        console.error('❌ 上传失败:', errorData)
        throw new Error(errorData.error || '上传失败')
      }

      const result = await response.json()
      console.log('✅ 上传成功:', result)

      // 显示成功消息
      setSuccess(true)

      // 重置表单
      setFormData({
        file: null,
        title: "",
        category: "",
        subcategory: "",
      })
      setFilePreview(null)
      setUploadProgress(0)

      // 3秒后跳转到仪表板
      setTimeout(() => {
        router.push('/admin/dashboard')
      }, 3000)
    } catch (err) {
      console.error('❌ Upload error:', err)
      setError(err instanceof Error ? err.message : '上传失败，请重试')
      setUploadProgress(0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Back Button */}
          <Link href="/admin/dashboard">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="mr-2 w-4 h-4" />
              返回仪表板
            </Button>
          </Link>

          {/* Upload Form Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">上传新知识</CardTitle>
              <CardDescription>
                上传文档以添加到您的知识库。支持的格式：PDF、TXT、MD
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Success Alert */}
              {success && (
                <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    ✅ 文档上传成功！文件已保存至知识库，状态为"待处理"。即将跳转到仪表板...
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* File Preview */}
                {filePreview && (
                  <div className="bg-secondary/50 rounded-lg p-4 border border-border">
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 rounded p-2">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{filePreview.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {filePreview.size} • {filePreview.type || '未知类型'}
                        </p>
                        {uploadProgress > 0 && uploadProgress < 100 && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">上传中...</span>
                              <span className="font-medium">{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setFormData({ ...formData, file: null })
                          setFilePreview(null)
                          setUploadProgress(0)
                        }}
                        disabled={loading}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* File Upload Area */}
                <div className="space-y-2">
                  <Label>文档文件</Label>
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      id="file-upload"
                      accept=".pdf,.txt,.md"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center gap-3">
                      <UploadCloud className="w-12 h-12 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {formData.file ? (
                            <span className="text-primary">已选择文件</span>
                          ) : (
                            "点击上传或拖放文件"
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          支持 PDF, TXT, MD 格式（最大 50MB）
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Title Field */}
                <div className="space-y-2">
                  <Label htmlFor="title">文档标题 *</Label>
                  <Input
                    id="title"
                    placeholder="输入文档标题"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                {/* Category Field */}
                <div className="space-y-2">
                  <Label htmlFor="category">类别 *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value: string) => setFormData({ ...formData, category: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择一个类别" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subcategory Field */}
                <div className="space-y-2">
                  <Label htmlFor="subcategory">子类别（可选）</Label>
                  <Input
                    id="subcategory"
                    placeholder="输入子类别"
                    value={formData.subcategory}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={loading || !formData.file || !formData.title || !formData.category}
                  >
                    {loading ? (
                      <>
                        <UploadCloud className="mr-2 h-4 w-4 animate-pulse" />
                        上传中... {uploadProgress > 0 && `${uploadProgress}%`}
                      </>
                    ) : (
                      <>
                        <UploadCloud className="mr-2 h-4 w-4" />
                        上传文档
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    文档将以"待处理"状态保存，稍后可进行处理和向量化
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
