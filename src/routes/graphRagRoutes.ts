import { Router } from 'express';
const router = Router();

import { extractText, breakTextIntoChunks, generateEmbeddingsForChunkswithOpenAI, storeChunksAndEmbeddingsInGraph, extractDocumentNodesAndRelationshipsInGraph, storeExtractedNodesAndRelationshipsInGraph, processDocumentPipeline } from '../controllers/ingestDataController';

router.post('/extract-text', extractText);
router.post('/break-text', breakTextIntoChunks);
router.post('/embed-chunks-with-openai', generateEmbeddingsForChunkswithOpenAI);
router.post('/store-chunks-embeddings-graph', storeChunksAndEmbeddingsInGraph);
router.post('/extract-document-nodes-relationships-graph', extractDocumentNodesAndRelationshipsInGraph);
router.post('/store-extracted-nodes-relationships-graph', storeExtractedNodesAndRelationshipsInGraph);
router.post('/process-document-pipeline', processDocumentPipeline);

export default router;