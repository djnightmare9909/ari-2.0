
import React from 'react';
import type { ModelMode } from '../types';

interface ModeSelectorProps {
    currentMode: ModelMode;
    onModeChange: (mode: ModelMode) => void;
}

const modes: { id: ModelMode; name: string; description: string }[] = [
    { id: 'flash', name: 'Flash', description: 'Quick, spontaneous responses.' },
    { id: 'thinking', name: 'Thinking', description: 'Deep, autonomous reasoning.' },
];

const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onModeChange }) => {
    return (
        <div className="flex items-center space-x-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
            {modes.map(mode => (
                <button
                    key={mode.id}
                    onClick={() => onModeChange(mode.id)}
                    className={`
                        px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 uppercase tracking-wider
                        ${currentMode === mode.id 
                            ? 'bg-slate-700 text-white shadow-sm ring-1 ring-slate-600' 
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                        }
                    `}
                    title={mode.description}
                >
                   {mode.name}
                </button>
            ))}
        </div>
    );
};

export default ModeSelector;
