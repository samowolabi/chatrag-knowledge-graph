import fs from 'fs';
import path from 'path';
const pdf = require('pdf-parse');
const csv = require('csv-parser')

export class TextParserService {

  async extractFromTxt(filePath: string): Promise<string> {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read text file: ${error}`);
    }
  }

  async extractFromPDF(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      return data.text;
    } catch (error) {
      throw new Error(`Failed to extract PDF: ${error}`);
    }
  }

  async extractFromCSV(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: any) => results.push(data))
        .on('end', () => resolve(JSON.stringify(results, null, 2)))
        .on('error', (error: any) => reject(`Failed to extract CSV: ${error}`));
    });
  }

  async extractText(filePath: string, type?: 'pdf' | 'txt' | 'csv'): Promise<string> {
    const fileType = type || this.getFileType(filePath);

    switch (fileType) {
      case 'pdf':
        return await this.extractFromPDF(filePath);
      case 'txt':
        return await this.extractFromTxt(filePath);
      case 'csv':
        return await this.extractFromCSV(filePath);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  private getFileType(filePath: string): 'pdf' | 'txt' | 'csv' {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.pdf':
        return 'pdf';
      case '.txt':
        return 'txt';
      case '.csv':
        return 'csv';
      default:
        throw new Error(`Unsupported file extension: ${ext}`);
    }
  }

  async parseDocument(filePath: string, type?: 'pdf' | 'txt' | 'csv'): Promise<{
    id: string;
    title: string;
    content: string;
    type: string;
    metadata: Record<string, any>;
  }> {
    try {
      if (!filePath) {
        throw new Error('filePath is required');
      }

      if (!type || !['pdf', 'txt', 'csv'].includes(type)) {
        throw new Error(`Unsupported file type: ${type}`);
      }

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Extract text content
      const content = await this.extractText(filePath, type);

      return {
        id: `doc-${Date.now()}`,
        title: path.basename(filePath),
        content,
        type: type || this.getFileType(filePath),
        metadata: {
          size: content.length,
          filePath,
          extractedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`Document parsing failed: ${error}`);
      throw new Error(`Document parsing failed: ${error}`);
    }
  }
}

export default new TextParserService();