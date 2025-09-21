import neo4jService from './neo4jService';
import openaiService from './openaiService';
import { jsonToObject } from '../utils/jsonToObjectParser';

export interface GraphEntity {
    id: string;
    name: string;
    type: string;
    description: string;
    properties: Record<string, any>;
}

export interface GraphRelationship {
    id: string;
    source: string;
    target: string;
    type: string;
    description: string;
    properties: Record<string, any>;
}

export interface GraphDocument {
    id: string;
    title: string;
    content: string;
    chunks: any[];
    entities: GraphEntity[];
    relationships: GraphRelationship[];
}

export class GraphService {

    async storeBatchChunksWithEmbeddings(chunks: { id: string; content: string; embedding: number[] }[]): Promise<void> {
        try {
            // Validate input
            if (!Array.isArray(chunks)) {
                throw new Error('Chunks must be an array');
            }

            // Validate each chunk structure
            for (const chunk of chunks) {
                if (!chunk.id || !chunk.content || !Array.isArray(chunk.embedding)) {
                    throw new Error('Each chunk must have id, content, and embedding');
                }
            }

            const promises = chunks.map(async (chunk) => {
                const query = `
                    CREATE (c:Chunk {
                    id: $chunkId,
                    content: $content,
                    embedding: $embedding
                    })
                `;

                return neo4jService.executeQuery(query, {
                    chunkId: chunk.id,
                    content: chunk.content,
                    embedding: chunk.embedding
                });
            });

            await Promise.all(promises);
        } catch (error) {
            console.error('Error storing chunks with embeddings:', error);
            throw new Error(`Storing chunks with embeddings failed: ${error}`);
        }
    }


    async extractEntitiesAndRelationshipsFromText(chunks: { id: string; content: string; }[]): Promise<{ nodes: GraphEntity[]; relationships: GraphRelationship[]; }> {
        try {
            // Validate input
            if (!Array.isArray(chunks)) {
                throw new Error('Chunks must be an array');
            }

            // Validate each chunk structure
            for (const chunk of chunks) {
                if (!chunk.id || !chunk.content) {
                    throw new Error('Each chunk must have id and content');
                }
            }

            const combinedText = chunks.map(c => c.content).join('\n\n');
            const prompt = `
                Extract entities and relationships from the text below.
                Return direct valid JSON that can be extracted like this (const { nodes, relationships } = output) in this format:
                {
                "nodes": [
                    {"id": "string", "name": "string", "type": "string", "description": "string", "properties": {"key": "value"}}
                ],
                "relationships": [
                    {"id": "string", "source": "string", "target": "string", "type": "string", "description": "string", "properties": {"key": "value"}}
                ]
                }

                Text: """${combinedText}"""
            `;

            const response = await openaiService.chatCompletion([
                { role: 'system', content: 'You are an expert at extracting entities and relationships from text.' },
                { role: 'user', content: prompt }
            ], { temperature: 0, maxTokens: 1500, responseFormat: 'json_object' });

            // Attempt to parse the response as JSON
            let parsed;
            try {
                parsed = JSON.parse(response);
            } catch (jsonError) {
                throw new Error(`Failed to parse JSON from OpenAI response: ${jsonError}`);
            }

            const { nodes, relationships } = parsed;

            if (!Array.isArray(nodes) || !Array.isArray(relationships)) {
                throw new Error('Invalid data format from OpenAI response');
            }

            console.log('Extracted nodes and relationships:', { nodes, relationships });

            // Convert nodes and relationships to plain objects
            const cleanNodes = jsonToObject(nodes);
            const cleanRelationships = jsonToObject(relationships);

            if (!cleanNodes || !cleanRelationships) {
                throw new Error('Invalid nodes or relationships format from OpenAI response');
            }

            return { nodes: cleanNodes, relationships: cleanRelationships };
        } catch (error) {
            console.error('Error extracting entities and relationships:', error);
            throw new Error(`Extraction failed: ${error}`);
        }
    }


    async storeExtractedNodesAndRelationships(nodes: GraphEntity[], relationships: GraphRelationship[]): Promise<void> {
        const session = neo4jService['driver'].session();
        try {
            const tx = session.beginTransaction();

            // Store nodes
            for (const node of nodes) {
                await tx.run(`
                MERGE (n:${node.type} {id: $id})
                SET n.name = $name, n.description = $description, n.properties = $properties
                `, {
                    id: node.id,
                    name: node.name,
                    description: node.description || '',
                    properties: JSON.stringify(node.properties || {})
                });
            }

            // Store relationships
            for (const rel of relationships) {
                await tx.run(`
                MATCH (source {id: $sourceId})
                MATCH (target {id: $targetId})
                MERGE (source)-[r:${rel.type.replace(/[^A-Z_]/g, '_')} {
                    id: $relId,
                    description: $description,
                    properties: $properties,
                    createdAt: datetime()
                }]->(target)
            `, {
                    sourceId: rel.source,
                    targetId: rel.target,
                    relId: rel.id,
                    description: rel.description || '',
                    properties: JSON.stringify(rel.properties || {})
                });
            }

            await tx.commit();
        } catch (error) {
            console.error('Storing nodes and relationships failed:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    async semanticSearchChunks(queryEmbedding: number[], limit: number = 10): Promise<any[]> {
        try {
            // First, try using Neo4j's built-in vector similarity (Neo4j 5.11+)
            try {
                const query = `
                    MATCH (c:Chunk)
                    WHERE c.embedding IS NOT NULL
                    WITH c, 
                         gds.similarity.cosine(c.embedding, $queryEmbedding) AS similarity
                    RETURN c.id as id, 
                           c.content as content, 
                           similarity
                    ORDER BY similarity DESC
                    LIMIT $limit
                `;

                console.log('Executing semantic search with Neo4j GDS cosine similarity', query);

                const result = await neo4jService.executeQuery(query, {
                    queryEmbedding,
                    limit
                });

                return result.records.map((record: any) => ({
                    id: record.get('id'),
                    content: record.get('content'),
                    similarity: record.get('similarity'),
                    score: record.get('similarity')
                }));
            } catch (gdsError) {
                console.log('GDS not available, falling back to manual cosine similarity');
                
                // Fallback: Get all chunks and calculate similarity manually
                const getAllQuery = `
                    MATCH (c:Chunk)
                    WHERE c.embedding IS NOT NULL
                    RETURN c.id as id, c.content as content, c.embedding as embedding
                `;

                const allChunks = await neo4jService.executeQuery(getAllQuery, {});
                
                // Calculate cosine similarity manually
                const results = allChunks.records.map((record: any) => {
                    const chunkEmbedding = record.get('embedding');
                    const similarity = this.calculateCosineSimilarity(queryEmbedding, chunkEmbedding);
                    
                    return {
                        id: record.get('id'),
                        content: record.get('content'),
                        similarity,
                        score: similarity
                    };
                });

                // Sort by similarity and limit
                return results
                    .sort((a: any, b: any) => b.similarity - a.similarity)
                    .slice(0, limit);
            }
        } catch (error) {
            console.error('Error performing semantic search:', error);
            throw new Error(`Semantic search failed: ${error}`);
        }
    }

    private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
        // if (vecA.length !== vecB.length) {
        //     throw new Error('Vectors must have the same length');
        // }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }
}

export default new GraphService();
