
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { LiveSession, Modality, LiveServerMessage } from "@google/genai";
import { Icon } from './Icon';
import { ai } from '../services/geminiService';
import { WFGY_SYSTEM_INSTRUCTION } from '../constants';
import { 
    AUDIO_INPUT_SAMPLE_RATE, 
    AUDIO_OUTPUT_SAMPLE_RATE, 
    base64ToFloat32Array, 
    float32ArrayToBase64, 
    downsampleBuffer 
} from '../utils/audioUtils';

interface LivePerceptionProps {
    onClose: () => void;
    // Callback to append completed turns to the chat history
    onInteractionComplete: (userText: string, modelText: string) => void;
}

const LivePerception: React.FC<LivePerceptionProps> = ({ onClose, onInteractionComplete }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // UI State
    const [attentionState, setAttentionState] = useState<'focus' | 'distracted' | 'initializing'>('initializing');
    const [status, setStatus] = useState<string>('Initializing...');
    const [userTranscript, setUserTranscript] = useState<string>('');
    const [modelTranscript, setModelTranscript] = useState<string>('');
    const [volume, setVolume] = useState<number>(0);
    const [isConnected, setIsConnected] = useState(false);

    // Vision Refs
    const landmarkerRef = useRef<FaceLandmarker | null>(null);
    const attentionRef = useRef<'focus' | 'distracted'>('distracted');
    const requestRef = useRef<number>(0);

    // Audio Refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const audioQueueRef = useRef<Float32Array[]>([]);
    const isPlayingRef = useRef<boolean>(false);
    const nextStartTimeRef = useRef<number>(0);
    const gainNodeRef = useRef<GainNode | null>(null);

    // Live API Session
    const sessionRef = useRef<LiveSession | null>(null);
    const isMountedRef = useRef<boolean>(true);
    
    // Transcription Accumulators (for history syncing)
    const currentTurnUser = useRef<string>('');
    const currentTurnModel = useRef<string>('');

    // --- 1. Vision Setup (MediaPipe) ---
    useEffect(() => {
        const initVision = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );
                if (!isMountedRef.current) return;

                landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU"
                    },
                    outputFaceBlendshapes: true,
                    runningMode: "VIDEO",
                    numFaces: 1
                });
                if (isMountedRef.current) {
                    startMedia();
                }
            } catch (error) {
                console.error("Failed to init vision:", error);
                setStatus("Vision Init Failed");
            }
        };
        initVision();

        return () => {
            isMountedRef.current = false;
            cleanup();
        };
    }, []);

    // --- 2. Live API Connection ---
    const connectLiveApi = async () => {
        try {
            setStatus("Connecting to Ari...");
            const session = await ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                    },
                    systemInstruction: WFGY_SYSTEM_INSTRUCTION + 
                    "\n\n[CRITICAL LIVE MODE INSTRUCTION]: You are perceiving the user via real-time video and audio. " +
                    "1. The video feed is your EYES. The audio is your EARS. " +
                    "2. Do NOT describe the user or the room unless asked. " +
                    "3. Respond naturally and concisely. " + 
                    "4. If the user looks away, they might not be talking to you, but you can still see them.",
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        console.log("Live API Connected");
                        setIsConnected(true);
                        setStatus("Connected: Online");
                    },
                    onmessage: (msg: LiveServerMessage) => {
                        handleServerMessage(msg);
                    },
                    onclose: () => {
                        console.log("Live API Closed");
                        setIsConnected(false);
                        setStatus("Disconnected");
                    },
                    onerror: (e) => {
                        console.error("Live API Error", e);
                        setStatus("Connection Error");
                    }
                }
            });
            sessionRef.current = session;
        } catch (e) {
            console.error("Connection failed", e);
            setStatus("Connection Failed");
        }
    };

    const handleServerMessage = (msg: LiveServerMessage) => {
        const content = msg.serverContent;
        if (!content) return;

        // 1. Audio Output
        const modelTurn = content.modelTurn;
        if (modelTurn) {
            const parts = modelTurn.parts;
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    const audioF32 = base64ToFloat32Array(part.inlineData.data);
                    queueAudio(audioF32);
                }
            }
        }

        // 2. Transcription Handling
        if (content.modelTurn?.parts?.[0]?.text) {
             // Sometimes text comes directly (rare in audio mode)
        }

        // Real-time transcript updates
        if (content.outputTranscription) {
            const text = content.outputTranscription.text;
            currentTurnModel.current += text;
            setModelTranscript(prev => prev + text);
        }
        if (content.inputTranscription) {
            const text = content.inputTranscription.text;
            currentTurnUser.current += text;
            setUserTranscript(prev => prev + text);
        }

        // 3. Turn Completion (Sync to History)
        if (content.turnComplete) {
            if (currentTurnUser.current.trim() || currentTurnModel.current.trim()) {
                onInteractionComplete(currentTurnUser.current, currentTurnModel.current);
                // Clear buffers for next turn
                currentTurnUser.current = '';
                currentTurnModel.current = '';
                // Clear UI transcript after a delay for readability
                setTimeout(() => {
                    if (isMountedRef.current) {
                        setUserTranscript('');
                        setModelTranscript('');
                    }
                }, 3000);
            }
        }

        // 4. Interruption
        if (content.interrupted) {
            console.log("Model interrupted");
            clearAudioQueue();
            currentTurnModel.current = ''; 
            setModelTranscript('');
        }
    };

    // --- 3. Media Capture & streaming ---
    const startMedia = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 360 }, 
                audio: {
                    sampleRate: AUDIO_INPUT_SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    autoGainControl: true,
                    noiseSuppression: true
                } 
            });

            // Video Setup
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener("loadeddata", () => {
                    predictWebcam();
                    startVideoStreaming(); // Start sending frames
                });
            }

            // Audio Setup
            audioContextRef.current = new AudioContext({ sampleRate: AUDIO_OUTPUT_SAMPLE_RATE });
            await audioContextRef.current.resume();
            
            const source = audioContextRef.current.createMediaStreamSource(stream);
            inputSourceRef.current = source;
            
            // ScriptProcessor for raw PCM access (bufferSize, inputChannels, outputChannels)
            const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (!sessionRef.current || !isConnected) return;
                
                const inputData = e.inputBuffer.getChannelData(0);
                
                // --- SOCIAL GATING ---
                // Only send audio if looking at Ari OR if Ari is currently speaking (to allow interruption)
                // Actually, for "Living" feel, usually we send all audio, but the user requested gating.
                // We'll enforce gating: Only listen when looking.
                
                // Calc Volume for UI
                let sum = 0;
                for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                const rms = Math.sqrt(sum / inputData.length);
                setVolume(Math.min(rms * 5, 1)); // Scale for UI

                if (attentionRef.current === 'focus') {
                     // Resample if needed (though we requested 16k, browser might ignore)
                    const downsampled = downsampleBuffer(inputData, audioContextRef.current!.sampleRate, AUDIO_INPUT_SAMPLE_RATE);
                    const base64Audio = float32ArrayToBase64(downsampled);
                    
                    sessionRef.current.sendRealtimeInput({
                        media: {
                            mimeType: 'audio/pcm;rate=16000',
                            data: base64Audio
                        },
                        endOfTurn: false // Streaming
                    });
                }
            };

            source.connect(processor);
            processor.connect(audioContextRef.current.destination); // Connect to dest to keep processor alive
            
            // Connect to Live API after media is ready
            connectLiveApi();

        } catch (err) {
            console.error("Media error:", err);
            setStatus("Media Access Denied");
        }
    };

    // --- 4. Video Streaming Loop ---
    const startVideoStreaming = () => {
        // Send a frame every 500ms (2 FPS) to save bandwidth but keep context
        const intervalId = window.setInterval(() => {
            if (!sessionRef.current || !isConnected || !videoRef.current) return;
            
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth * 0.5; // Scale down for speed
            canvas.height = videoRef.current.videoHeight * 0.5;
            const ctx = canvas.getContext('2d');
            if(ctx) {
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                
                sessionRef.current.sendRealtimeInput({
                    media: {
                        mimeType: 'image/jpeg',
                        data: base64
                    }
                });
            }
        }, 500); 

        // Store interval for cleanup? 
        // We'll clean up by checking isMountedRef in the loop logic or clearing in cleanup()
        // Ideally use a ref for the interval ID.
        (window as any).videoInterval = intervalId; 
    };

    // --- 5. Audio Playback Logic ---
    const queueAudio = (buffer: Float32Array) => {
        audioQueueRef.current.push(buffer);
        if (!isPlayingRef.current) {
            playNextChunk();
        }
    };

    const playNextChunk = () => {
        if (audioQueueRef.current.length === 0 || !audioContextRef.current) {
            isPlayingRef.current = false;
            return;
        }

        isPlayingRef.current = true;
        const audioData = audioQueueRef.current.shift()!;
        
        const audioBuffer = audioContextRef.current.createBuffer(1, audioData.length, AUDIO_OUTPUT_SAMPLE_RATE);
        audioBuffer.getChannelData(0).set(audioData);

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);

        // Schedule playback
        const currentTime = audioContextRef.current.currentTime;
        // Ensure we don't schedule in the past
        const startTime = Math.max(currentTime, nextStartTimeRef.current);
        source.start(startTime);
        
        nextStartTimeRef.current = startTime + audioBuffer.duration;

        source.onended = () => {
            playNextChunk();
        };
    };

    const clearAudioQueue = () => {
        audioQueueRef.current = [];
        isPlayingRef.current = false;
        // We can't easily stop currently playing nodes without keeping track of them all,
        // but resetting nextStartTime helps prevent overlap.
        if (audioContextRef.current) {
            nextStartTimeRef.current = audioContextRef.current.currentTime;
        }
    };

    // --- 6. Vision Logic (FaceLandmarker) ---
    const predictWebcam = async () => {
        if (!landmarkerRef.current || !videoRef.current || !isMountedRef.current) return;
        
        const startTimeMs = performance.now();
        if (videoRef.current.currentTime > 0) {
            const result = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
            
            if (result.faceLandmarks && result.faceLandmarks.length > 0) {
                const landmarks = result.faceLandmarks[0];
                const nose = landmarks[1];
                const leftEar = landmarks[454];
                const rightEar = landmarks[234];
                const earMidpointX = (leftEar.x + rightEar.x) / 2;
                const faceWidth = Math.abs(leftEar.x - rightEar.x);
                const noseDeviance = Math.abs(nose.x - earMidpointX);
                
                // Relaxed Threshold: 30% of face width
                const isLooking = noseDeviance < (faceWidth * 0.30);
                
                const newState = isLooking ? 'focus' : 'distracted';
                setAttentionState(newState);
                attentionRef.current = newState;
            } else {
                setAttentionState('distracted');
                attentionRef.current = 'distracted';
            }
        }
        if (isMountedRef.current) {
            requestRef.current = requestAnimationFrame(predictWebcam);
        }
    };

    const cleanup = () => {
        if ((window as any).videoInterval) clearInterval((window as any).videoInterval);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current.onaudioprocess = null;
        }
        if (inputSourceRef.current) inputSourceRef.current.disconnect();
        if (audioContextRef.current) audioContextRef.current.close();
        if (videoRef.current && videoRef.current.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        }
        if (sessionRef.current) {
            // LiveSession doesn't have a close method exposed in SDK types explicitly in some versions,
            // but we drop the ref. The server will timeout.
            sessionRef.current = null;
        }
    };

    // --- UI Render ---
    const borderColor = attentionState === 'focus' 
        ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]' 
        : 'border-rose-900/50 grayscale opacity-70';

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
            <div className={`relative w-72 h-56 bg-black rounded-lg overflow-hidden border-2 transition-all duration-300 ${borderColor}`}>
                <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100" 
                />
                
                <div className="absolute inset-0 pointer-events-none p-2 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-0.5">
                            <span className={`text-[10px] font-mono font-bold tracking-widest ${attentionState === 'focus' ? 'text-emerald-500' : 'text-rose-700'}`}>
                                {attentionState === 'focus' ? 'LINKED ●' : 'STANDBY'}
                            </span>
                             <span className="text-[9px] font-mono text-slate-400 uppercase">
                                {status}
                            </span>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="p-1 bg-black/50 text-white rounded hover:bg-rose-600 transition-colors pointer-events-auto"
                        >
                            <Icon name="close" className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Audio Visualizer Bar */}
                    <div className="flex items-center gap-1 h-1 w-full mt-1 opacity-80">
                         <div 
                            className={`h-full transition-all duration-75 ${attentionState === 'focus' ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                            style={{ width: `${volume * 100}%` }}
                         />
                    </div>

                    {/* Captions */}
                    <div className="flex flex-col gap-1 mt-auto">
                        {userTranscript && (
                            <div className="self-end bg-blue-900/80 p-1 rounded text-[10px] text-blue-100 max-w-[90%]">
                                {userTranscript}
                            </div>
                        )}
                        {modelTranscript && (
                             <div className="self-start bg-emerald-900/80 p-1 rounded text-[10px] text-emerald-100 max-w-[90%]">
                                {modelTranscript}
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_2px,3px_100%] pointer-events-none"></div>
            </div>
        </div>
    );
};

export default LivePerception;
