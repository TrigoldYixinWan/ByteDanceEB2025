// Frontend-friendly types (camelCase) derived from database types (snake_case)

export interface Profile {
  id: string // UUID
  role: 'merchant' | 'admin'
  fullName: string | null
  createdAt: string
  updatedAt: string
}

export interface Document {
  id: string // UUID - CHANGED FROM number
  title: string
  category: string
  subcategory?: string | null
  contentType?: string | null
  sourceUrl?: string | null
  filePath?: string | null
  status: 'pending' | 'processing' | 'ready' | 'failed'
  citationCount?: number // Computed from document_chunks
  createdAt: string
  updatedAt: string
}

export interface DocumentChunk {
  id: string // UUID
  documentId: string // UUID
  content: string
  embedding?: number[] | null
  citationCount: number
  createdAt: string
  updatedAt: string
}

export interface ChatSession {
  id: string // UUID
  userId: string // UUID
  title: string | null
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string // UUID
  sessionId: string // UUID
  role: 'user' | 'assistant'
  content: string
  attachments?: any | null
  sources?: MessageSource[] // Populated from message_citations
  createdAt: string
}

export interface MessageSource {
  id: string // chunk_id
  title: string // from document
  category: string // from document
  excerpt?: string // chunk content preview
}

export interface MessageCitation {
  id: string // UUID
  messageId: string // UUID
  chunkId: string // UUID
  createdAt: string
}

// Helper type for document list with citation counts
export interface DocumentWithStats extends Document {
  citationCount: number
  lastUpdated: string
}

// Analytics data structure
export interface AnalyticsStats {
  totalDocuments: number
  totalCitations: number
  activeUsers: number
  growthRate: number
}

