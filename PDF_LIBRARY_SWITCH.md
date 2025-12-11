# 🔄 PDF 解析库切换：pdf-parse → pdfjs-dist

**原因**: `pdf-parse` 在 Next.js + Turbopack 环境下需要 Canvas 依赖，导致 `DOMMatrix is not defined` 错误

**解决方案**: 切换到官方的 `pdfjs-dist` 库

---

## ✅ 已完成的修改

### 1. 安装新依赖

```bash
npm install pdfjs-dist@4.0.379
```

### 2. 更新代码

**之前（pdf-parse）**:
```typescript
const pdfParse = require('pdf-parse')
const pdfData = await pdfParse(buffer)
extractedText = pdfData.text
```

**现在（pdfjs-dist）**:
```typescript
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
const pdfDocument = await pdfjsLib.getDocument({ data: uint8Array }).promise

// 逐页提取文本
for (let pageNum = 1; pageNum <= numPages; pageNum++) {
  const page = await pdfDocument.getPage(pageNum)
  const textContent = await page.getTextContent()
  const pageText = textContent.items.map(item => item.str).join(' ')
  textParts.push(pageText)
}

extractedText = textParts.join('\n\n')
```

---

## 🎯 优势

### pdfjs-dist 优势:
- ✅ **官方库**: Mozilla PDF.js 的官方 Node.js 版本
- ✅ **无 Canvas 依赖**: 纯 JavaScript 实现
- ✅ **更稳定**: 在 Next.js 环境下兼容性好
- ✅ **活跃维护**: 持续更新和支持
- ✅ **更准确**: 更好的文本提取质量

### pdf-parse 问题:
- ❌ 需要 Canvas 依赖（`@napi-rs/canvas`）
- ❌ 在 Windows 上安装 Canvas 可能需要编译
- ❌ 在 Turbopack 下有兼容性问题
- ❌ `DOMMatrix` 等浏览器 API 在 Node.js 中不可用

---

## 🧪 测试步骤

### 1. 重启服务器

```bash
# 停止服务器（Ctrl+C）
npm run dev
```

### 2. 刷新Dashboard并测试

1. 访问 `/admin/dashboard`
2. 点击"处理"按钮
3. ✅ 应该看到：

```
📝 开始处理文档: xxx
📄 文档信息: { ... }
✅ 文档状态已更新为 processing
✅ 文件下载成功: 220515 bytes
📖 PDF 加载成功: X 页
✅ PDF 解析成功: { pages: X, textLength: XXXX }
📦 文本分块完成: X 个块
🤖 开始生成向量嵌入...
✅ 向量生成完成
💾 开始存储到数据库...
✅ 文档处理完成
```

### 3. 验证数据

```sql
-- 检查文档状态
SELECT id, title, status FROM documents WHERE status = 'ready';

-- 检查文本块
SELECT COUNT(*) FROM document_chunks WHERE document_id = 'your-doc-id';
```

---

## 📊 性能对比

| 方面 | pdf-parse | pdfjs-dist |
|------|-----------|------------|
| **依赖** | 需要 Canvas | 无额外依赖 |
| **兼容性** | 有问题 | ✅ 良好 |
| **解析速度** | 快 | 稍慢但可接受 |
| **文本质量** | 好 | ✅ 更好 |
| **维护状态** | 较少更新 | ✅ 活跃 |

---

## 🔍 故障排查

### 问题 1: "Cannot find module 'pdfjs-dist'"

**解决方案**:
```bash
npm install pdfjs-dist@4.0.379
```

### 问题 2: 仍然出现 Canvas 相关错误

**解决方案**:
1. 停止服务器
2. 删除 `.next` 缓存
3. 重启

```bash
rm -rf .next  # Windows: Remove-Item -Recurse -Force .next
npm run dev
```

### 问题 3: 文本提取为空

**可能原因**:
- PDF 是扫描版（纯图片）
- PDF 加密

**解决方案**:
- 使用包含文本的 PDF
- 未来实现 OCR 功能

---

## 📦 Dependencies 更新

**package.json 变更**:

```json
{
  "dependencies": {
    "openai": "^6.10.0",
    "pdfjs-dist": "^4.0.379",  // 新增
    // "pdf-parse": "^1.1.1"   // 已移除（可选）
  }
}
```

**可选**: 卸载 pdf-parse
```bash
npm uninstall pdf-parse
```

---

## ✅ 修复完成

**修复状态**: ✅ 代码已更新，依赖已安装

**下一步**: 重启服务器并测试文档处理功能

---

**库切换完成！** 🎉

