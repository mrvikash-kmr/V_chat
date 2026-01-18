import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { TabName, Chat, User, Message } from './types';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { BottomNav } from './components/BottomNav';
import { SideNav } from './components/SideNav';
import { Toast } from './components/Toast';
import { backend } from './services/backend';

// --- UTILS ---
const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    
    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return isMobile;
};

const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    return isOnline;
};

// --- CONTEXT ---
interface AppContextType {
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
    currentUser: User | null;
    isOnline: boolean;
}
const AppContext = createContext<AppContextType>({ 
    showToast: () => {}, 
    currentUser: null, 
    isOnline: true
});

// --- SHARED COMPONENTS ---

const TabContent = ({ activeTab, navigate }: { activeTab: TabName, navigate: any }) => {
    const { currentUser, showToast, isOnline } = useContext(AppContext);
    const [chats, setChats] = useState<Chat[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editName, setEditName] = useState('');
    const [editStatus, setEditStatus] = useState('');

    useEffect(() => {
        if (!currentUser) return;
        setEditName(currentUser.name);
        setEditStatus(currentUser.status || '');

        const unsubChats = backend.subscribeToChats(currentUser.id, (data) => setChats(data));
        const unsubUsers = backend.subscribeToUsers((data) => setUsers(data));
        
        return () => {
            unsubChats();
            unsubUsers();
        };
    }, [currentUser]);

    const handleSaveProfile = async () => {
        if (!currentUser) return;
        try {
            await backend.updateUser(currentUser.id, { name: editName, status: editStatus });
            setIsEditingProfile(false);
            showToast('Profile updated!', 'success');
        } catch (e) {
            showToast('Failed to update profile', 'error');
        }
    };

    const handleStartDirectChat = async (targetUserId: string) => {
        if (!currentUser) return;
        try {
            const existingChat = await backend.findDirectChat(currentUser.id, targetUserId);
            if (existingChat) {
                navigate(`/chat/${existingChat.id}`);
            } else {
                const newChat = await backend.createChat('', [currentUser.id, targetUserId], false);
                navigate(`/chat/${newChat.id}`);
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to start chat', 'error');
        }
    };

    const filteredChats = chats.filter(chat => {
        if (chat.isGroup) return chat.name?.toLowerCase().includes(searchQuery.toLowerCase());
        const otherId = chat.participants.find(id => id !== currentUser?.id);
        const other = users.find(u => u.id === otherId);
        return other?.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const filteredUsers = users.filter(u => 
        u.id !== currentUser?.id && 
        (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (!currentUser) return null;

    switch (activeTab) {
        case 'CHATS':
            return (
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-20 md:pb-0">
                     <div className="sticky top-0 bg-background-dark/95 backdrop-blur-md z-10 pt-4 pb-2">
                        <div className="flex items-center bg-white/5 rounded-xl px-4 h-12 border border-white/10 mb-4">
                            <span className="material-symbols-rounded text-zinc-500">search</span>
                            <input 
                                className="bg-transparent border-none focus:ring-0 text-white w-full ml-2 placeholder-zinc-500" 
                                placeholder="Search chats..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Messages</h3>
                            <button onClick={() => navigate('/create-chat')} className="flex items-center gap-1 text-primary text-xs font-bold uppercase tracking-wider hover:text-white transition-colors">
                                <span className="material-symbols-rounded text-lg">add_circle</span>
                                New
                            </button>
                        </div>
                        {!isOnline && (
                             <div className="mb-2 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-xs animate-pulse">
                                <span className="material-symbols-rounded text-sm">wifi_off</span>
                                You are offline. Changes will sync when online.
                             </div>
                        )}
                     </div>

                    <div className="flex flex-col gap-2">
                        {filteredChats.map(chat => {
                            const otherParticipantId = chat.participants.find(id => id !== currentUser.id);
                            const otherUser = users.find(u => u.id === otherParticipantId);
                            const title = chat.isGroup ? chat.name : (otherUser?.name || 'Unknown User');
                            const avatar = chat.isGroup ? chat.avatar : otherUser?.avatar;

                            return (
                                <div key={chat.id} onClick={() => navigate(`/chat/${chat.id}`)} className="bg-white/5 border border-white/5 rounded-2xl p-3 pr-4 flex items-center gap-3 cursor-pointer hover:bg-white/10 transition-colors">
                                    <div className="relative">
                                        <img src={avatar} alt={title} className="w-12 h-12 rounded-full object-cover" />
                                        {chat.unreadCount > 0 && <div className="absolute top-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-background-dark"></div>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <h4 className="font-semibold text-white text-sm truncate">{title}</h4>
                                            <span className={`text-[10px] font-medium ${chat.unreadCount > 0 ? 'text-primary' : 'text-zinc-500'}`}>{formatTime(chat.lastMessageTime)}</span>
                                        </div>
                                        <p className={`text-xs truncate ${chat.unreadCount > 0 ? 'text-white font-medium' : 'text-zinc-500'}`}>{chat.lastMessage}</p>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredChats.length === 0 && (
                            <div className="text-center py-10 opacity-50 flex flex-col items-center">
                                <span className="material-symbols-rounded text-4xl mb-2">forum</span>
                                <p className="text-sm">No conversations found.</p>
                            </div>
                        )}
                    </div>
                </div>
            );
        case 'CONTACTS':
            return (
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-20 md:pb-0 pt-4">
                     <div className="flex items-center bg-white/5 rounded-xl px-4 h-12 border border-white/10 mb-6">
                        <span className="material-symbols-rounded text-primary">search</span>
                        <input 
                            className="bg-transparent border-none focus:ring-0 text-white w-full ml-2 placeholder-zinc-500" 
                            placeholder="Find people..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                     </div>
                     <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest pb-3 px-1">All Users</h3>
                     <div className="space-y-2">
                        {filteredUsers.map(user => (
                            <div key={user.id} onClick={() => handleStartDirectChat(user.id)} className="bg-white/5 border border-white/5 p-3 rounded-xl flex items-center cursor-pointer hover:bg-white/10 transition-colors">
                                <img src={user.avatar} className="size-10 rounded-full object-cover mr-3" alt={user.name}/>
                                <div className="flex-1">
                                    <h4 className="font-medium text-white text-sm">{user.name}</h4>
                                    <p className="text-xs text-zinc-500 truncate">{user.status || 'Available'}</p>
                                </div>
                                <span className="material-symbols-rounded text-zinc-600">chevron_right</span>
                            </div>
                        ))}
                     </div>
                </div>
            );
        case 'SETTINGS':
        case 'PROFILE':
             return <TabContentProfile activeTab={activeTab} currentUser={currentUser} navigate={navigate} isEditingProfile={isEditingProfile} setIsEditingProfile={setIsEditingProfile} editName={editName} setEditName={setEditName} editStatus={editStatus} setEditStatus={setEditStatus} handleSaveProfile={handleSaveProfile} showToast={showToast} />;
        default: return null;
    }
};

const TabContentProfile = ({ activeTab, currentUser, navigate, isEditingProfile, setIsEditingProfile, editName, setEditName, editStatus, setEditStatus, handleSaveProfile, showToast }: any) => {
    // Determine phone number display or fallback
    const displayPhone = currentUser.phone || currentUser.email || "+12 6541 1234";

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-24 md:pb-0 pt-6 animate-fade-in">
             {/* Header */}
            <div className="flex items-center justify-between mb-8 px-2">
                <button 
                    onClick={() => navigate(-1)} 
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                >
                     <span className="material-symbols-rounded">chevron_left</span>
                </button>
                <h2 className="text-xl font-bold text-white tracking-wide">My Profile</h2>
                <div className="w-10" /> {/* Spacer for visual centering */}
            </div>

            {/* Profile Info */}
            <div className="flex flex-col items-center mb-10">
                <div className="relative mb-4 group">
                    <div className="w-28 h-28 rounded-full p-1 border-2 border-[#3f3f3f] group-hover:border-primary/50 transition-colors">
                         <img src={currentUser.avatar} className="w-full h-full rounded-full object-cover" alt="Profile" />
                    </div>
                    {/* Online indicator */}
                    <div className="absolute bottom-2 right-2 w-6 h-6 bg-background-dark rounded-full flex items-center justify-center">
                        <div className="w-3.5 h-3.5 bg-primary rounded-full border-2 border-background-dark"></div>
                    </div>
                </div>
                
                {isEditingProfile ? (
                     <div className="w-full max-w-xs space-y-3">
                        <Input value={editName} onChange={(e: any) => setEditName(e.target.value)} placeholder="Display Name" />
                        <Input value={editStatus} onChange={(e: any) => setEditStatus(e.target.value)} placeholder="Status" />
                        <div className="flex gap-2">
                             <Button variant="secondary" onClick={() => setIsEditingProfile(false)} className="h-10 text-sm flex-1">Cancel</Button>
                             <Button onClick={handleSaveProfile} className="h-10 text-sm flex-1">Save</Button>
                        </div>
                     </div>
                ) : (
                    <>
                        <h3 className="text-2xl font-bold text-white mb-1">{currentUser.name}</h3>
                        <p className="text-zinc-500 text-sm font-medium mb-1">{displayPhone}</p>
                        <button 
                            onClick={() => setIsEditingProfile(true)}
                            className="text-xs text-primary font-bold uppercase tracking-wider mt-2 hover:text-white transition-colors"
                        >
                            Edit Profile
                        </button>
                    </>
                )}
            </div>

            {/* Menu Group 1 */}
            <div className="bg-[#1c1c1c] rounded-[32px] overflow-hidden mb-4 border border-white/5">
                {[
                    { icon: 'person', label: 'Account', sub: 'Security, change number', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { icon: 'lock', label: 'Privacy', sub: 'Blocked contacts, disappearing messages', color: 'text-green-400', bg: 'bg-green-500/10' },
                    { icon: 'notifications', label: 'Notifications', sub: 'Message, group & call tones', color: 'text-orange-400', bg: 'bg-orange-500/10' },
                    { icon: 'dns', label: 'Data and Storage', sub: 'Network usage, auto-download', color: 'text-purple-400', bg: 'bg-purple-500/10' }
                ].map((item, i) => (
                    <div key={i} className="flex items-center p-4 hover:bg-white/5 cursor-pointer active:bg-white/10 transition-colors border-b border-white/5 last:border-0">
                        <div className={`w-11 h-11 rounded-full ${item.bg} ${item.color} flex items-center justify-center mr-4`}>
                            <span className="material-symbols-rounded text-[22px]">{item.icon}</span>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-white font-semibold text-[15px]">{item.label}</h4>
                            <p className="text-zinc-500 text-xs mt-0.5">{item.sub}</p>
                        </div>
                        <span className="material-symbols-rounded text-zinc-600 text-xl">chevron_right</span>
                    </div>
                ))}
            </div>

            {/* Menu Group 2 */}
            <div className="bg-[#1c1c1c] rounded-[32px] overflow-hidden mb-8 border border-white/5">
                 <div className="flex items-center p-4 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5">
                        <div className="w-11 h-11 rounded-full bg-zinc-500/10 text-zinc-400 flex items-center justify-center mr-4">
                            <span className="material-symbols-rounded text-[22px]">help</span>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-white font-semibold text-[15px]">Help</h4>
                            <p className="text-zinc-500 text-xs mt-0.5">Help center, contact us</p>
                        </div>
                        <span className="material-symbols-rounded text-zinc-600 text-xl">chevron_right</span>
                </div>
                 <div onClick={() => { backend.logout(); navigate('/'); showToast('Logged out', 'info'); }} className="flex items-center p-4 hover:bg-red-500/10 cursor-pointer transition-colors group">
                        <div className="w-11 h-11 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mr-4 group-hover:bg-red-500/20 transition-colors">
                            <span className="material-symbols-rounded text-[22px]">logout</span>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-red-500 font-semibold text-[15px]">Log out</h4>
                        </div>
                </div>
            </div>
        </div>
    );
};

// Chat Screen
const ChatScreen = ({ isMobile }: { isMobile: boolean }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser, isOnline } = useContext(AppContext);
    
    const [chat, setChat] = useState<Chat | undefined>();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const endRef = useRef<HTMLDivElement>(null);
    const [otherUser, setOtherUser] = useState<User | undefined>();

    useEffect(() => {
        if (!currentUser || !id) return;

        // 1. Subscribe to Messages
        const unsubMsg = backend.subscribeToMessages(id, (liveMessages) => {
            setMessages(liveMessages);
        });

        // 2. Subscribe to Chat Metadata directly
        const unsubChat = backend.subscribeToChat(id, (c) => {
            if (c) {
                setChat(c);
                if (!c.isGroup) {
                     const otherId = c.participants.find(p => p !== currentUser.id);
                     if (otherId) {
                        // Subscribe to other user status for online indicator
                         // Note: creating a dedicated sub here is fine for this scale
                         const unsubU = backend.subscribeToUsers((users) => {
                             setOtherUser(users.find(u => u.id === otherId));
                         });
                         return () => unsubU();
                     }
                }
            }
        });

        return () => {
            unsubMsg();
            unsubChat();
        };
    }, [id, currentUser]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!input.trim() || !currentUser || !id) return;
        const txt = input;
        setInput('');
        
        backend.sendMessage(id, txt, currentUser.id).catch(err => {
            console.error("Send failed", err);
        });
    };

    if (!currentUser) return null;
    
    const title = chat?.isGroup ? chat.name : (otherUser?.name || 'Loading...');
    const avatar = chat?.isGroup ? chat.avatar : (otherUser?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=loading");
    const isOnlineUser = chat?.isGroup ? true : otherUser?.isOnline;

    return (
        <div className={`flex flex-col h-full relative overflow-hidden ${!isMobile ? 'bg-[#000]' : 'bg-background-dark'}`}>
             {!isMobile && (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.08),transparent_50%)] pointer-events-none"></div>
             )}

             <header className={`sticky top-0 z-30 bg-background-dark/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-white/5 ${isMobile ? 'pt-10' : 'h-16'}`}>
                <div className="flex items-center gap-3">
                    {isMobile && (
                        <button onClick={() => navigate('/')} className="size-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white">
                            <span className="material-symbols-rounded">arrow_back_ios_new</span>
                        </button>
                    )}
                    <div className="relative">
                        <img src={avatar} className="size-10 rounded-full object-cover ring-2 ring-primary/20" alt="Avatar"/>
                        {isOnlineUser && <div className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-background-dark"></div>}
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white leading-tight">{title}</h2>
                        <div className="flex items-center gap-1">
                            <p className="text-[11px] text-primary font-medium">{isOnlineUser ? 'Active Now' : 'Offline'}</p>
                            {!isOnline && <span className="text-[10px] text-red-500 font-bold ml-2">• OFFLINE</span>}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="size-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors">
                        <span className="material-symbols-rounded">videocam</span>
                    </button>
                    <button className="size-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors">
                        <span className="material-symbols-rounded">call</span>
                    </button>
                </div>
             </header>

             <main className="flex-1 overflow-y-auto px-4 md:px-10 py-6 flex flex-col gap-2 custom-scrollbar">
                {messages.map((msg, idx) => {
                    const isMe = msg.senderId === currentUser.id;
                    const isFirstInSequence = !messages[idx - 1] || messages[idx - 1].senderId !== msg.senderId;
                    const isLastInSequence = !messages[idx + 1] || messages[idx + 1].senderId !== msg.senderId;
                    const showAvatar = !isMe && isLastInSequence;
                    
                    let roundedClass = "rounded-[20px]";
                    if (isMe) {
                        roundedClass = isLastInSequence ? "rounded-[20px] rounded-br-[4px]" : "rounded-[20px] rounded-br-[4px]";
                        if (!isFirstInSequence) roundedClass += " rounded-tr-[4px]";
                    } else {
                         roundedClass = isLastInSequence ? "rounded-[20px] rounded-bl-[4px]" : "rounded-[20px] rounded-bl-[4px]";
                         if (!isFirstInSequence) roundedClass += " rounded-tl-[4px]";
                    }

                    return (
                        <div key={msg.id} className={`flex items-end gap-2 max-w-[85%] md:max-w-[65%] group animate-fade-in ${isMe ? 'self-end justify-end' : ''} ${isFirstInSequence ? 'mt-5' : 'mt-1'}`}>
                            {!isMe && (
                                <div className="w-8 flex-shrink-0 flex flex-col justify-end">
                                    {showAvatar && <img src={otherUser?.avatar} className="size-8 rounded-full object-cover ring-2 ring-white/5" alt="avatar" />}
                                </div>
                            )}
                            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                {chat?.isGroup && !isMe && isFirstInSequence && (
                                    <span className="text-[10px] text-zinc-400 ml-3 mb-1 font-medium tracking-wide">User</span>
                                )}
                                <div className={`relative px-5 py-3 text-[15px] leading-relaxed break-words shadow-sm transition-all duration-200 ${roundedClass} ${
                                    isMe 
                                        ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-orange-500/10 border border-white/10' 
                                        : 'bg-white/5 backdrop-blur-2xl text-zinc-100 border border-white/5 hover:bg-white/10'
                                } ${msg.isPending ? 'opacity-70' : ''}`}>
                                    {msg.text}
                                    {msg.isPending && (
                                        <div className="absolute bottom-2 right-2 flex gap-1">
                                            <span className="material-symbols-rounded text-[10px] animate-spin">sync</span>
                                        </div>
                                    )}
                                </div>
                                {isLastInSequence && (
                                     <div className="flex items-center gap-1 mt-1.5">
                                         <span className={`text-[10px] mx-1 font-medium opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'text-zinc-500' : 'text-zinc-500'}`}>
                                            {formatTime(msg.timestamp)}
                                         </span>
                                         {msg.isPending && <span className="text-[10px] text-zinc-500 italic">Sending...</span>}
                                     </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} />
             </main>

             <footer className="p-4 bg-background-dark/80 backdrop-blur-md border-t border-white/5">
                 <form onSubmit={handleSend} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-3 py-2 max-w-4xl mx-auto shadow-lg">
                    <button type="button" className="size-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-white transition-colors">
                        <span className="material-symbols-rounded">mood</span>
                    </button>
                    <button type="button" className="size-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-white transition-colors">
                        <span className="material-symbols-rounded">attach_file</span>
                    </button>
                    <input 
                        value={input} 
                        onChange={e => setInput(e.target.value)}
                        className="flex-1 bg-transparent border-none text-white placeholder-zinc-500 focus:ring-0 text-sm" 
                        placeholder={isOnline ? "Type a message..." : "Waiting for network..."}
                        autoFocus
                    />
                    <button type="submit" className={`size-10 rounded-full flex items-center justify-center text-white transition-all ${input ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-white/10'}`}>
                        <span className="material-symbols-rounded text-[20px]">{input ? 'send' : 'mic'}</span>
                    </button>
                 </form>
             </footer>
        </div>
    );
};

// --- SCREENS ---

const AuthScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useContext(AppContext);
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!formData.email || !formData.password) {
          showToast('Please enter both email and password', 'error');
          return;
      }
      
      if (!isLogin && !formData.name) {
          showToast('Please enter your name', 'error');
          return;
      }

      setLoading(true);
      try {
          if (isLogin) {
              await backend.login(formData.email, formData.password);
              showToast('Welcome back!', 'success');
          } else {
              await backend.signup(formData.name, formData.email, formData.password);
              showToast('Account created successfully!', 'success');
          }
      } catch (err: any) {
          console.error(err);
          let msg = err.message || 'Authentication failed';
          // Friendly mapping
          if(msg.includes('auth/email-already-in-use')) msg = 'Account exists. Please log in.';
          if(msg.includes('auth/invalid-credential')) msg = 'Invalid credentials';
          if(msg.includes('auth/weak-password')) msg = 'Password should be at least 6 characters';
          if(msg.includes('not configured')) msg = 'Database missing: Create Firestore in Firebase Console';
          showToast(msg, 'error');
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background-dark flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_10%,rgba(249,115,22,0.1),transparent_40%)] pointer-events-none"></div>

        <div className="w-full max-w-[380px] z-10 flex flex-col">
            <div className="mb-8 animate-fade-in text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-orange-900/20 mx-auto">
                    <span className="material-symbols-rounded text-[40px] text-white select-none">chat_bubble_outline</span>
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight mb-3 font-display">
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                </h1>
                <p className="text-zinc-400 font-medium text-sm leading-relaxed px-4">
                    {isLogin ? 'Log in to continue your conversations.' : 'Join vChat and start messaging.'}
                </p>
                {!backend.isConfigured() && (
                    <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-xs text-left">
                        <strong>Configuration Required:</strong><br/>
                        Please open <code>services/backend.ts</code> and paste your Firebase configuration keys to make the app functional.
                    </div>
                )}
            </div>

            <form className="space-y-4 animate-fade-in" onSubmit={handleSubmit}>
                {!isLogin && (
                    <Input label="Full Name" icon="person" placeholder="John Doe" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                )}
                <Input label="Email" icon="alternate_email" placeholder="hello@vchat.com" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                <Input label="Password" icon="lock_open" placeholder="••••••••" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                
                <div className="pt-4">
                    <Button type="submit" icon="arrow_forward" disabled={loading} fullWidth>
                        {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
                    </Button>
                </div>
            </form>

            <div className="mt-8 text-center animate-fade-in">
                <button onClick={() => setIsLogin(!isLogin)} className="text-zinc-500 text-sm font-medium hover:text-white transition-colors">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <span className="text-primary font-bold hover:underline">{isLogin ? 'Sign Up' : 'Log In'}</span>
                </button>
            </div>
        </div>
    </div>
  );
};

const CreateChatScreen = () => {
    const navigate = useNavigate();
    const { showToast, currentUser, isOnline } = useContext(AppContext);
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !currentUser) return;
        setLoading(true);
        try {
            await backend.createChat(name, [currentUser.id], true);
            showToast('Group created!', 'success');
            navigate('/');
        } catch(e) {
            showToast('Failed to create group', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background-dark flex flex-col p-6 items-center justify-center">
            <div className="w-full max-w-md">
                <header className="flex items-center pb-8">
                    <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white">
                        <span className="material-symbols-rounded">chevron_left</span>
                    </button>
                    <h1 className="text-lg font-semibold ml-4 text-white">New Room</h1>
                </header>
                <form onSubmit={handleCreate} className="space-y-6">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center border-2 border-dashed border-primary mb-4">
                            <span className="material-symbols-rounded text-4xl text-primary">groups</span>
                        </div>
                        <p className="text-zinc-400 text-center text-sm px-10">Create a public room for the community to join.</p>
                    </div>
                    <Input label="Room Name" placeholder="e.g. Design Team" value={name} onChange={e => setName(e.target.value)} autoFocus />
                    <Button type="submit" disabled={loading} className="mt-8" fullWidth>{loading ? 'Creating...' : 'Create Room'}</Button>
                </form>
            </div>
        </div>
    );
};

const MobileLayout = () => {
    const [activeTab, setActiveTab] = useState<TabName>('CHATS');
    const navigate = useNavigate();
    const { currentUser } = useContext(AppContext);

    if (!currentUser) return <AuthScreen />;

    return (
        <div className="max-w-md mx-auto h-[100dvh] overflow-hidden bg-background-dark shadow-2xl relative flex flex-col">
            <Routes>
                <Route path="/" element={
                     <div className="flex flex-col h-full">
                        <header className="px-6 pt-10 pb-4 flex justify-between items-center">
                            <h1 className="text-2xl font-bold text-white font-display">
                                {activeTab === 'CHATS' ? 'vChat' : activeTab.charAt(0) + activeTab.slice(1).toLowerCase()}
                            </h1>
                        </header>
                        <TabContent activeTab={activeTab} navigate={navigate} />
                        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
                    </div>
                } />
                <Route path="/chat/:id" element={<ChatScreen isMobile={true} />} />
                <Route path="/create-chat" element={<CreateChatScreen />} />
                <Route path="/call/*" element={<div className="text-white p-10 text-center">Call Interface (Demo)</div>} />
            </Routes>
        </div>
    );
};

const WebLayout = () => {
    const [activeTab, setActiveTab] = useState<TabName>('CHATS');
    const navigate = useNavigate();
    const { currentUser } = useContext(AppContext);
    
    if (!currentUser) return <AuthScreen />;

    return (
        <div className="flex w-full h-[100dvh] bg-black overflow-hidden">
            <div className="w-[400px] flex border-r border-white/10 bg-[#0f0f0f] relative z-20">
                <SideNav activeTab={activeTab} onTabChange={setActiveTab} />
                <div className="flex-1 flex flex-col h-full bg-[#121212]">
                     <div className="px-6 py-8 border-b border-white/5">
                        <h1 className="text-2xl font-bold text-white font-display">
                            {activeTab === 'CHATS' ? 'vChat' : activeTab.charAt(0) + activeTab.slice(1).toLowerCase()}
                        </h1>
                     </div>
                     <TabContent activeTab={activeTab} navigate={navigate} />
                </div>
            </div>
            
            <div className="flex-1 bg-[#050505] relative flex flex-col">
                <Routes>
                    <Route path="/" element={
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 select-none">
                            <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mb-6">
                                <span className="material-symbols-rounded text-6xl opacity-50">forum</span>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Welcome to vChat Web</h2>
                            <p className="max-w-md text-center text-sm">Send and receive messages without keeping your phone online.<br/>Use vChat on up to 4 linked devices and 1 phone.</p>
                            <div className="mt-8 text-xs flex gap-2 items-center text-zinc-600">
                                <span className="material-symbols-rounded text-sm">lock</span>
                                End-to-end encrypted
                            </div>
                        </div>
                    } />
                    <Route path="/chat/:id" element={<ChatScreen isMobile={false} />} />
                    <Route path="/create-chat" element={<CreateChatScreen />} />
                </Routes>
            </div>
        </div>
    );
};

export default function App() {
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const isMobile = useIsMobile();
  const isOnline = useNetworkStatus();
  
  useEffect(() => {
    // This now sets up the real-time auth listener
    const unsub = backend.onAuthChange((u) => {
        setUser(u);
    });
    return unsub;
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToast({ msg, type });
  };

  const Main = isMobile ? MobileLayout : WebLayout;

  const [loading, setLoading] = useState(true);
  useEffect(() => { 
      // Simplified auth waiting logic, just enough for the splash
      backend.waitForAuth().then(() => setLoading(false));
  }, []);

  if (loading) return (
      <HashRouter>
         <div className="min-h-screen bg-black flex flex-col items-center justify-center">
            <span className="text-4xl font-black text-white italic">v<span className="text-primary">.</span></span>
         </div>
      </HashRouter>
  );

  return (
    <AppContext.Provider value={{ showToast, currentUser: user, isOnline }}>
        <HashRouter>
            {!user ? <AuthScreen /> : <Main />}
            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        </HashRouter>
    </AppContext.Provider>
  );
}