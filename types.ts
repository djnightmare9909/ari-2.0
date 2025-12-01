
export type MessageRole = 'user' | 'model';

export type ModelMode = 'flash' | 'thinking';

export interface FileData {
    data: string;
    mimeType: string;
    name?: string;
}

export interface MessagePart {
    text?: string;
    file?: FileData;
    // If true, this part is for the model's eyes only and won't be rendered in the UI bubble
    isInternal?: boolean;
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
