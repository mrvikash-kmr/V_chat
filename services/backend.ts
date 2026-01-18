import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  Timestamp,
  or,
  and,
  getDocs,
  limit
} from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { User, Chat, Message } from '../types';

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCbrMk6oGNwN0ojqSppuGPiQw_Lmfvd_dg",
  authDomain: "vchat-aecf3.firebaseapp.com",
  databaseURL: "https://vchat-aecf3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "vchat-aecf3",
  storageBucket: "vchat-aecf3.firebasestorage.app",
  messagingSenderId: "1013560842527",
  appId: "1:1013560842527:web:e3b97c643dfc1918e2382a",
  measurementId: "G-RH2D7X0XBS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// --- SERVICE CLASS ---
class FirebaseBackendService {
  private currentUser: User | null = null;
  
  // Helpers
  private mapDocToUser(docSnap: any): User {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name || 'Unknown',
      email: data.email || '',
      avatar: data.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${docSnap.id}`,
      isOnline: data.isOnline ?? false,
      status: data.status || ''
    };
  }

  private mapDocToChat(docSnap: any): Chat {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name,
      isGroup: data.isGroup ?? false,
      participants: data.participants || [],
      lastMessage: data.lastMessage || '',
      lastMessageTime: data.lastMessageTime?.toDate?.().toISOString() || new Date().toISOString(),
      unreadCount: 0, // In a real app, calculate this based on a separate 'readReceipts' subcollection
      avatar: data.avatar || '',
      messages: []
    };
  }

  private mapDocToMessage(docSnap: any): Message {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      text: data.text || '',
      senderId: data.senderId,
      timestamp: data.timestamp?.toDate?.().toISOString() || new Date().toISOString(),
      type: data.type || 'text',
      isPending: docSnap.metadata.hasPendingWrites
    };
  }

  // --- AUTH ---

  // Check if current config is dummy
  isConfigured(): boolean {
      return firebaseConfig.apiKey !== "AIzaSyD-REPLACE_WITH_YOUR_KEY";
  }

  async waitForAuth(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        unsubscribe();
        if (firebaseUser) {
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              this.currentUser = this.mapDocToUser(userDoc);
              // Try to set online, but don't block/fail if offline
              updateDoc(doc(db, 'users', firebaseUser.uid), { isOnline: true }).catch(e => console.warn("Online status update failed", e));
              resolve(this.currentUser);
            } else {
              // Auth exists but Firestore doc missing (zombie state)
              resolve(null);
            }
          } catch (e) {
            console.error("Failed to fetch user profile:", e);
            // Return null so the app goes to Login screen where errors are more visible
            resolve(null);
          }
        } else {
          this.currentUser = null;
          resolve(null);
        }
      });
    });
  }

  getCurrentUserSync(): User | null {
    return this.currentUser;
  }

  async login(email: string, password: string): Promise<User> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    try {
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
            this.currentUser = this.mapDocToUser(userDoc);
            updateDoc(doc(db, 'users', this.currentUser.id), { isOnline: true }).catch(() => {});
            return this.currentUser;
        } else {
            // Profile missing
            throw new Error('User profile not found in database.');
        }
    } catch (e: any) {
        if (e.message.includes('offline') || e.code === 'unavailable') {
           throw new Error('Network error: Unable to connect to database.');
        }
        throw e;
    }
  }

  async signup(name: string, email: string, password: string): Promise<User> {
    let uid: string;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        uid = userCredential.user.uid;
    } catch (error: any) {
        // Robustness: Handle "Email already in use". 
        // If the user tries to signup again because the previous attempt failed at the DB step,
        // we should try to recover by creating the doc if it's missing.
        if (error.code === 'auth/email-already-in-use') {
            try {
                // Try to login to verify ownership (auto-recovery)
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                uid = userCredential.user.uid;
                
                // Check if doc exists
                const existingDoc = await getDoc(doc(db, 'users', uid));
                if (existingDoc.exists()) {
                    throw new Error('Account already exists. Please log in.');
                }
                // If doc is missing, fall through to creation logic below
            } catch (loginErr: any) {
                if (loginErr.message === 'Account already exists. Please log in.') throw loginErr;
                throw new Error('Email already in use. Please log in.');
            }
        } else {
            throw error;
        }
    }
    
    // Create or Re-create User Profile
    const newUser: any = {
      name,
      email,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      isOnline: true,
      status: 'Hey there! I am using vChat.',
      createdAt: serverTimestamp()
    };

    try {
        await setDoc(doc(db, 'users', uid), newUser);
    } catch (e: any) {
        console.error("Database Error:", e);
        if (e.message?.includes('not-found') || e.code === 'not-found') {
            throw new Error('Database not configured. Please create Cloud Firestore in Firebase Console.');
        }
        throw new Error('Failed to create profile. Please check your connection.');
    }

    this.currentUser = { id: uid, ...newUser };
    return this.currentUser!;
  }

  async logout() {
    if (this.currentUser) {
        try {
            await updateDoc(doc(db, 'users', this.currentUser.id), { isOnline: false });
        } catch (e) {
            console.warn("Offline status update failed", e);
        }
    }
    await signOut(auth);
    this.currentUser = null;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const userRef = doc(db, 'users', userId);
    const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await updateDoc(userRef, cleanUpdates);
    
    if (this.currentUser && this.currentUser.id === userId) {
        this.currentUser = { ...this.currentUser, ...updates };
    }
    return this.currentUser!;
  }

  // --- REALTIME DATA ---

  onAuthChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Real-time listener for the user's own profile
        const unsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
            if (docSnap.exists()) {
                this.currentUser = this.mapDocToUser(docSnap);
                callback(this.currentUser);
            }
        }, (error) => {
            console.error("Profile Sync Error", error);
            // Don't log out, just warn
        });
      } else {
        this.currentUser = null;
        callback(null);
      }
    });
  }

  subscribeToUsers(callback: (users: User[]) => void) {
    const q = query(collection(db, 'users'), limit(50));
    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => this.mapDocToUser(doc));
      callback(users);
    }, (error) => {
        console.warn("User sync error", error);
        callback([]);
    });
  }

  subscribeToChats(userId: string, callback: (chats: Chat[]) => void) {
    const q = query(
        collection(db, 'chats'), 
        where('participants', 'array-contains', userId),
        orderBy('lastMessageTime', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => this.mapDocToChat(doc));
      callback(chats);
    }, (error) => {
        console.warn("Chat sync error", error);
        callback([]);
    });
  }

  subscribeToChat(chatId: string, callback: (chat: Chat | null) => void) {
    return onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
      if (docSnap.exists()) {
        callback(this.mapDocToChat(docSnap));
      } else {
        callback(null);
      }
    }, (error) => {
        console.warn("Single chat sync error", error);
    });
  }

  subscribeToMessages(chatId: string, callback: (messages: Message[]) => void) {
    const q = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('timestamp', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => this.mapDocToMessage(doc));
      callback(messages);
    }, (error) => {
        console.warn("Message sync error", error);
        callback([]);
    });
  }

  // --- ACTIONS ---

  async createChat(name: string, participantIds: string[], isGroup: boolean): Promise<Chat> {
    const chatData = {
        name: isGroup ? name : '',
        isGroup,
        participants: participantIds,
        lastMessage: 'Chat created',
        lastMessageTime: serverTimestamp(),
        avatar: isGroup ? `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random` : '',
        createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'chats'), chatData);
    
    await addDoc(collection(db, 'chats', docRef.id, 'messages'), {
        text: isGroup ? `Group "${name}" created` : 'Chat started',
        senderId: 'system',
        timestamp: serverTimestamp(),
        type: 'system'
    });

    return {
        id: docRef.id,
        ...chatData,
        lastMessageTime: new Date().toISOString(),
        messages: [],
        unreadCount: 0
    };
  }

  async findDirectChat(currentUserId: string, targetUserId: string): Promise<Chat | undefined> {
    const q = query(
        collection(db, 'chats'), 
        where('participants', 'array-contains', currentUserId)
    );
    
    const snapshot = await getDocs(q);
    
    const chatDoc = snapshot.docs.find(doc => {
        const data = doc.data();
        return !data.isGroup && 
               data.participants.includes(targetUserId) && 
               data.participants.length === 2;
    });

    return chatDoc ? this.mapDocToChat(chatDoc) : undefined;
  }

  async sendMessage(chatId: string, text: string, senderId: string): Promise<void> {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const chatRef = doc(db, 'chats', chatId);

    await addDoc(messagesRef, {
        text,
        senderId,
        timestamp: serverTimestamp(),
        type: 'text'
    });

    await updateDoc(chatRef, {
        lastMessage: text,
        lastMessageTime: serverTimestamp()
    });
  }
}

export const backend = new FirebaseBackendService();
