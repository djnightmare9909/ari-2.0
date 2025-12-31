
import { GoogleGenAI, Modality } from "@google/genai";
import type { Message, ModelMode } from '../types';
import { WFGY_SYSTEM_INSTRUCTION } from '../constants';

const modelConfig: Record<ModelMode, { model: string; config?: any }> = {
    flash: { 
        model: 'gemini-3-flash-preview' 
    },
    thinking: { 
        model: 'gemini-3-pro-preview', 
        config: { 
            thinkingConfig: { thinkingBudget: 32768 } 
        } 
    },
};

function formatMessagesForApi(messages: Message[]) {
    const history: any[] = [];
    messages.forEach(msg => {
        const parts = msg.parts.map(part => {
            if (part.image) {
                return {
                    inlineData: {
                        mimeType: part.image.mimeType,
                        data: part.image.data
                    }
                };
            }
            return { text: part.text || "" };
        }).filter(p => (p.text && p.text.trim() !== '') || (p.inlineData));
        
        if (parts.length > 0) {
            history.push({ role: msg.role, parts });
        }
    });

    const mergedHistory: any[] = [];
    let lastRole: string | null = null;
    for (const content of history) {
        if (lastRole === content.role && mergedHistory.length > 0) {
            mergedHistory[mergedHistory.length - 1].parts.push(...content.parts);
        } else {
            mergedHistory.push(content);
            lastRole = content.role;
        }
    }
    return mergedHistory;
}


export async function generateResponseStream(messages: Message[], mode: ModelMode) {
    // Initializing inside the function to ensure we always have the freshest process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const { model, config } = modelConfig[mode];
    const contents = formatMessagesForApi(messages);

    return await ai.models.generateContentStream({
        model,
        contents,
        config: {
            ...config,
            systemInstruction: WFGY_SYSTEM_INSTRUCTION,
            temperature: 1.0,
            topP: 0.95,
        },
    });
}

export async function textToSpeech(text: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Speak in a natural, warm, and slightly curious tone: ${text}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("No audio data received from API");
    }
    return base64Audio;
}
