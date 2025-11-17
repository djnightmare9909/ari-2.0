
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
        <div className={`
            ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
            absolute md:relative md:translate-x-0 z-30
            flex flex-col h-full w-72 bg-slate-800/80 backdrop-blur-md border-r border-slate-700
            transition-transform duration-300 ease-in-out
        `}>
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Recursive Reasoning</h1>
                <button
                    onClick={onNewChat}
                    className="p-2 rounded-md hover:bg-slate-700 transition-colors"
                    title="New Chat"
                >
                    <Icon name="plus" className="w-5 h-5"/>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {chats.map(chat => (
                    <div
                        key={chat.id}
                        onClick={() => onSelectChat(chat.id)}
                        className={`
                            group flex items-center justify-between p-3 rounded-lg cursor-pointer
                            transition-colors
                            ${activeChatId === chat.id ? 'bg-blue-600/50' : 'hover:bg-slate-700/50'}
                        `}
                    >
                        <div className="flex-1 truncate pr-2">
                            <p className="font-medium truncate">{chat.title}</p>
                            <p className="text-xs text-slate-400">{timeAgo(chat.createdAt)}</p>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                            className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-opacity"
                            title="Delete Chat"
                        >
                           <Icon name="trash" className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
            
            <div className="p-4 border-t border-slate-700">
                <button className="flex items-center w-full p-2 space-x-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                    <Icon name="user" className="w-6 h-6 rounded-full bg-slate-600 p-1"/>
                    <span className="font-medium">User Profile</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
