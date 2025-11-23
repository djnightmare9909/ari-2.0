
import React from 'react';
import type { ChatSession } from '../types';
import { Icon } from './Icon';

interface SidebarProps {
    chats: ChatSession[];
    activeChatId: string | null;
    onNewChat: () => void;
    onSelectChat: (id: string) => void;
    onDeleteChat: (id: string) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ chats, activeChatId, onNewChat, onSelectChat, onDeleteChat, isOpen, setIsOpen }) => {
    
    const timeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m";
        return "now";
    };

    return (
        <>
            {/* Backdrop - Visible on all screens when open */}
            <div 
                className={`
                    fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300
                    ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                `}
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
            />

            {/* Sidebar Drawer - Collapsible Overlay for all screens */}
            <div className={`
                fixed top-0 left-0 bottom-0 z-50 w-72
                bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 shadow-2xl
                transform transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="w-full h-full flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-800">
                        <span className="text-sm font-bold tracking-widest text-slate-400 uppercase">
                            Memory
                        </span>
                        <div className="flex gap-2">
                             <button
                                onClick={onNewChat}
                                className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                                title="New Chat"
                            >
                                <Icon name="plus" className="w-5 h-5"/>
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                            >
                                <Icon name="close" className="w-5 h-5"/>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                        {chats.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => {
                                    onSelectChat(chat.id);
                                    setIsOpen(false); // Auto-close on selection
                                }}
                                className={`
                                    group flex items-center justify-between p-3 rounded-lg cursor-pointer
                                    transition-all duration-200 border border-transparent
                                    ${activeChatId === chat.id 
                                        ? 'bg-slate-800 border-slate-700/50 text-slate-200' 
                                        : 'hover:bg-slate-800/50 text-slate-500 hover:text-slate-300'
                                    }
                                `}
                            >
                                <div className="flex-1 min-w-0 pr-2">
                                    <p className="font-medium truncate text-sm">
                                        {chat.title}
                                    </p>
                                    <p className="text-xs opacity-60 mt-0.5">{timeAgo(chat.createdAt)}</p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                                    className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-all"
                                    title="Delete Chat"
                                >
                                   <Icon name="trash" className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
