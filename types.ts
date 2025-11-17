
export type MessageRole = 'user' | 'model';

export type ModelMode = 'flash' | 'pro';

export interface MessagePart {
    text?: string;
    image?: {
        data: string;
        mimeType: string;
    };
}

export interface Message {
    id: string;
    role: MessageRole;
    parts: MessagePart[];
    createdAt: Date;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    createdAt: Date;
    mode: ModelMode;
}