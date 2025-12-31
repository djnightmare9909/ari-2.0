
import React from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Message } from '../types';
import { Icon } from './Icon';

interface ChatMessageProps {
    message: Message;
    isStreaming: boolean;
    ttsState: {
        speak: (text: string) => void;
        isPlaying: boolean;
        isLoading: boolean;
    }
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming, ttsState }) => {
    const { role, parts } = message;
    const { speak, isPlaying, isLoading: isTTSLoading } = ttsState;
    const isModel = role === 'model';

    const parsedHtml = (text: string) => {
        const rawMarkup = marked.parse(text);
        // Sanitize to prevent XSS attacks
        return DOMPurify.sanitize(rawMarkup as string);
    };

    const handleSpeak = () => {
        const textToSpeak = parts.map(p => p.text).join(' ');
        if(textToSpeak) {
            speak(textToSpeak);
        }
    };
    
    return (
        <div className={`flex gap-4 ${isModel ? '' : 'justify-start'}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isModel ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-slate-600'}`}>
                {isModel ? <Icon name="spark" className="w-5 h-5 text-white" /> : <Icon name="user" className="w-5 h-5 text-slate-300"/>}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
                <div className="font-bold text-slate-300 mb-1">{isModel ? 'Ari' : 'You'}</div>
                <div className="space-y-4">
                    {parts.map((part, index) => (
                        <div key={index}>
                            {part.image && (
                                <img
                                    src={`data:${part.image.mimeType};base64,${part.image.data}`}
                                    alt="Uploaded content"
                                    className="rounded-lg max-w-sm"
                                />
                            )}
                            {part.text && (
                                <div
                                    className="prose prose-invert prose-p:text-slate-200 prose-li:text-slate-200 prose-headings:text-slate-100 prose-strong:text-slate-100"
                                    dangerouslySetInnerHTML={{ __html: parsedHtml(part.text) }}
                                />
                            )}
                        </div>
                    ))}
                    {isStreaming && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></div>}
                </div>
                
                {isModel && !isStreaming && parts.some(p => p.text) && (
                    <div className="mt-2">
                        <button onClick={handleSpeak} disabled={isTTSLoading || isPlaying} className="p-2 rounded-full hover:bg-slate-700 transition-colors text-slate-400 disabled:text-slate-600">
                             {isTTSLoading ? <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div> :
                              isPlaying ? <Icon name="stop" className="w-5 h-5"/> : <Icon name="speaker" className="w-5 h-5"/> }
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessage;
