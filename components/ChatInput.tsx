
import React, { useState, useRef, useCallback } from 'react';
import { Icon } from './Icon';

interface ChatInputProps {
    onSend: (prompt: string, image: { data: string; mimeType: string } | null) => void;
    isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading }) => {
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<{ data: string; mimeType: string; name: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result?.toString().split(',')[1];
                if (base64String) {
                    setImage({ data: base64String, mimeType: file.type, name: file.name });
                }
            };
            reader.readAsDataURL(file);
        }
    };
    
    const adjustTextareaHeight = useCallback(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPrompt(e.target.value);
        adjustTextareaHeight();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if ((prompt.trim() || image) && !isLoading) {
            onSend(prompt, image);
            setPrompt('');
            setImage(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as unknown as React.FormEvent);
        }
    };
    
    const removeImage = () => {
        setImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    return (
        <form onSubmit={handleSubmit} className="relative bg-slate-800 border border-slate-600 rounded-2xl p-2 flex flex-col">
            {image && (
                <div className="m-2 p-2 bg-slate-700 rounded-lg flex items-center gap-2 max-w-xs">
                    <Icon name="image" className="w-5 h-5 text-slate-400 flex-shrink-0"/>
                    <span className="text-sm truncate text-slate-300 flex-1">{image.name}</span>
                    <button onClick={removeImage} type="button" className="p-1 rounded-full hover:bg-slate-600">
                        <Icon name="close" className="w-4 h-4"/>
                    </button>
                </div>
            )}
            <div className="flex items-end w-full">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 rounded-full hover:bg-slate-700 transition-colors flex-shrink-0"
                    title="Upload image"
                >
                    <Icon name="upload" className="w-6 h-6 text-slate-400"/>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                
                <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Message WFGY Core..."
                    rows={1}
                    className="w-full bg-transparent resize-none outline-none text-slate-100 placeholder-slate-500 py-3 px-2 max-h-48"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading || (!prompt.trim() && !image)}
                    className="p-3 rounded-full bg-blue-600 text-white disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-blue-500 transition-colors flex-shrink-0"
                >
                    {isLoading ? <div className="w-6 h-6 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></div> : <Icon name="send" className="w-6 h-6"/>}
                </button>
            </div>
        </form>
    );
};

export default ChatInput;
