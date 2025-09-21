import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export class LangChainService {
    private textSplitter: RecursiveCharacterTextSplitter;

    constructor() {
        this.textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
    }

    async splitText(text: string): Promise<{
        id: string;
        content: string;
        metadata: Record<string, any>;
    }[]> {
        try {
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                throw new Error('Input text must be a non-empty string');
            }

            // Use LangChain's text splitter
            const docs = await this.textSplitter.createDocuments([text]);
            return docs.map((doc, index) => ({
                id: `chunk-${index}`,
                content: doc.pageContent,
                metadata: doc.metadata
            }));
        } catch (error) {
            console.error('Error splitting text:', error);
            throw new Error(`Text splitting failed: ${error}`);
        }
    }
}

export default new LangChainService();