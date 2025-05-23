// scripts/sync-drive-webp.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getDriveInstance } = require('../src/config/google.drive');
const driveService = require('../src/services/driveService');
require('dotenv').config();

class DriveWebPSync {
  constructor() {
    this.drive = null;
    this.syncedCount = 0;
    this.newCount = 0;
    
    // Diretórios
    this.outputDir = process.env.CACHE_STORAGE_PATH || path.join(__dirname, '../cache');
    this.webpDir = path.join(this.outputDir, 'webp');
    this.metadataDir = path.join(this.webpDir, 'metadata');
    this.stateFile = path.join(this.outputDir, 'sync-state.json');
  }
  
  async loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading sync state:', error);
    }
    return { lastSync: null, processedFiles: {} };
  }
  
  async saveState(state) {
    try {
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Error saving sync state:', error);
    }
  }
  
  async sync() {
    console.log('🔄 Starting Drive sync...');
    
    try {
      this.drive = await getDriveInstance();
      const state = await this.loadState();
      
      // Buscar apenas arquivos modificados após última sincronização
      const query = state.lastSync ? 
        `modifiedTime > '${new Date(state.lastSync).toISOString()}'` : '';
      
      // Obter todas as pastas folha
      const leafFolders = await driveService.getAllLeafFoldersCached(process.env.DRIVE_FOLDER_ID);
      
      if (!leafFolders.success) {
        throw new Error('Failed to get folders');
      }
      
      // Processar cada pasta
      for (const folder of leafFolders.folders) {
        await this.syncFolder(folder, state);
      }
      
      // Atualizar estado
      state.lastSync = new Date().toISOString();
      await this.saveState(state);
      
      console.log(`✅ Sync completed! New files: ${this.newCount}, Total synced: ${this.syncedCount}`);
      
      // Se houver novos arquivos, executar pre-warming
      if (this.newCount > 0 && process.env.CACHE_PRELOAD_ON_START === 'true') {
        console.log('🔥 Triggering cache pre-warming for new files...');
        await driveService.prewarmCache();
      }
      
    } catch (error) {
      console.error('❌ Sync error:', error);
      throw error;
    }
  }
  
  async syncFolder(folder, state) {
    try {
      const photos = await driveService.getPhotos(folder.id);
      
      for (const photo of photos) {
        // Verificar se já foi processado
        const webpPath = path.join(this.webpDir, 'hd', `${photo.id}.webp`);
        
        if (!fs.existsSync(webpPath)) {
          // Novo arquivo, processar
          console.log(`📸 New photo found: ${photo.name} in ${folder.name}`);
          await this.processNewPhoto(photo, folder);
          
          state.processedFiles[photo.id] = {
            name: photo.name,
            processedAt: new Date().toISOString()
          };
          
          this.newCount++;
        }
        
        this.syncedCount++;
      }
      
    } catch (error) {
      console.error(`Error syncing folder ${folder.name}:`, error);
    }
  }
  
  async processNewPhoto(photo, folder) {
    try {
      // Download do Google Drive
      const response = await this.drive.files.get(
        { fileId: photo.id, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      
      const buffer = Buffer.from(response.data);
      
      // Converter para WebP
      await this.convertToWebP(buffer, photo, folder);
      
      console.log(`✅ Processed: ${photo.name}`);
      
    } catch (error) {
      console.error(`Error processing ${photo.name}:`, error);
      throw error;
    }
  }
  
  async convertToWebP(buffer, photo, folder) {
    // Reutilizar a mesma lógica do script de migração
    const WebPMigration = require('./migrate-to-webp');
    const migration = new WebPMigration();
    await migration.convertToWebP(buffer, photo, folder);
  }
}

// Executar sincronização
if (require.main === module) {
  const sync = new DriveWebPSync();
  sync.sync().catch(console.error);
}

module.exports = DriveWebPSync;