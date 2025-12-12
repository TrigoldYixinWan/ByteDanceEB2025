# 🧪 Merchant Portal 查看功能测试指南

**目的**: 验证 Merchant 用户可以查看已上传的文档（即使未处理）

---

## 📋 测试前提

### 1. 验证文档已在数据库中

**在 Supabase SQL Editor 执行**:

```sql
-- 查看所有文档
SELECT 
  id,
  title,
  category,
  status,
  created_at
FROM documents
ORDER BY created_at DESC;
```

**预期结果**:
- 至少有 1 个文档
- 文档有 `title`, `category`, `status` 等字段
- `status` 可以是 `pending`, `processing`, `ready`, 或 `failed`

---

### 2. 验证文档状态统计

```sql
SELECT 
  status,
  COUNT(*) as count
FROM documents
GROUP BY status;
```

**示例输出**:
```
status     | count
-----------|------
pending    | 1
processing | 0
ready      | 0
failed     | 0
```

---

## 🧪 测试步骤

### Test 1: Merchant 登录

1. 访问 `/login`
2. 使用 Merchant 账户登录
   - 或创建一个新的 Merchant 账户（注册时默认为 Merchant）
3. ✅ 应该跳转到 `/portal`

---

### Test 2: 查看 Portal 首页

**当前实现**:
- ✅ 显示类别卡片（8 个类别）
- ✅ 显示"最近更新"部分
- ⚠️ **目前只显示 `status='ready'` 的文档**

**预期行为**:

#### 如果有 `ready` 状态的文档
- ✅ "最近更新"部分显示文档列表
- ✅ 每个文档显示：标题、类别、创建日期
- ✅ 点击文档可跳转到详情页

#### 如果没有 `ready` 状态的文档（当前情况）
- ✅ 显示空状态提示：
  ```
  暂无可用文档
  管理员正在上传和处理文档，请稍后再来查看
  ```

---

### Test 3: 验证 API 调用

**打开浏览器 DevTools（F12）**:

1. 切换到 **Network** 标签
2. 刷新 Portal 页面
3. 找到 `GET /api/documents` 请求
4. 查看 **Response**

**预期 Response**:
```json
{
  "documents": [
    {
      "id": "uuid-here",
      "title": "商品信息规范",
      "category": "商品管理",
      "status": "pending",  // ⚠️ 如果是 pending，不会显示在 Portal
      ...
    }
  ],
  "total": 1
}
```

**验证**:
- ✅ API 返回真实数据（不是 Mock）
- ✅ 文档列表不为空
- ⚠️ 如果所有文档都是 `pending`，Portal 会显示"暂无可用文档"

---

## 🔍 当前行为说明

### Portal 文档过滤逻辑

**代码逻辑**:
```typescript
// 只显示 'ready' 状态的文档
const readyDocuments = data.documents
  .filter((doc: any) => doc.status === 'ready')
```

**原因**: 
- ✅ 只有处理完成的文档才有文本和向量
- ✅ Merchant 用户可以进行语义搜索和 AI 问答
- ⚠️ `pending` 或 `processing` 的文档还不能使用

---

## 💡 可选：显示所有文档（包括 pending）

如果您希望 Merchant 也能看到 `pending` 状态的文档：

**修改 `app/portal/page.tsx`**:

```typescript
// 显示所有文档（不过滤状态）
const allDocuments = data.documents.map((doc: any) => ({
  id: doc.id,
  title: doc.title,
  category: doc.category,
  subcategory: doc.subcategory,
  status: doc.status,
  createdAt: doc.createdAt,
}))

setDocuments(allDocuments)
```

**然后在 UI 中显示状态标签**:
```typescript
{doc.status === 'pending' && (
  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
    待处理
  </span>
)}
{doc.status === 'ready' && (
  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
    可用
  </span>
)}
```

---

## 🎯 测试验证清单

### Portal 页面
- [ ] Merchant 登录成功
- [ ] Portal 首页加载正常
- [ ] 类别卡片显示（8 个）
- [ ] "最近更新"部分显示

### API 集成
- [ ] `GET /api/documents` 被调用
- [ ] 返回真实数据（不是 Mock）
- [ ] 文档数量正确

### 文档显示
- [ ] 如果有 `ready` 文档：显示文档列表
- [ ] 如果无 `ready` 文档：显示空状态提示
- [ ] 文档标题、类别、日期显示正确

---

## 📊 当前数据状态

根据您的数据库：
- ✅ 有文档记录（`title`, `category`, `file_path` 都有）
- ⚠️ 状态都是 `pending`（还未处理）
- ⚠️ Portal 会显示"暂无可用文档"

**解释**: 
- Portal 只显示 `ready` 状态的文档
- 当前所有文档都是 `pending`
- 所以显示空状态是**正常行为**

---

## ✅ 完成处理后的效果

**当您成功处理一个文档后**:

1. 文档状态变为 `ready`
2. Portal 自动显示该文档
3. Merchant 可以点击查看详情
4. Merchant 可以使用 AI 问答功能

---

## 🚀 下一步

### Option A: 先测试当前实现（推荐）

1. ✅ 验证数据库有文档（执行 SQL 查询）
2. ✅ 以 Merchant 登录访问 `/portal`
3. ✅ 验证 API 调用和数据返回
4. ✅ 确认显示"暂无可用文档"（因为都是 pending）

### Option B: 修改为显示所有文档

如果您想看到 `pending` 状态的文档，我可以修改过滤逻辑。

---

**测试指南完成！** 📝

**请执行数据库验证 SQL，然后以 Merchant 身份测试 Portal 页面！**

