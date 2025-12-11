# ✅ Phase 3 实施清单

**日期**: 2025-12-11  
**状态**: 🚀 实施完成，等待测试

---

## 📦 已创建的文件

- [x] `app/api/documents/route.ts` - POST & GET API
- [x] `app/api/documents/[id]/route.ts` - DELETE & GET API
- [x] `SETUP_STORAGE_BUCKET.md` - Storage 设置指南
- [x] `PHASE3_IMPLEMENTATION_GUIDE.md` - 完整实施和测试指南
- [x] `PHASE3_CHECKLIST.md` - 本清单

---

## 📝 已修改的文件

- [x] `app/admin/dashboard/page.tsx` - 连接真实 API
- [x] `app/admin/upload/page.tsx` - 连接真实 API

---

## 🔧 在测试之前，您需要做的事情

### ⚠️ 关键步骤：创建 Storage Bucket

**选项 1: Supabase Dashboard（推荐）**
1. 访问 https://supabase.com/dashboard
2. 选择您的项目
3. 左侧菜单 → **Storage**
4. 点击 **"New bucket"**
5. 配置：
   ```
   Name: documents
   Public bucket: ✅ 勾选
   File size limit: 52428800 (50MB)
   ```
6. 点击 **"Create bucket"**

**选项 2: SQL 方式**
在 SQL Editor 中执行：
```sql
-- 创建 bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true);

-- SELECT 策略（公开读取）
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'documents' );

-- INSERT 策略（认证用户可上传）
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK ( 
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
);

-- DELETE 策略（认证用户可删除）
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING ( 
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated' 
);
```

**验证 Bucket**:
```sql
SELECT * FROM storage.buckets WHERE id = 'documents';
```

---

## 🧪 测试清单

### 测试 1: 上传文档 ✅
- [ ] 访问 `/admin/upload`
- [ ] 选择一个 PDF 文件
- [ ] 填写标题和类别
- [ ] 点击 "开始处理"
- [ ] 应该显示成功消息并跳转到 Dashboard

### 测试 2: 查看文档列表 ✅
- [ ] 访问 `/admin/dashboard`
- [ ] 应该看到刚上传的文档
- [ ] 状态显示为 "处理中"

### 测试 3: 删除文档 ✅
- [ ] 在 Dashboard 点击删除按钮
- [ ] 确认删除
- [ ] 文档应该从列表中消失

### 测试 4: 错误处理 ✅
- [ ] 尝试上传不支持的文件类型 → 应该显示错误
- [ ] 尝试上传超大文件（>50MB） → 应该显示错误
- [ ] 不选择文件 → 按钮应该禁用

### 测试 5: 空状态 ✅
- [ ] 删除所有文档后
- [ ] Dashboard 应该显示 "还没有文档" 空状态
- [ ] 应该有 "上传文档" 按钮

---

## 🔍 验证数据

### 在 Supabase Dashboard 中验证

**Storage（文件存在）**:
1. Storage → documents bucket
2. 应该看到文件夹：`{your-user-id}/`
3. 文件命名格式：`{timestamp}-{filename}.pdf`

**Database（记录存在）**:
```sql
SELECT 
  id,
  title,
  category,
  status,
  file_path,
  created_at
FROM documents
ORDER BY created_at DESC
LIMIT 10;
```

**删除后验证（文件和记录都应该不存在）**:
```sql
-- 应该返回空结果
SELECT * FROM documents WHERE title = '测试文档 1';
```

---

## 🎯 Phase 3 完成标准

- [ ] ✅ Storage Bucket `documents` 已创建
- [ ] ✅ 可以成功上传文档（文件 + DB 记录）
- [ ] ✅ Dashboard 显示真实数据（非 Mock）
- [ ] ✅ 可以成功删除文档（文件 + DB 记录）
- [ ] ✅ 所有错误处理正常工作
- [ ] ✅ 空状态 UI 正常显示
- [ ] ✅ 加载状态正常显示

---

## 🐛 常见问题快速修复

### "未授权访问" (401)
→ 重新登录

### "Bucket 'documents' not found"
→ 执行上面的 Storage Bucket 创建步骤

### "权限不足：仅管理员可删除文档"
→ 确认当前用户是 admin 角色：
```sql
SELECT role FROM profiles WHERE id = '{your-user-id}';
-- 如果不是 admin，更新：
UPDATE profiles SET role = 'admin' WHERE id = '{your-user-id}';
```

### Dashboard 显示空但数据库有数据
→ 打开 DevTools Console 查看错误
→ 检查 Network 标签查看 API 响应

---

## 📚 相关文档

- **设置指南**: `SETUP_STORAGE_BUCKET.md`
- **实施指南**: `PHASE3_IMPLEMENTATION_GUIDE.md`
- **架构报告**: `AS_BUILT_TECHNICAL_REPORT.md`

---

## 🚀 下一步

完成测试后，准备 **Phase 4: AI 处理管道**
- PDF 解析
- 文本切分
- 向量化
- RAG 聊天

---

**祝测试顺利！** 🎉

