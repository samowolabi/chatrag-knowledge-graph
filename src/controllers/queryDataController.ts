import { Request, Response } from 'express';
import textParser from '../services/textExtractor';
import langchainService from '../services/langchainService';
import openaiService from '../services/openaiService';
import graphService from '../services/graphService';

// Semantic search using embeddings
export const semanticSearch = async (req: Request, res: Response): Promise<void> => {
    try {
        const { query, limit = 10 } = req.body;

        if (!query || typeof query !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Query string is required'
            });
            return;
        }

        // Step 1: Generate embedding for user query
        const queryEmbedding = await openaiService.embedText(query);

        // Step 2: Perform vector similarity search in Neo4j
        const results = await graphService.semanticSearchChunks(queryEmbedding, limit);

        // Step 3: Return ranked relevant chunks
        res.status(200).json({
            success: true,
            data: {
                query,
                results,
                count: results.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};



// RAG Query - Retrieval-Augmented Generation
export const ragQuery = async (req: Request, res: Response): Promise<void> => {
    try {
        const { query, limit = 5, includeContext = true } = req.body;

        if (!query || typeof query !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Query string is required'
            });
            return;
        }

        // Step 1: Perform semantic search to get relevant chunks
        const queryEmbedding = await openaiService.embedText(query);
        const relevantChunks = await graphService.semanticSearchChunks(queryEmbedding, limit);

        if (relevantChunks.length === 0) {
            res.status(200).json({
                success: true,
                data: {
                    query,
                    answer: "I couldn't find any relevant information to answer your question.",
                    sources: [],
                    context: []
                }
            });
            return;
        }

        // Step 2: Build context from retrieved chunks
        const context = relevantChunks
            .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
            .join('\n\n');

        // Step 3: Generate response using OpenAI with retrieved context
        const systemPrompt = `You are a helpful AI assistant that answers questions based on the provided context. 
        Use the context below to answer the user's question accurately and concisely.
        If the context doesn't contain enough information to answer the question, say so.
        Always cite the source numbers [1], [2], etc. when referencing information from the context.`;

        const userPrompt = `Context: ${context}
            Question: ${query}
            Please provide a comprehensive answer based on the context above.`;

        const answer = await openaiService.chatCompletion([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], { temperature: 0.3, maxTokens: 500, responseFormat: 'text' });


        // Step 4: Return the generated answer with sources
        res.status(200).json({
            success: true,
            data: {
                query,
                answer,
                sources: relevantChunks.map((chunk, index) => ({
                    id: chunk.id,
                    content: chunk.content.substring(0, 200) + '...',
                    similarity: chunk.similarity,
                    sourceNumber: index + 1
                })),
                context: includeContext ? relevantChunks : undefined,
                metadata: {
                    chunksRetrieved: relevantChunks.length,
                    avgSimilarity: relevantChunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / relevantChunks.length
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}