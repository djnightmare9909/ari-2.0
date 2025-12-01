
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { Icon } from './Icon';

interface LivePerceptionProps {
    onVoiceInput: (text: string, image?: { data: string; mimeType: string }) => void;
    onClose: () => void;
    stopAudio: () => void;
    isProcessing: boolean;
}

const LivePerception: React.FC<LivePerceptionProps> = ({ onVoiceInput, onClose, stopAudio, isProcessing }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [attentionState, setAttentionState] = useState<'focus' | 'distracted' | 'initializing'>('initializing');
    const [lastTranscript, setLastTranscript] = useState<string>('');
    const recognitionRef = useRef<any>(null);
    const landmarkerRef = useRef<FaceLandmarker | null>(null);
    const attentionRef = useRef<'focus' | 'distracted'>('distracted'); // Ref for immediate access in event loops
    const requestRef = useRef<number>(0);
    const isMountedRef = useRef<boolean>(true); // Track if component is mounted

    // Refs for callbacks to prevent stale closures in event listeners
    const onVoiceInputRef = useRef(onVoiceInput);
    const stopAudioRef = useRef(stopAudio);

    useEffect(() => {
        onVoiceInputRef.current = onVoiceInput;
    }, [onVoiceInput]);

    useEffect(() => {
        stopAudioRef.current = stopAudio;
    }, [stopAudio]);

    // 1. Initialize Vision (MediaPipe)
    useEffect(() => {
        isMountedRef.current = true;

        const initVision = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );
                // Check mount status after async load
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
                    startCamera();
                }
            } catch (error) {
                console.error("Failed to init vision:", error);
            }
        };
        initVision();

        return () => {
            isMountedRef.current = false; // Mark component as unmounted

            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
                tracks.forEach(t => t.stop());
            }
            if (recognitionRef.current) {
                // Prevent the onend handler from restarting the service
                recognitionRef.current.onend = null;
                // Abort forces an immediate stop without returning final results
                recognitionRef.current.abort();
            }
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, []);

    // 2. Start Camera & Speech
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false }); // Audio handled by SpeechRec
            if (!isMountedRef.current) {
                // If unmounted during await, stop tracks immediately
                stream.getTracks().forEach(t => t.stop());
                return;
            }
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener("loadeddata", predictWebcam);
            }
            startSpeechRecognition();
        } catch (err) {
            console.error("Camera error:", err);
        }
    };

    // Helper: Capture current video frame
    const captureFrame = (): { data: string; mimeType: string } | undefined => {
        if (!videoRef.current) return undefined;
        const video = videoRef.current;
        
        // Create an offscreen canvas to capture the frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;
        
        // Draw the image unmirrored so the AI can read text/see correctly
        ctx.drawImage(video, 0, 0);
        
        // Convert to base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const data = dataUrl.split(',')[1];
        
        return { data, mimeType: 'image/jpeg' };
    };

    // 3. Vision Loop
    const predictWebcam = async () => {
        if (!landmarkerRef.current || !videoRef.current || !isMountedRef.current) return;
        
        const startTimeMs = performance.now();
        if (videoRef.current.currentTime > 0) {
            const result = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
            
            if (result.faceLandmarks && result.faceLandmarks.length > 0) {
                const landmarks = result.faceLandmarks[0];
                // Heuristic for "Looking at Camera":
                // Nose tip: index 1
                // Left Ear (tragion): 454
                // Right Ear (tragion): 234
                const nose = landmarks[1];
                const leftEar = landmarks[454];
                const rightEar = landmarks[234];

                // Calculate midpoint of ears
                const earMidpointX = (leftEar.x + rightEar.x) / 2;
                
                // Calculate deviance of nose from center relative to face width
                const faceWidth = Math.abs(leftEar.x - rightEar.x);
                const noseDeviance = Math.abs(nose.x - earMidpointX);
                
                // Threshold: If nose is within 15% of face width from the center, we are looking forward
                const isLooking = noseDeviance < (faceWidth * 0.25);
                
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

    // 4. Speech Recognition Logic
    const startSpeechRecognition = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        // INTERRUPTION LOGIC: If the user starts talking, silence the AI.
        recognition.onspeechstart = () => {
            if (stopAudioRef.current) stopAudioRef.current();
        };

        recognition.onresult = (event: any) => {
            const current = event.resultIndex;
            const transcript = event.results[current][0].transcript;
            const isFinal = event.results[current].isFinal;

            if (isFinal) {
                // THE GATE: Only process if looking at the camera
                if (attentionRef.current === 'focus') {
                    if (stopAudioRef.current) stopAudioRef.current(); // Ensure silence before processing
                    setLastTranscript(transcript);
                    
                    // Capture visual context
                    const image = captureFrame();
                    
                    // Send to brain
                    if (onVoiceInputRef.current) {
                        onVoiceInputRef.current(transcript, image);
                    }
                } else {
                    console.log("Ignored speech (looking away):", transcript);
                }
            }
        };

        recognition.onend = () => {
            // CRITICAL: Only restart if the component is still mounted.
            if (!isMountedRef.current) return;

            // Auto restart for "always listening"
             try {
                recognition.start();
            } catch (e) {
                // Already started or other minor error
            }
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
        } catch (e) {
            console.error("Speech recognition start failed", e);
        }
    };

    const borderColor = attentionState === 'focus' 
        ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]' 
        : 'border-rose-900/50 grayscale opacity-70';

    const statusText = attentionState === 'initializing' ? 'Initializing Sensors...' :
                       attentionState === 'focus' ? 'VISUAL CONTACT ESTABLISHED' : 
                       'VISUAL CONTACT LOST';

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
            <div className={`relative w-64 h-48 bg-black rounded-lg overflow-hidden border-2 transition-all duration-300 ${borderColor}`}>
                <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100" // Mirror effect for user UI, but logic uses raw
                />
                
                {/* HUD Overlay */}
                <div className="absolute inset-0 pointer-events-none p-2 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-0.5">
                            <span className={`text-[10px] font-mono font-bold tracking-widest ${attentionState === 'focus' ? 'text-emerald-500' : 'text-rose-700'}`}>
                                {attentionState === 'focus' ? 'REC ●' : 'STBY'}
                            </span>
                             <span className="text-[9px] font-mono text-slate-400 uppercase">
                                {statusText}
                            </span>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="p-1 bg-black/50 text-white rounded hover:bg-rose-600 transition-colors pointer-events-auto"
                        >
                            <Icon name="close" className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Reticle */}
                    {attentionState === 'focus' && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-emerald-500/30 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        </div>
                    )}

                    <div className="w-full bg-black/60 backdrop-blur-sm p-1.5 rounded border border-slate-800">
                        <p className="text-xs text-slate-300 font-mono min-h-[1.5em] truncate">
                            {isProcessing ? "Processing..." : `> ${lastTranscript}`}
                        </p>
                    </div>
                </div>
                
                {/* Scanlines Effect */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_2px,3px_100%] pointer-events-none"></div>
            </div>
        </div>
    );
};

export default LivePerception;
