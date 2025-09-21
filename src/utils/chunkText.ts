export interface TextChunk {
    id: string;
    content: string;
    index: number;
    startChar: number;
    endChar: number;
    tokens: number;
    metadata?: Record<string, any>;
}

export const chunkText = (text: string, chunkSize: number = 1000, overlap: number = 200): TextChunk[] => {
    try {
        const chunks: TextChunk[] = [];
        let startPos = 0;
        let index = 0;

        const estimateTokens = (text: string): number => {
            // Rough estimation: 1 token ≈ 4 characters for English text
            return Math.ceil(text.length / 4);
        };

        // Ensure overlap is not greater than chunkSize to prevent infinite loops
        const safeOverlap = Math.min(overlap, chunkSize - 1);

        // Safety check for text length
        if (text.length === 0) return chunks;

        // Limit maximum number of chunks to prevent memory issues
        const maxChunks = Math.ceil(text.length / (chunkSize - safeOverlap)) + 100; // Add buffer

        while (startPos < text.length && index < maxChunks) {
            const endPos = Math.min(startPos + chunkSize, text.length);
            const content = text.slice(startPos, endPos);

            // Skip empty chunks
            if (content.trim().length === 0) {
                startPos = endPos;
                continue;
            }

            chunks.push({
                id: `chunk-${index}`,
                content,
                index,
                startChar: startPos,
                endChar: endPos,
                tokens: estimateTokens(content)
            });

            // Calculate next start position with safe overlap
            const nextStart = endPos - safeOverlap;
            startPos = nextStart > startPos ? nextStart : endPos;

            index++;
        }

        return chunks;
    } catch (error) {
        console.error('Error chunking text:', error);
        return [];
    }
}