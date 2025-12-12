-- ============================================
-- 添加零命中字段到 chat_messages 表
-- ============================================
-- 用于追踪用户问题是否在知识库中找到相关内容
-- 
-- 执行方式：在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 添加 is_zero_hit 字段（布尔类型，默认 false）
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS is_zero_hit BOOLEAN DEFAULT false;

-- 添加索引以优化查询
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_zero_hit 
ON chat_messages(is_zero_hit) 
WHERE is_zero_hit = true;

-- 验证字段是否添加成功
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'chat_messages' 
AND column_name = 'is_zero_hit';

-- ============================================
-- 预期输出：
-- column_name | data_type | column_default
-- is_zero_hit | boolean   | false
-- ============================================

