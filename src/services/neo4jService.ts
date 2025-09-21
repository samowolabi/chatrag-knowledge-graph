import neo4j from 'neo4j-driver';
import { config } from '../config/environment';

export class Neo4jService {
  private driver: any;

  constructor() {
    this.driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(
        config.neo4j.user,
        config.neo4j.password
      ),
      { encrypted: false }
    );
  }

  async initialize() {
    console.log('🔗 Initializing Neo4j connection...');
    try {
      await this.testConnection();
      console.log('✅ Neo4j connected successfully');
      return true;
    } catch (error) {
      console.error('❌ Neo4j connection failed:', error);
      throw error;
    }
  }

  async testConnection() {
    const session = this.driver.session();
    try {
      const result = await session.run('RETURN "Connection successful" as message');
      return result.records[0].get('message');
    } catch (error) {
      throw new Error(`Neo4j connection failed: ${error}`);
    } finally {
      await session.close();
    }
  }

  async executeQuery(query: string, parameters: Record<string, any> = {}): Promise<any> {
    const session = this.driver.session();
    try {
      const result = await session.run(query, parameters);
      return result;
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    } finally {
      await session.close();
    }
  }

  async executeReadQuery(query: string, parameters: Record<string, any> = {}): Promise<any[]> {
    const session = this.driver.session();
    try {
      const result = await session.readTransaction((tx: any) => tx.run(query, parameters));
      return result.records.map((record: any) => record.toObject());
    } catch (error) {
      throw new Error(`Read query failed: ${error}`);
    } finally {
      await session.close();
    }
  }

  async executeWriteQuery(query: string, parameters: Record<string, any> = {}): Promise<any[]> {
    const session = this.driver.session();
    try {
      const result = await session.writeTransaction((tx: any) => tx.run(query, parameters));
      return result.records.map((record: any) => record.toObject());
    } catch (error) {
      throw new Error(`Write query failed: ${error}`);
    } finally {
      await session.close();
    }
  }

  async close() {
    await this.driver.close();
  }

  getDriver() {
    return this.driver;
  }
}

export default new Neo4jService();
