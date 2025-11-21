
// FIX: Changed GenerateContentRequest to GenerateContentParameters as it is deprecated.
import { GoogleGenAI, GenerateContentParameters, Content, Part, Modality } from "@google/genai";
import type { Message, ModelMode } from '../types';
import { WFGY_SYSTEM_INSTRUCTION } from '../constants';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const modelConfig: Record<ModelMode, { model: string; config?: any }> = {
    flash: { model: 'gemini-2.5-flash' },
    pro: { model: 'gemini-3-pro-preview', config: { thinkingConfig: { thinkingBudget: 32768 } } },
};

function formatMessagesForApi(messages: Message[]): Content[] {
    const history: Content[] = [];
    messages.forEach(msg => {
        const parts: Part[] = msg.parts.map(part => {
            if (part.image) {
                return {
                    inlineData: {
                        mimeType: part.image.mimeType,
                        data: part.image.data
                    }
                };
            }
            return { text: part.text || '' };
        }).filter(p => (p.text && p.text.trim() !== '') || 'inlineData' in p);
        
        if (parts.length > 0) {
            history.push({ role: msg.role, parts });
        }
    });

    // Merge consecutive user messages
    const mergedHistory: Content[] = [];
    let lastRole: string | null = null;
    for (const content of history) {
        if (lastRole === 'user' && content.role === 'user' && mergedHistory.length > 0) {
            mergedHistory[mergedHistory.length - 1].parts.push(...content.parts);
        } else {
            mergedHistory.push(content);
            lastRole = content.role;
        }
    }
    return mergedHistory;
}


export async function generateResponseStream(messages: Message[], mode: ModelMode) {
    const { model, config } = modelConfig[mode];
    const contents = formatMessagesForApi(messages);

    // FIX: Changed GenerateContentRequest to GenerateContentParameters as it is deprecated.
    const request: GenerateContentParameters = {
        model,
        contents,
        config: {
            ...config,
            systemInstruction: WFGY_SYSTEM_INSTRUCTION
        },
    };

    const result = await ai.models.generateContentStream(request);
    return result;
}

export async function textToSpeech(text: string): Promise<string> {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("No audio data received from API");
    }
    return base64Audio;
}
