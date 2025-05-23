// scripts/migrate-to-webp.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getDriveInstance } = require('../src/config/google.drive');
const driveService = require('../src/services/driveService');
const SmartCache = require('../src/services/smartCache');
require('dotenv').config();

class WebPMigration {
  constructor() {
    this.drive = null;
    this.cache = new SmartCache(50);
    this.processedCount = 0;
    this.errorCount = 0;
    this.totalSize = 0;
    
    // Diretórios de saída
    this.outputDir = process.env.CACHE_STORAGE_PATH || path.join(__dirname, '../cache');
    this.webpDir = path.join(this.outputDir, 'webp');
    this.thumbnailsDir = path.join(this.outputDir, 'thumbnails');
    
    // Criar diretórios se não existirem
    this.ensureDirectories();
    
    // Log de progresso
    this.logFile = path.join(__dirname, 'migration-log.txt');
  }
  
  ensureDirectories() {
    const dirs = [
      this.outputDir,
      this.webpDir,
      path.join(this.webpDir, 'hd'),
      path.join(this.webpDir, 'original'),
      this.thumbnailsDir,
      path.join(this.thumbnailsDir, 'small'),
      path.join(this.thumbnailsDir, 'medium'),
      path.join(this.thumbnailsDir, 'large')
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });
  }
  
  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync(this.logFile, logMessage);
  }
  
  async start() {
    try {
      this.log('🚀 Starting WebP migration...');
      this.drive = await getDriveInstance();
      
      // 1. Obter todas as pastas folha (categorias com fotos)
      this.log('📂 Getting all leaf folders...');
      const leafFolders = await driveService.getAllLeafFoldersCached(process.env.DRIVE_FOLDER_ID, true);
      
      if (!leafFolders.success) {
        throw new Error('Failed to get leaf folders');
      }
      
      this.log(`Found ${leafFolders.folders.length} folders to process`);
      
      // 2. Processar cada pasta
      for (const folder of leafFolders.folders) {
        await this.processFolder(folder);
        
        // Pausar a cada 10 pastas para não sobrecarregar
        if (this.processedCount % 10 === 0) {
          this.log(`⏸️  Pausing for 5 seconds... (Processed: ${this.processedCount} files)`);
          await this.sleep(5000);
        }
      }
      
      // 3. Relatório final
      this.log('✅ Migration completed!');
      this.log(`📊 Processed: ${this.processedCount} files`);
      this.log(`❌ Errors: ${this.errorCount}`);
      this.log(`💾 Total size: ${this.formatBytes(this.totalSize)}`);
      
    } catch (error) {
      this.log(`❌ Fatal error: ${error.message}`);
      console.error(error);
    }
  }
  
  async processFolder(folder) {
    try {
      this.log(`\n📁 Processing folder: ${folder.fullPath}`);
      
      // Obter fotos da pasta
      const photos = await driveService.getPhotos(folder.id);
      this.log(`Found ${photos.length} photos in ${folder.name}`);
      
      for (const photo of photos) {
        await this.processPhoto(photo, folder);
      }
      
    } catch (error) {
      this.log(`❌ Error processing folder ${folder.name}: ${error.message}`);
      this.errorCount++;
    }
  }
  
  async processPhoto(photo, folder) {
    try {
      const startTime = Date.now();
      this.log(`\n🖼️  Processing: ${photo.name}`);
      
      // Verificar se já foi processado
      const webpPath = path.join(this.webpDir, 'hd', `${photo.id}.webp`);
      if (fs.existsSync(webpPath)) {
        this.log(`⏭️  Already processed: ${photo.name}`);
        this.processedCount++;
        return;
      }
      
      // Baixar arquivo do Google Drive
      this.log(`⬇️  Downloading: ${photo.name}`);
      const response = await this.drive.files.get(
        { fileId: photo.id, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      
      const buffer = Buffer.from(response.data);
      const originalSize = buffer.length;
      this.log(`📦 Original size: ${this.formatBytes(originalSize)}`);
      
      // Converter para WebP em diferentes tamanhos
      await this.convertToWebP(buffer, photo, folder);
      
      this.processedCount++;
      this.totalSize += originalSize;
      
      const duration = Date.now() - startTime;
      this.log(`✅ Completed in ${duration}ms`);
      
    } catch (error) {
      this.log(`❌ Error processing ${photo.name}: ${error.message}`);
      this.errorCount++;
      
      // Se for erro de quota, pausar por mais tempo
      if (error.message.includes('quota')) {
        this.log('⏸️  Quota exceeded, waiting 60 seconds...');
        await this.sleep(60000);
      }
    }
  }
  
  async convertToWebP(buffer, photo, folder) {
    const baseImage = sharp(buffer);
    const metadata = await baseImage.metadata();
    
    // Criar subdiretório da categoria se necessário
    const categoryDir = path.join(this.webpDir, 'categories', folder.id);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }
    
    // 1. HD WebP (qualidade 85)
    const hdPath = path.join(this.webpDir, 'hd', `${photo.id}.webp`);
    await baseImage
      .webp({ quality: 85 })
      .toFile(hdPath);
    
    const hdStats = fs.statSync(hdPath);
    this.log(`📸 HD WebP: ${this.formatBytes(hdStats.size)} (${Math.round(hdStats.size / buffer.length * 100)}% of original)`);
    
    // 2. Criar link simbólico na pasta da categoria
    const categoryLink = path.join(categoryDir, `${photo.id}.webp`);
    if (!fs.existsSync(categoryLink)) {
      fs.symlinkSync(hdPath, categoryLink);
    }
    
    // 3. Thumbnails
    const sizes = [
      { name: 'small', width: 150, height: 150 },
      { name: 'medium', width: 300, height: 300 },
      { name: 'large', width: 600, height: 600 }
    ];
    
    for (const size of sizes) {
      const thumbPath = path.join(this.thumbnailsDir, size.name, `${photo.id}.webp`);
      await sharp(buffer)
        .resize(size.width, size.height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 80 })
        .toFile(thumbPath);
        
      const thumbStats = fs.statSync(thumbPath);
      this.log(`📸 ${size.name} thumbnail: ${this.formatBytes(thumbStats.size)}`);
    }
    
    // 4. Salvar metadados
    const metadataPath = path.join(this.webpDir, 'metadata', `${photo.id}.json`);
    const metadataDir = path.dirname(metadataPath);
    if (!fs.existsSync(metadataDir)) {
      fs.mkdirSync(metadataDir, { recursive: true });
    }
    
    fs.writeFileSync(metadataPath, JSON.stringify({
      id: photo.id,
      name: photo.name,
      folderId: folder.id,
      folderName: folder.name,
      folderPath: folder.fullPath,
      originalSize: buffer.length,
      webpSize: hdStats.size,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      processedAt: new Date().toISOString()
    }, null, 2));
  }
  
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Executar migração
if (require.main === module) {
  const migration = new WebPMigration();
  migration.start().catch(console.error);
}

module.exports = WebPMigration;