
import { useState, useCallback, useEffect, useRef } from 'react';

export const useTTS = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const synth = window.speechSynthesis;
    // We keep track of the utterance to bind events correctly
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Initial voice loading (Chrome needs onvoiceschanged)
    useEffect(() => {
        const loadVoices = () => {
            synth.getVoices();
        };
        loadVoices();
        if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = loadVoices;
        }
        
        return () => {
            if (synth.speaking) {
                synth.cancel();
            }
        };
    }, [synth]);

    const cancel = useCallback(() => {
        if (synth.speaking) {
            synth.cancel();
        }
        setIsPlaying(false);
    }, [synth]);

    const speak = useCallback((text: string) => {
        // Stop any current speech immediately
        cancel();

        if (!text) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        // Voice selection logic
        const voices = synth.getVoices();
        // Prefer natural sounding English voices
        const preferredVoice = voices.find(v => 
            (v.name.includes('Google US English') || 
             v.name.includes('Samantha') || 
             v.name.includes('Natural')) && 
            v.lang.startsWith('en')
        ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        // Make it slightly faster for that "fast & lightweight" feel
        utterance.rate = 1.1; 
        utterance.pitch = 1.0;

        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => {
            setIsPlaying(false);
            utteranceRef.current = null;
        };
        utterance.onerror = (e) => {
            console.error("TTS Error:", e);
            setIsPlaying(false);
            utteranceRef.current = null;
        };

        synth.speak(utterance);
    }, [synth, cancel]);

    return { speak, cancel, isPlaying, isLoading: false };
};
