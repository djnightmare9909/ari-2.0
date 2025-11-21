
import React from 'react';
import type { ModelMode } from '../types';
import { Icon } from './Icon';

interface ModeSelectorProps {
    currentMode: ModelMode;
    onModeChange: (mode: ModelMode) => void;
}

const modes: { id: ModelMode; name: string; icon: React.ComponentProps<typeof Icon>['name']; description: string }[] = [
    { id: 'flash', name: 'Flash 2.5', icon: 'bolt', description: 'Fast responses with Gemini 2.5 Flash.' },
    { id: 'pro', name: 'Pro 3.0', icon: 'brain', description: 'Advanced reasoning with Gemini 3.0 Pro.' },
];

const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onModeChange }) => {
    return (
        <div className="flex items-center bg-slate-800 rounded-full p-1 border border-slate-700">
            {modes.map(mode => (
                <button
                    key={mode.id}
                    onClick={() => onModeChange(mode.id)}
                    className={`
                        flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-full transition-colors
                        ${currentMode === mode.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}
                    `}
                    title={mode.description}
                >
                   <Icon name={mode.icon} className="w-4 h-4"/>
                   <span className="hidden md:inline">{mode.name}</span>
                </button>
            ))}
        </div>
    );
};

export default ModeSelector;