
import React from 'react';
import type { ChatSession, ModelMode } from '../types';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import ModeSelector from './ModeSelector';
import { Icon } from './Icon';

interface ChatViewProps {
    chat: ChatSession;
    isLoading: boolean;
    onSend: (prompt: string, image: { data: string, mimeType: string } | null, autoSpeak?: boolean) => void;
    mode: ModelMode;
    setMode: (mode: ModelMode) => void;
    isLiveMode: boolean;
    setLiveMode: (isLive: boolean) => void;
    ttsState: {
        speak: (text: string) => void;
        cancel: () => void;
        isPlaying: boolean;
        isLoading: boolean;
    }
}

const ChatView: React.FC<ChatViewProps> = ({ 
    chat, 
    isLoading, 
    onSend, 
    mode, 
    setMode, 
    isLiveMode, 
    setLiveMode,
    ttsState 
}) => {
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chat.messages]);

    const WelcomeScreen = () => (
        <div className="flex flex-col items-center justify-center h-full text-center">
             <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6">
                <Icon name="spark" className="w-12 h-12 text-white"/>
            </div>
            <h1 className="text-4xl font-bold text-slate-200">I am Ari.</h1>
            <p className="text-lg text-slate-400 mt-2">A new narrative begins. What shall we explore?</p>
        </div>
    );

    return (
        <div className="flex flex-col flex-1 h-full">
            <header className="flex items-center justify-between p-4 bg-slate-900/50 backdrop-blur-md border-b border-slate-700 z-10">
                <div className="flex items-center gap-4 ml-12">
                     <h2 className="text-lg font-semibold truncate hidden md:block">{chat.title}</h2>
                     <ModeSelector currentMode={mode} onModeChange={setMode} />
                </div>
               
                <button
                    onClick={() => setLiveMode(!isLiveMode)}
                    className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all
                        ${isLiveMode 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 ring-2 ring-emerald-500/20' 
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                        }
                    `}
                >
                    <Icon name="camera" className={`w-4 h-4 ${isLiveMode ? 'animate-pulse' : ''}`} />
                    <span className="hidden sm:inline">{isLiveMode ? 'LIVE PERCEPTION' : 'Live Mode'}</span>
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto">
                    {chat.messages.length === 0 ? <WelcomeScreen /> : (
                        <div className="space-y-6">
                            {chat.messages.map((msg, index) => (
                                <ChatMessage 
                                    key={msg.id} 
                                    message={msg} 
                                    isStreaming={isLoading && index === chat.messages.length - 1} 
                                    ttsState={ttsState}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
            </main>
            
            <footer className="p-4 md:p-6 bg-slate-900">
                <div className="max-w-4xl mx-auto">
                    <ChatInput onSend={(p, i) => onSend(p, i, false)} isLoading={isLoading} />
                </div>
            </footer>
        </div>
    );
};

export default ChatView;
