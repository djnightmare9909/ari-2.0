
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ChatSession, Message, ModelMode } from './types';
import { generateResponseStream } from './services/geminiService';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import LivePerception from './components/LivePerception';
import { DEFAULT_CHAT_TITLE } from './constants';
import { Icon } from './components/Icon';
import { useTTS } from './hooks/useTTS';

const App: React.FC = () => {
    const [chats, setChats] = useState<ChatSession[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentMode, setCurrentMode] = useState<ModelMode>('flash');
    
    // Live Perception State
    const [isLiveMode, setIsLiveMode] = useState(false);
    const { speak, cancel, isPlaying, isLoading: isTTSLoading } = useTTS();

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

    const handleSend = async (prompt: string, image: { data: string; mimeType: string } | null, autoSpeak: boolean = false) => {
        if (!activeChat) return;

        // Stop any current speech when sending a new message
        cancel();

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

            // AUTO-SPEAK: Trigger TTS if this was a live voice interaction
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
                        lastMessage.parts[0].text = "I'm experiencing a disruption in my thought process. Can we try that again?";
                    }
                    return { ...chat, messages: newMessages };
                }
                return chat;
            }));
            if (autoSpeak) speak("I'm experiencing a disruption in my thought process.");
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
                        isLiveMode={isLiveMode}
                        setLiveMode={setIsLiveMode}
                        ttsState={{ speak, cancel, isPlaying, isLoading: isTTSLoading }}
                    />
                ) : (
                    <div className="flex flex-1 items-center justify-center">
                        <div className="text-center">
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-4">Ari</h1>
                            <p className="text-slate-400">Initialize sequence...</p>
                        </div>
                    </div>
                )}
                
                {isLiveMode && (
                    <LivePerception 
                        onVoiceInput={(text) => handleSend(text, null, true)}
                        onClose={() => {
                            setIsLiveMode(false);
                            cancel(); // Stop speaking when closing live mode
                        }}
                        stopAudio={cancel}
                        isProcessing={isLoading}
                    />
                )}
            </div>
        </div>
    );
};

export default App;
