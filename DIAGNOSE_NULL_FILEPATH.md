# 🔍 诊断：Null file_path 问题

**错误**: `Cannot read properties of null (reading 'replace')`

**原因**: 数据库中某些文档的 `file_path` 字段是 `null`

---

## ✅ 已修复

API 代码已更新，现在会检查 `file_path` 是否为 `null`，并跳过 URL 生成。

---

## 🔍 诊断步骤

### 步骤 1: 检查哪些文档有 null file_path

**在 Supabase SQL Editor 中执行**:

```sql
-- 查找 file_path 为 null 的文档
SELECT 
  id,
  title,
  status,
  file_path,
  created_at
FROM documents
WHERE file_path IS NULL
ORDER BY created_at DESC;
```

---

### 步骤 2: 修复或删除这些文档

**选项 A: 删除无效文档**（推荐）

```sql
-- 删除 file_path 为 null 的文档
DELETE FROM documents
WHERE file_path IS NULL;
```

---

**选项 B: 查看所有文档状态**

```sql
-- 查看所有文档及其状态
SELECT 
  id,
  title,
  status,
  file_path IS NULL as has_null_path,
  created_at
FROM documents
ORDER BY created_at DESC;
```

---

## 🚀 测试修复

### 1. 服务器会自动重启

修改后，Next.js 会自动重新编译。

### 2. 刷新 Dashboard

在浏览器中按 **F5** 刷新页面。

### 3. 验证

**终端应该显示**:
```
GET /api/documents 200 in XXXms
```

**不应该再有**:
```
❌ URL generation failed for null: TypeError...
```

---

## 💡 为什么会出现这个问题？

**可能原因**:
1. 测试时手动在数据库中创建了记录，但没有设置 `file_path`
2. 某次上传失败，但数据库记录已创建
3. 数据库迁移或清理时遗留的记录

**解决方案**: 
- 删除这些无效记录
- 确保上传 API 总是设置 `file_path`

---

## ✅ 验证清单

- [ ] 执行 SQL 查询检查 null file_path
- [ ] 删除或修复无效记录
- [ ] 刷新 Dashboard 页面
- [ ] 验证不再有错误日志
- [ ] 测试文档处理功能

---

**修复完成！** ✅

