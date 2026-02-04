
export type Role = 'user' | 'model';

export interface Message {
  id: string;
  role: Role;
  content: string;
  imageUrl?: string;
  videoUrl?: string; // Para almacenar la URL del video generado
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  lastModified: number;
}

export interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoading: boolean;
  error: string | null;
}
