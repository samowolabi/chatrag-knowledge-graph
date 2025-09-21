import { Router } from 'express';
const router = Router();

import { semanticSearch, ragQuery } from '../controllers/queryDataController';

// Semantic search endpoint
router.post('/semantic', semanticSearch);

// RAG query endpoint
router.post('/rag', ragQuery);

export default router;