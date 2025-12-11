# 🔧 PDF-Parse Import 修复说明

**问题**: `Export default doesn't exist in target module`

**原因**: `pdf-parse` 是 CommonJS 模块，在 Next.js ESM 环境中需要特殊处理

---

## ✅ 修复内容

### 修改前（错误）:
```typescript
import pdf from 'pdf-parse'

// 使用
const pdfData = await pdf(buffer)
```

### 修改后（正确）:
```typescript
// 动态导入 pdf-parse
const getPdfParser = async () => {
  const pdfParse = await import('pdf-parse')
  return pdfParse.default || pdfParse
}

// 使用
const pdf = await getPdfParser()
const pdfData = await pdf(buffer)
```

---

## 🎯 关键点

1. **动态导入**: 使用 `import()` 而不是静态 `import`
2. **兼容性**: 处理 `default` 导出和命名导出
3. **Node.js Runtime**: 已设置 `export const runtime = 'nodejs'`

---

## ✅ 验证

修复后，重启服务器：

```bash
npm run dev
```

然后测试文档处理功能，应该不再出现导入错误。

---

**修复完成！** ✅

