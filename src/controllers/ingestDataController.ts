import { Request, Response } from 'express';
import textParser from '../services/textExtractor';
import langchainService from '../services/langchainService';
import openaiService from '../services/openaiService';
import graphService from '../services/graphService';


export const extractText = async (req: Request, res: Response): Promise<void> => {
    try {
        const { filePath, type } = req.body;
        const document = await textParser.parseDocument(filePath, type);

        res.status(200).json({
            success: true,
            data: document // { id: string; title: string; content: string; type: string; metadata: Record<string, any> }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

export const breakTextIntoChunks = async (req: Request<{}, {}, { text: string }>, res: Response): Promise<void> => {
    try {
        const { text } = req.body;
        const chunks = await langchainService.splitText(text);

        res.status(200).json({
            success: true,
            data: chunks // { id: string; content: string; metadata: Record<string, any> }[]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}


// Generate Embeddings for Chunks
export const generateEmbeddingsForChunkswithOpenAI = async (req: Request, res: Response): Promise<void> => {
    try {
        const { chunks } = req.body;

        if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
            res.status(400).json({ error: 'chunks array required' });
            return;
        }

        // Validate chunk structure
        for (const chunk of chunks) {
            if (!chunk.id || !chunk.content) {
                res.status(400).json({ error: 'Invalid chunk structure, each chunk must have id and content' });
                return;
            }
        }

        // Use openaiService.embedTextsBatch
        const texts = chunks.map((chunk: any) => chunk.content);
        const embeddings = await openaiService.embedTextsBatch(texts);

        res.status(200).json({
            success: true,
            data: {
                chunksLength: chunks.length,
                chunksWithEmbeddings: chunks.map((chunk: any, index: number) => ({
                    id: chunk.id,
                    content: chunk.content,
                    embedding: embeddings[index],
                    embeddingLength: embeddings[index].length
                }))
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}


// Store Batch Chunks and Embeddings in Graph, chunks: { id: string; content: string; embedding: number[] }[]
export const storeChunksAndEmbeddingsInGraph = async (req: Request, res: Response): Promise<void> => {
    try {
        const { chunks } = req.body;
        await graphService.storeBatchChunksWithEmbeddings(chunks);

        res.json({
            success: true,
            message: `Stored ${chunks.length} chunks and embeddings in graph`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}



// Extract Document Nodes and Relationships in Graph
export const extractDocumentNodesAndRelationshipsInGraph = async (req: Request, res: Response): Promise<void> => {
    try {
        const { chunks } = req.body;
        const { nodes, relationships } = await graphService.extractEntitiesAndRelationshipsFromText(chunks);

        res.status(200).json({
            success: true,
            data: {
                nodes,
                relationships
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}


// Store Extracted Nodes and Relationships in Graph
export const storeExtractedNodesAndRelationshipsInGraph = async (req: Request, res: Response): Promise<void> => {
    try {
        const { nodes, relationships } = req.body;
        await graphService.storeExtractedNodesAndRelationships(nodes, relationships);

        res.json({
            success: true,
            message: `Stored ${nodes.length} nodes and ${relationships.length} relationships in graph`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}


// Full Pipeline Implementation
export const processDocumentPipeline = async (req: Request, res: Response): Promise<void> => {
    try {
        const { filePath, type } = req.body;

        // Step 1: Extract Text
        const document = await textParser.parseDocument(filePath, type);

        // Step 2: Break Text into Chunks
        const chunks = await langchainService.splitText(document.content);

        // Step 3: Generate Embeddings for Chunks
        const texts = chunks.map((chunk: any) => chunk.content);
        const embeddings = await openaiService.embedTextsBatch(texts);
        const chunksWithEmbeddings = chunks.map((chunk: any, index: number) => ({
            id: chunk.id,
            content: chunk.content,
            embedding: embeddings[index]
        }));

        // Step 4: Store Chunks and Embeddings in Graph
        await graphService.storeBatchChunksWithEmbeddings(chunksWithEmbeddings);

        // Step 5: Extract Document Nodes and Relationships
        const { nodes, relationships } = await graphService.extractEntitiesAndRelationshipsFromText(chunks);

        // Step 6: Store Extracted Nodes and Relationships in Graph
        await graphService.storeExtractedNodesAndRelationships(nodes, relationships);

        res.status(200).json({
            success: true,
            message: 'Document Ingestion completed successfully',
            data: {
                document,
                chunks: chunksWithEmbeddings,
                nodes,
                relationships
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Document Ingestion failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}