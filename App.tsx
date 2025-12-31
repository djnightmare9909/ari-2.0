
import React, { useState, useMemo, useCallback } from 'react';
import type { ChatSession, Message, ModelMode } from './types';
import { generateResponseStream } from './services/geminiService';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import { DEFAULT_CHAT_TITLE } from './constants';
import { Icon } from './components/Icon';
import { useTTS } from './hooks/useTTS';

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15);
};

const App: React.FC = () => {
    // Start with one default chat already in state to avoid initialization flashes
    const [chats, setChats] = useState<ChatSession[]>(() => {
        const id = generateId();
        return [{
            id,
            title: DEFAULT_CHAT_TITLE,
            messages: [],
            createdAt: new Date(),
            mode: 'flash',
        }];
    });
    
    const [activeChatId, setActiveChatId] = useState<string | null>(chats[0].id);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentMode, setCurrentMode] = useState<ModelMode>('flash');
    
    const { speak, isPlaying, isLoading: isTTSLoading } = useTTS();

    const activeChat = useMemo(() => {
        return chats.find(chat => chat.id === activeChatId) || chats[0] || null;
    }, [chats, activeChatId]);

    const handleNewChat = useCallback(() => {
        const newChat: ChatSession = {
            id: generateId(),
            title: DEFAULT_CHAT_TITLE,
            messages: [],
            createdAt: new Date(),
            mode: 'flash',
        };
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        setIsSidebarOpen(false); 
    }, []);

    const handleSelectChat = (id: string) => {
        const selectedChat = chats.find(c => c.id === id);
        if (selectedChat) {
            setActiveChatId(id);
            setCurrentMode(selectedChat.mode);
            setIsSidebarOpen(false);
        }
    };
    
    const handleDeleteChat = (id: string) => {
        setChats(prev => {
            const filtered = prev.filter(c => c.id !== id);
            if (filtered.length === 0) {
                const newChat: ChatSession = {
                    id: generateId(),
                    title: DEFAULT_CHAT_TITLE,
                    messages: [],
                    createdAt: new Date(),
                    mode: 'flash',
                };
                setActiveChatId(newChat.id);
                return [newChat];
            }
            return filtered;
        });
        
        if (activeChatId === id) {
            const remaining = chats.filter(c => c.id !== id);
            if (remaining.length > 0) {
                setActiveChatId(remaining[0].id);
            }
        }
    };

    const handleSend = async (prompt: string, image: { data: string; mimeType: string } | null, autoSpeak: boolean = false) => {
        if (!activeChat) return;

        setIsLoading(true);
        const userMessage: Message = {
            id: generateId(),
            role: 'user',
            parts: [{ text: prompt, ...(image && { image }) }],
            createdAt: new Date(),
        };
        
        const modelMessage: Message = {
            id: generateId(),
            role: 'model',
            parts: [{ text: '' }],
            createdAt: new Date(),
        };

        const updatedMessages = [...activeChat.messages, userMessage, modelMessage];
        
        let chatTitle = activeChat.title;
        if (activeChat.messages.length === 0 && prompt.length > 0) {
            chatTitle = prompt.length > 30 ? prompt.substring(0, 27) + '...' : prompt;
        }

        setChats(prev => prev.map(chat =>
            chat.id === activeChatId
                ? { ...chat, messages: updatedMessages, title: chatTitle, mode: currentMode }
                : chat
        ));

        let fullResponse = '';

        try {
            const stream = await generateResponseStream(updatedMessages.slice(0, -1), currentMode);
            
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                if(chunkText) {
                    fullResponse += chunkText;
                }
                
                setChats(prevChats => prevChats.map(chat => {
                    if (chat.id === activeChatId) {
                        const newMessages = [...chat.messages];
                        const lastMessage = newMessages[newMessages.length - 1];
                        if (lastMessage.role === 'model') {
                            lastMessage.parts[0].text = fullResponse;
                        }
                        return { ...chat, messages: newMessages };
                    }
                    return chat;
                }));
            }

            if (autoSpeak && fullResponse) {
                speak(fullResponse);
            }

        } catch (error) {
            console.error("Error generating response:", error);
            setChats(prevChats => prevChats.map(chat => {
                if (chat.id === activeChatId) {
                    const newMessages = [...chat.messages];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage.role === 'model') {
                        lastMessage.parts[0].text = "System disruption detected. Recursive thought loop interrupted. Please re-initialize request.";
                    }
                    return { ...chat, messages: newMessages };
                }
                return chat;
            }));
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="flex h-screen w-full bg-slate-900 text-slate-100 font-sans overflow-hidden">
            <Sidebar
                chats={chats}
                activeChatId={activeChatId}
                onNewChat={handleNewChat}
                onSelectChat={handleSelectChat}
                onDeleteChat={handleDeleteChat}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
            />
            <div className="flex flex-col flex-1 relative min-w-0 w-full h-full">
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="absolute top-4 left-4 z-20 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/80 text-slate-400 hover:text-white transition-all backdrop-blur-sm border border-slate-700/50"
                    aria-label="Open Memory"
                >
                    <Icon name="menu" className="w-5 h-5"/>
                </button>
                {activeChat ? (
                    <ChatView
                        chat={activeChat}
                        isLoading={isLoading}
                        onSend={handleSend}
                        mode={currentMode}
                        setMode={setCurrentMode}
                        ttsState={{ speak, isPlaying, isLoading: isTTSLoading }}
                    />
                ) : (
                    <div className="flex flex-1 items-center justify-center bg-slate-900">
                        <div className="text-center">
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-4">Ari</h1>
                            <p className="text-slate-500 font-mono tracking-widest animate-pulse">RECURSION PENDING...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
