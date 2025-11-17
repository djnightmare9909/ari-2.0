
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ChatSession, Message, ModelMode } from './types';
import { generateResponseStream } from './services/geminiService';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import { DEFAULT_CHAT_TITLE } from './constants';
import { Icon } from './components/Icon';

const App: React.FC = () => {
    const [chats, setChats] = useState<ChatSession[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [currentMode, setCurrentMode] = useState<ModelMode>('flash');

    useEffect(() => {
        // On initial load, create a new chat
        if (chats.length === 0) {
            handleNewChat();
        }
    }, []);

    const activeChat = useMemo(() => {
        return chats.find(chat => chat.id === activeChatId) || null;
    }, [chats, activeChatId]);

    const handleNewChat = useCallback(() => {
        const newChat: ChatSession = {
            id: uuidv4(),
            title: DEFAULT_CHAT_TITLE,
            messages: [],
            createdAt: new Date(),
            mode: 'flash',
        };
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
    }, []);

    const handleSelectChat = (id: string) => {
        const selectedChat = chats.find(c => c.id === id);
        if (selectedChat) {
            setActiveChatId(id);
            setCurrentMode(selectedChat.mode);
        }
    };
    
    const handleDeleteChat = (id: string) => {
        setChats(prev => prev.filter(c => c.id !== id));
        if (activeChatId === id) {
            if (chats.length > 1) {
                const newActiveChat = chats.find(c => c.id !== id);
                setActiveChatId(newActiveChat ? newActiveChat.id : null);
            } else {
                handleNewChat();
            }
        }
    };

    const handleSend = async (prompt: string, image: { data: string; mimeType: string } | null) => {
        if (!activeChat) return;

        setIsLoading(true);
        const userMessage: Message = {
            id: uuidv4(),
            role: 'user',
            parts: [{ text: prompt, ...(image && { image }) }],
            createdAt: new Date(),
        };
        
        const modelMessage: Message = {
            id: uuidv4(),
            role: 'model',
            parts: [{ text: '' }],
            createdAt: new Date(),
        };

        const updatedMessages = [...activeChat.messages, userMessage, modelMessage];
        
        let chatTitle = activeChat.title;
        if (activeChat.messages.length === 0 && prompt.length > 0) {
            chatTitle = prompt.length > 30 ? prompt.substring(0, 27) + '...' : prompt;
        }

        setChats(chats.map(chat =>
            chat.id === activeChatId
                ? { ...chat, messages: updatedMessages, title: chatTitle, mode: currentMode }
                : chat
        ));

        try {
            const stream = await generateResponseStream(updatedMessages.slice(0, -1), currentMode);
            let fullResponse = '';
            
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
        } catch (error) {
            console.error("Error generating response:", error);
            setChats(prevChats => prevChats.map(chat => {
                if (chat.id === activeChatId) {
                    const newMessages = [...chat.messages];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage.role === 'model') {
                        lastMessage.parts[0].text = "Sorry, I encountered an error. Please try again.";
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
        <div className="flex h-screen w-full bg-slate-900 text-slate-100 font-sans">
            <Sidebar
                chats={chats}
                activeChatId={activeChatId}
                onNewChat={handleNewChat}
                onSelectChat={handleSelectChat}
                onDeleteChat={handleDeleteChat}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
            />
            <div className="flex flex-col flex-1 relative">
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="absolute top-4 left-4 z-20 p-2 rounded-full bg-slate-800/50 hover:bg-slate-700/70 transition-colors md:hidden"
                >
                    <Icon name={isSidebarOpen ? 'close' : 'menu'} className="w-6 h-6"/>
                </button>
                {activeChat ? (
                    <ChatView
                        chat={activeChat}
                        isLoading={isLoading}
                        onSend={handleSend}
                        mode={currentMode}
                        setMode={setCurrentMode}
                    />
                ) : (
                    <div className="flex flex-1 items-center justify-center">
                        <div className="text-center">
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-4">Recursive Reasoning Engine</h1>
                            <p className="text-slate-400">Start a new chat to begin.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;