
export interface User {
  id: string;
  name: string;
  email: string; // Added email for auth
  password?: string; // Added for mock auth
  avatar: string;
  status?: string;
  phone?: string;
  isOnline?: boolean;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: string; // ISO string
  isRead?: boolean;
  type?: 'text' | 'image' | 'system';
  isPending?: boolean; // Added for offline support
  chatId?: string; // Optional helper for queue processing
}

export interface Chat {
  id: string;
  name?: string; // Room name
  isGroup: boolean;
  participants: string[]; // User IDs
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
  avatar?: string;
}

export type ScreenName = 
  | 'SPLASH' 
  | 'LOGIN' 
  | 'VERIFICATION' 
  | 'PROFILE_SETUP' 
  | 'HOME' 
  | 'CHAT' 
  | 'CREATE_CHAT'
  | 'CALL_INCOMING' 
  | 'CALL_ACTIVE';

export type TabName = 'CHATS' | 'CONTACTS' | 'SETTINGS' | 'PROFILE';
