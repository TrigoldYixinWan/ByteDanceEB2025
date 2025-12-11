export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string // UUID
          role: 'merchant' | 'admin'
          full_name: string | null
          created_at: string // Timestamptz
          updated_at: string // Timestamptz
        }
        Insert: {
          id: string
          role?: 'merchant' | 'admin'
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: 'merchant' | 'admin'
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string // UUID
          title: string
          category: string
          subcategory: string | null
          content_type: string | null
          source_url: string | null
          file_path: string | null
          status: 'pending' | 'processing' | 'ready' | 'failed'
          created_at: string // Timestamptz
          updated_at: string // Timestamptz
        }
        Insert: {
          id?: string
          title: string
          category: string
          subcategory?: string | null
          content_type?: string | null
          source_url?: string | null
          file_path?: string | null
          status?: 'pending' | 'processing' | 'ready' | 'failed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          category?: string
          subcategory?: string | null
          content_type?: string | null
          source_url?: string | null
          file_path?: string | null
          status?: 'pending' | 'processing' | 'ready' | 'failed'
          created_at?: string
          updated_at?: string
        }
      }
      document_chunks: {
        Row: {
          id: string // UUID
          document_id: string // UUID (Foreign Key)
          content: string
          embedding: number[] | null // vector(1536)
          citation_count: number
          created_at: string // Timestamptz
          updated_at: string // Timestamptz
        }
        Insert: {
          id?: string
          document_id: string
          content: string
          embedding?: number[] | null
          citation_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          content?: string
          embedding?: number[] | null
          citation_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      chat_sessions: {
        Row: {
          id: string // UUID
          user_id: string // UUID (Foreign Key)
          title: string | null
          created_at: string // Timestamptz
          updated_at: string // Timestamptz
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string // UUID
          session_id: string // UUID (Foreign Key)
          role: 'user' | 'assistant'
          content: string
          attachments: Json | null
          created_at: string // Timestamptz
        }
        Insert: {
          id?: string
          session_id: string
          role: 'user' | 'assistant'
          content: string
          attachments?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          role?: 'user' | 'assistant'
          content?: string
          attachments?: Json | null
          created_at?: string
        }
      }
      message_citations: {
        Row: {
          id: string // UUID
          message_id: string // UUID (Foreign Key)
          chunk_id: string // UUID (Foreign Key)
          created_at: string // Timestamptz
        }
        Insert: {
          id?: string
          message_id: string
          chunk_id: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          chunk_id?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'merchant' | 'admin'
      document_status: 'pending' | 'processing' | 'ready' | 'failed'
      message_role: 'user' | 'assistant'
    }
  }
}

