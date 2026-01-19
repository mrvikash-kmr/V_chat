import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  AuthError
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  getDocs
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
const auth = getAuth(app);
const db = getFirestore(app);

// Enable persistence to keep user logged in across refreshes
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Failed to enable auth persistence:", error);
});

// Optional Analytics
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn("Analytics failed to load", e);
  }
}

// --- SERVICE CLASS ---
class FirebaseBackendService {
  private currentUser: User | null = null;
  
  // Helpers
  private mapDocToUser(docSnap: any): User {
    const data = docSnap.data() || {};
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
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      name: data.name,
      isGroup: data.isGroup ?? false,
      participants: data.participants || [],
      lastMessage: data.lastMessage || '',
      lastMessageTime: data.lastMessageTime?.toDate?.().toISOString() || new Date().toISOString(),
      unreadCount: 0, 
      avatar: data.avatar || '',
      messages: []
    };
  }

  private mapDocToMessage(docSnap: any): Message {
    const data = docSnap.data() || {};
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

  isConfigured(): boolean {
      return firebaseConfig.apiKey !== "AIzaSyD-REPLACE_WITH_YOUR_KEY";
  }

  async waitForAuth(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        unsubscribe();
        if (firebaseUser) {
          try {
            // Attempt to fetch profile
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              this.currentUser = this.mapDocToUser(userDoc);
              // Non-blocking update
              updateDoc(doc(db, 'users', firebaseUser.uid), { isOnline: true }).catch(() => {});
              resolve(this.currentUser);
            } else {
              // Valid auth, but no profile.
              // We return null so the app routes to AuthScreen, which will then use 'login' to heal the profile.
              console.warn("Auth valid but profile missing.");
              resolve(null);
            }
          } catch (e: any) {
            console.error("Failed to fetch user profile:", e);
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
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        
        let userDoc;
        try {
            userDoc = await getDoc(doc(db, 'users', uid));
        } catch (docError: any) {
            // If we can't read the doc, it might be a network issue or permission issue
            this.handleFirestoreError(docError);
            throw docError;
        }

        if (userDoc.exists()) {
            this.currentUser = this.mapDocToUser(userDoc);
            updateDoc(doc(db, 'users', this.currentUser.id), { isOnline: true }).catch(() => {});
            return this.currentUser;
        } else {
            // "Heal" zombie account: Auth exists but Firestore data missing
            console.warn("User profile missing in Firestore. Creating new profile...");
            const newUser = {
                name: email.split('@')[0],
                email: email,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
                isOnline: true,
                status: 'Available',
                createdAt: serverTimestamp()
            };
            
            try {
                await setDoc(doc(db, 'users', uid), newUser);
                this.currentUser = { id: uid, ...newUser };
                return this.currentUser!;
            } catch (setError: any) {
                this.handleFirestoreError(setError);
                throw new Error("Login succeeded but failed to create user profile. Check database rules.");
            }
        }
    } catch (e: any) {
        this.handleAuthError(e);
        throw e;
    }
  }

  async signup(name: string, email: string, password: string): Promise<User> {
    let uid: string;

    // 1. Create Auth User
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        uid = userCredential.user.uid;
    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            try {
                return await this.login(email, password);
            } catch (loginErr: any) {
                if (loginErr.message.includes('password')) {
                    throw new Error('Email exists. Please log in with correct password.');
                }
                throw loginErr;
            }
        }
        this.handleAuthError(error);
        throw error;
    }
    
    // 2. Create Firestore Profile
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
        this.handleFirestoreError(e);
        throw new Error('Account created but profile failed. Please try logging in.');
    }

    this.currentUser = { id: uid, ...newUser };
    return this.currentUser!;
  }

  private handleAuthError(e: AuthError) {
      console.error("Auth Error:", e.code, e.message);
      if (e.code === 'auth/operation-not-allowed') {
          throw new Error('Email/Password login is not enabled. Go to Firebase Console > Authentication > Sign-in method and enable Email/Password.');
      }
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
          throw new Error('Invalid email or password.');
      }
  }

  private handleFirestoreError(e: any) {
      console.error("Firestore Error:", e);
      if (e.code === 'permission-denied') {
          throw new Error('Database Permission Denied. Please configure Firestore Security Rules in Firebase Console.');
      }
      if (e.message?.includes('not-found') || e.code === 'not-found') {
           throw new Error('Database not found. Please create Cloud Firestore in Firebase Console.');
      }
      if (e.code === 'unavailable' || e.message?.includes('offline')) {
         throw new Error('Connection failed. Please check your internet connection or try again later.');
      }
  }

  async logout() {
    if (this.currentUser) {
        try {
            await updateDoc(doc(db, 'users', this.currentUser.id), { isOnline: false });
        } catch (e) {
            // Ignore offline errors during logout
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
        // We listen to the user doc.
        const unsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
            if (docSnap.exists()) {
                this.currentUser = this.mapDocToUser(docSnap);
                callback(this.currentUser);
            } else {
                // If doc doesn't exist, we might be in the middle of creation, or it was deleted.
                // We don't nullify currentUser here to avoid flickering, but we don't update it either.
                console.log("Auth user exists but profile doc missing (yet).");
            }
        }, (error) => {
            console.error("Auth Snapshot Error:", error);
            // If we can't listen to the profile, we probably can't use the app.
            // But we don't want to force logout if it's just a temporary flake.
        });
      } else {
        this.currentUser = null;
        callback(null);
      }
    });
  }

  subscribeToUsers(callback: (users: User[]) => void) {
    // Only fetch top 50 users to save bandwidth
    const q = query(collection(db, 'users'), limit(50));
    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => this.mapDocToUser(doc));
      callback(users);
    }, (error) => {
        console.warn("Subscribe Users Error (likely permission):", error.code);
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
        console.warn("Subscribe Chats Error:", error.code);
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
        console.warn("Subscribe Single Chat Error:", error.code);
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
        console.warn("Subscribe Messages Error:", error.code);
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
    } as any;
  }

  async findDirectChat(currentUserId: string, targetUserId: string): Promise<Chat | undefined> {
    const q = query(
        collection(db, 'chats'), 
        where('participants', 'array-contains', currentUserId)
    );
    
    const snapshot = await getDocs(q);
    
    // Client-side filtering because Firestore can't do "array-contains-exactly" easily without specific IDs
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

    try {
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
    } catch (e: any) {
        console.error("Send Message Error:", e);
        throw e;
    }
  }
}

export const backend = new FirebaseBackendService();