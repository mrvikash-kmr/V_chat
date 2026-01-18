import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  limit,
  serverTimestamp
} from 'firebase/firestore';
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

// --- INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use modern persistence initialization to avoid warnings
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager() 
  })
});

// --- SERVICE CLASS ---
class BackendService {
  private currentUser: User | null = null;
  private authInitialized = false;

  constructor() {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              this.currentUser = { id: user.uid, ...userDoc.data() } as User;
            } else {
               this.currentUser = {
                 id: user.uid,
                 name: user.displayName || 'User',
                 email: user.email || '',
                 avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                 isOnline: true
               };
            }
        } catch(e) {
            console.warn("Offline or error fetching user profile", e);
             this.currentUser = {
                 id: user.uid,
                 name: user.displayName || 'User',
                 email: user.email || '',
                 avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                 isOnline: true
               };
        }
      } else {
        this.currentUser = null;
      }
      this.authInitialized = true;
    });
  }

  // --- AUTH ---

  async waitForAuth(): Promise<User | null> {
    if (this.authInitialized) return this.currentUser;
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();
        if (user) {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                this.currentUser = userDoc.exists() ? { id: user.uid, ...userDoc.data() } as User : null;
            } catch (e) {
                // If offline and first load, user might not be in cache yet if not persisted
                this.currentUser = { id: user.uid, name: user.displayName || 'User', email: user.email || '', avatar: user.photoURL || '', isOnline: true };
            }
        }
        resolve(this.currentUser);
      });
    });
  }

  getCurrentUserSync(): User | null {
    return this.currentUser;
  }

  async login(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Don't await profile update if we want fast UI response, but good to have
    try {
        const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
        const userData = userDoc.data() as User;
        await updateDoc(doc(db, 'users', cred.user.uid), { isOnline: true });
        this.currentUser = { id: cred.user.uid, ...userData };
    } catch (e) {
        console.warn("Login data fetch error (maybe offline)", e);
        // Fallback
        this.currentUser = { id: cred.user.uid, email, name: cred.user.displayName || 'User', avatar: cred.user.photoURL || '', isOnline: true };
    }
    return this.currentUser!;
  }

  async signup(name: string, email: string, password: string): Promise<User> {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
    
    const newUser: User = {
      id: cred.user.uid,
      name,
      email,
      avatar,
      status: 'Available',
      isOnline: true
    };

    await setDoc(doc(db, 'users', cred.user.uid), newUser);
    await updateProfile(cred.user, { displayName: name, photoURL: avatar });

    this.currentUser = newUser;
    return newUser;
  }

  async logout() {
    if (auth.currentUser) {
        try {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), { isOnline: false });
        } catch(e) {} 
    }
    await signOut(auth);
    this.currentUser = null;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    await updateDoc(doc(db, 'users', userId), updates);
    if (this.currentUser && this.currentUser.id === userId) {
        this.currentUser = { ...this.currentUser, ...updates };
    }
    return this.currentUser!;
  }

  // --- REALTIME DATA (SUBSCRIPTIONS) ---

  onAuthChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Try to get extended profile
        try {
             const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
             const user = { id: firebaseUser.uid, ...snap.data() } as User;
             this.currentUser = user;
             callback(user);
        } catch(e) {
             callback({id: firebaseUser.uid, email: firebaseUser.email || '', name: firebaseUser.displayName || 'User', avatar: firebaseUser.photoURL || '', isOnline: true});
        }
      } else {
        this.currentUser = null;
        callback(null);
      }
    });
  }

  subscribeToUsers(callback: (users: User[]) => void) {
    const q = query(collection(db, 'users'));
    // Listen to metadata changes to support optimistic updates if we were to edit users list
    return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
      callback(users);
    });
  }

  subscribeToChats(userId: string, callback: (chats: Chat[]) => void) {
    const q = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', userId)
    );

    return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const chats = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          lastMessageTime: data.lastMessageTime?.toDate ? data.lastMessageTime.toDate().toISOString() : new Date().toISOString()
        } as Chat;
      });
      chats.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
      callback(chats);
    });
  }

  // New: Subscribe to a single chat for ChatScreen
  subscribeToChat(chatId: string, callback: (chat: Chat | null) => void) {
      return onSnapshot(doc(db, 'chats', chatId), { includeMetadataChanges: true }, (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              callback({
                  id: docSnap.id,
                  ...data,
                  lastMessageTime: data.lastMessageTime?.toDate ? data.lastMessageTime.toDate().toISOString() : new Date().toISOString()
              } as Chat);
          } else {
              callback(null);
          }
      });
  }

  subscribeToMessages(chatId: string, callback: (messages: Message[]) => void) {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    // CRITICAL: includeMetadataChanges: true allows us to see local pending writes
    return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const messages = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          // If pending, timestamp might be null (serverTimestamp), so use current time
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : new Date().toISOString(),
          isPending: d.metadata.hasPendingWrites
        } as Message;
      });
      callback(messages);
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
      unreadCount: 0,
      avatar: isGroup ? `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random` : ''
    };

    const docRef = await addDoc(collection(db, 'chats'), chatData);
    // Return optimistic object
    return { id: docRef.id, ...chatData, lastMessageTime: new Date().toISOString() } as Chat;
  }

  async findDirectChat(currentUserId: string, targetUserId: string): Promise<Chat | undefined> {
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', currentUserId));
    const snap = await getDocs(q);
    
    const chatDoc = snap.docs.find(d => {
        const data = d.data();
        return !data.isGroup && data.participants.includes(targetUserId) && data.participants.length === 2;
    });

    if (chatDoc) {
        return { id: chatDoc.id, ...chatDoc.data() } as Chat;
    }
    return undefined;
  }

  async sendMessage(chatId: string, text: string, senderId: string): Promise<void> {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    
    // 1. Add Message - Firestore SDK handles offline queuing automatically
    // We don't need to await this for UI update if we trust onSnapshot with metadata
    // But awaiting ensures we catch errors if online.
    const msgPromise = addDoc(messagesRef, {
      text,
      senderId,
      timestamp: serverTimestamp(),
      type: 'text'
    });

    // 2. Update Chat Metadata
    const chatRef = doc(db, 'chats', chatId);
    const chatPromise = updateDoc(chatRef, {
      lastMessage: text,
      lastMessageTime: serverTimestamp()
    });

    await Promise.all([msgPromise, chatPromise]);
  }

  getUsersSync(): User[] { return []; } 
}

export const backend = new BackendService();