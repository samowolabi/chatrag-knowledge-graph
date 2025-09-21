import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import graphRagRoutes from './routes/graphRagRoutes';
import queryRoutes from './routes/queryRoutes';
import neo4jService from './services/neo4jService';
import openaiService from './services/openaiService';
import { config } from './config/environment';

dotenv.config();

const app = express();
const PORT = config.server.port;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'ChatRAG App API with Nodemon', 
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// GraphRAG Routes
app.use('/ingest', graphRagRoutes);

// Query Routes  
app.use('/query', queryRoutes);

const startServer = async () => {
  try {
    // Initialize OpenAI service
    await openaiService.initialize();
    
    // Skip Neo4j for now to test other services
    await neo4jService.initialize();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
