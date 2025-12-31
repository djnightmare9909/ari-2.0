
import { useState, useCallback, useRef } from 'react';
import { textToSpeech } from '../services/geminiService';

const decode = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
};


export const useTTS = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);

    const speak = useCallback(async (text: string) => {
        if (!text) return;

        if (isPlaying && sourceRef.current) {
            sourceRef.current.stop();
            setIsPlaying(false);
            return;
        }

        setIsLoading(true);
        try {
            const base64Audio = await textToSpeech(text);
            
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            const audioContext = audioContextRef.current;
            await audioContext.resume();

            const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            
            source.onended = () => {
                setIsPlaying(false);
                sourceRef.current = null;
            };

            source.start();
            sourceRef.current = source;
            setIsPlaying(true);
        } catch (error) {
            console.error('TTS Error:', error);
            setIsPlaying(false);
        } finally {
            setIsLoading(false);
        }
    }, [isPlaying]);

    return { speak, isLoading, isPlaying };
};
