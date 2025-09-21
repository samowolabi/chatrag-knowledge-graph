import OpenAI from 'openai';
import dotenv from 'dotenv';
import { config } from '../config/environment';

// Load environment variables first
dotenv.config();

export interface CompletionOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    responseFormat?: 'text' | 'json_object' | 'json_schema';
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}


class OpenAIService {
    private client: OpenAI;

    constructor() {
        const apiKey = config.openai.apiKey;
        if (!apiKey) { throw new Error('OpenAI API key not found in environment variables'); }
        this.client = new OpenAI({ apiKey });
    }

    async initialize(): Promise<boolean> {
        try {
            console.log('🤖 Initializing OpenAI connection...');
            // Test connection with a simple completion
            await this.client.models.list();
            console.log('✅ OpenAI connected successfully');
            return true;
        } catch (error) {
            console.error('❌ OpenAI connection failed:', error);
            throw new Error(`OpenAI initialization failed: ${error}`);
        }
    }

    async chatCompletion(
        messages: ChatMessage[],
        options: CompletionOptions = {}
    ): Promise<string> {
        try {
            const {
                model = config.openai.model,
                temperature = 0.7,
                maxTokens = 1000
            } = options;

            const completion = await this.client.chat.completions.create({
                model,
                messages,
                temperature,
                max_tokens: maxTokens,
                response_format: { type: options.responseFormat || 'text' as any }
            });

            console.log('OpenAI chat completion response:', completion);

            return completion.choices[0].message.content || '';
        } catch (error) {
            throw new Error(`OpenAI chat completion failed: ${error}`);
        }
    }

    async embedText(text: string): Promise<number[]> {
        try {
            const response = await this.client.embeddings.create({
                model: 'text-embedding-3-small',
                input: text
            });

            return response.data[0].embedding;
        } catch (error) {
            throw new Error(`Text embedding failed: ${error}`);
        }
    }

    async embedTextsBatch(texts: string[]): Promise<number[][]> {
        try {
            if (texts.length === 0) {
                throw new Error('Input texts array is empty');
            }

            // OpenAI API supports batch embedding
            const response = await this.client.embeddings.create({
                model: 'text-embedding-3-small',
                input: texts
            });

            return response.data.map(item => item.embedding);
        } catch (error) {
            throw new Error(`Batch text embedding failed: ${error}`);
        }
    }


    getClient(): OpenAI {
        return this.client;
    }
}

export { OpenAIService };

// Lazy initialization to avoid env issues
let instance: OpenAIService | null = null;

export default {
    get instance() {
        if (!instance) {
            instance = new OpenAIService();
        }
        return instance;
    },
    async initialize() {
        return this.instance.initialize();
    },
    async chatCompletion(messages: ChatMessage[], options?: CompletionOptions) {
        return this.instance.chatCompletion(messages, options);
    },
    async embedText(text: string) {
        return this.instance.embedText(text);
    },
    async embedTextsBatch(texts: string[]) {
        return this.instance.embedTextsBatch(texts);
    },
    getClient() {
        return this.instance.getClient();
    }
};