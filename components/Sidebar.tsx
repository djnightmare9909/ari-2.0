
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
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return "Just now";
    };

    return (
        <>
            {/* Backdrop */}
            <div 
                className={`
                    fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300
                    ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                `}
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
            />

            {/* Sidebar Drawer */}
            <div className={`
                fixed top-0 left-0 bottom-0 z-50 w-72
                bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 shadow-2xl
                transform transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="w-full h-full flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent whitespace-nowrap">
                            Recursive Reasoning
                        </h1>
                        <button
                            onClick={onNewChat}
                            className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                            title="New Chat"
                        >
                            <Icon name="plus" className="w-5 h-5"/>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {chats.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => {
                                    onSelectChat(chat.id);
                                }}
                                className={`
                                    group flex items-center justify-between p-3 rounded-xl cursor-pointer
                                    transition-all duration-200 border border-transparent
                                    ${activeChatId === chat.id 
                                        ? 'bg-slate-800 border-slate-700 shadow-sm' 
                                        : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                                    }
                                `}
                            >
                                <div className="flex-1 min-w-0 pr-2">
                                    <p className={`font-medium truncate text-sm ${activeChatId === chat.id ? 'text-white' : ''}`}>
                                        {chat.title}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">{timeAgo(chat.createdAt)}</p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                                    className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                                    title="Delete Chat"
                                >
                                   <Icon name="trash" className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                    
                    <div className="p-4 border-t border-slate-700/50 bg-slate-900/50">
                        <button className="flex items-center w-full p-3 space-x-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-400 hover:text-white">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <Icon name="user" className="w-5 h-5 text-white"/>
                            </div>
                            <span className="font-medium text-sm">User Profile</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
