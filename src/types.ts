export interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
  suggestions?: string[];
  isAudioPlayable?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}
