// scripts/migrate-photos-to-local.js
// Executar APÓS a conversão WebP estar completa

const fs = require('fs').promises;
const path = require('path');
const localStorageService = require('../src/services/localStorageService');

class PhotoMigration {
  constructor() {
    // ALTERE ESTE PATH para onde estão suas fotos convertidas
    this.sourcePath = process.env.CONVERTED_PHOTOS_PATH || '/caminho/para/suas/fotos/convertidas';
    this.targetPath = process.env.CACHE_STORAGE_PATH || '/opt/render/project/storage/cache';
    
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      errors: [],
      startTime: Date.now()
    };
  }

  async migrate() {
    console.log('🚀 Starting photo migration to Render disk...');
    console.log(`📁 Source: ${this.sourcePath}`);
    console.log(`📁 Target: ${this.targetPath}`);
    
    // Verificar se pasta origem existe
    try {
      await fs.access(this.sourcePath);
    } catch (error) {
      console.error('❌ Source path does not exist!');
      console.error('Please set CONVERTED_PHOTOS_PATH environment variable');
      process.exit(1);
    }
    
    // Inicializar serviço
    await localStorageService.initialize();
    
    // Contar total de arquivos
    console.log('📊 Counting files...');
    await this.countFiles(this.sourcePath);
    console.log(`📊 Total files to process: ${this.stats.totalFiles}`);
    
    // Confirmar antes de prosseguir
    console.log('\n⚠️  This will copy all photos to Render disk.');
    console.log('Press Ctrl+C to cancel or wait 5 seconds to continue...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Processar migração
    await this.processDirectory(this.sourcePath, '');
    
    // Reconstruir índice
    console.log('\n📋 Rebuilding folder index...');
    await localStorageService.rebuildIndex();
    
    // Mostrar relatório final
    this.showReport();
  }

  async countFiles(dirPath) {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      
      if (item.isDirectory()) {
        await this.countFiles(fullPath);
      } else if (this.isImageFile(item.name)) {
        this.stats.totalFiles++;
      }
    }
  }

  async processDirectory(sourcePath, relativePath) {
    try {
      const items = await fs.readdir(sourcePath, { withFileTypes: true });
      
      for (const item of items) {
        const sourceItemPath = path.join(sourcePath, item.name);
        const relativeItemPath = path.join(relativePath, item.name);
        
        if (item.isDirectory()) {
          // Criar diretório no destino
          const targetDir = path.join(this.targetPath, 'photos', relativeItemPath);
          await fs.mkdir(targetDir, { recursive: true });
          
          console.log(`📁 Created folder: ${relativeItemPath}`);
          
          // Processar subdiretório
          await this.processDirectory(sourceItemPath, relativeItemPath);
          
        } else if (this.isImageFile(item.name)) {
          // Processar arquivo de imagem
          await this.processFile(sourceItemPath, relativeItemPath);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing directory ${sourcePath}:`, error);
      this.stats.errors.push({
        path: sourcePath,
        error: error.message
      });
    }
  }

  async processFile(sourcePath, relativePath) {
    try {
      this.stats.processedFiles++;
      
      // Mostrar progresso
      if (this.stats.processedFiles % 50 === 0) {
        const percent = ((this.stats.processedFiles / this.stats.totalFiles) * 100).toFixed(1);
        console.log(`📸 Progress: ${this.stats.processedFiles}/${this.stats.totalFiles} (${percent}%)`);
      }
      
      const fileName = path.basename(sourcePath);
      const photoId = path.parse(fileName).name;
      const targetPath = path.join(this.targetPath, 'photos', relativePath);
      
      // Verificar se já existe
      try {
        await fs.access(targetPath);
        console.log(`⏭️  Skipping (already exists): ${relativePath}`);
        this.stats.skippedFiles++;
        return;
      } catch {
        // Arquivo não existe, continuar
      }
      
      // Copiar arquivo
      await fs.copyFile(sourcePath, targetPath);
      
      // Criar metadata
      const stats = await fs.stat(sourcePath);
      const metadata = {
        originalName: fileName,
        categoryPath: path.dirname(relativePath),
        categoryName: this.getCategoryName(relativePath),
        size: stats.size,
        migratedDate: new Date().toISOString(),
        source: 'local'
      };
      
      await localStorageService.savePhotoMetadata(photoId, metadata);
      
      // Log detalhado para primeiros arquivos
      if (this.stats.processedFiles <= 5) {
        console.log(`✅ Migrated: ${relativePath}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing file ${sourcePath}:`, error);
      this.stats.errors.push({
        path: sourcePath,
        error: error.message
      });
    }
  }

  getCategoryName(relativePath) {
    const parts = path.dirname(relativePath).split(path.sep);
    return parts[parts.length - 1] || 'root';
  }

  isImageFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
  }

  showReport() {
    const duration = Date.now() - this.stats.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = ((duration % 60000) / 1000).toFixed(0);
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 MIGRATION REPORT');
    console.log('='.repeat(50));
    console.log(`✅ Processed: ${this.stats.processedFiles} files`);
    console.log(`⏭️  Skipped: ${this.stats.skippedFiles} files`);
    console.log(`❌ Errors: ${this.stats.errors.length}`);
    console.log(`⏱️  Duration: ${minutes}m ${seconds}s`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.stats.errors.slice(0, 10).forEach(err => {
        console.log(`- ${err.path}: ${err.error}`);
      });
      
      if (this.stats.errors.length > 10) {
        console.log(`... and ${this.stats.errors.length - 10} more errors`);
      }
    }
    
    console.log('\n✅ Migration completed!');
    console.log('📋 Next steps:');
    console.log('1. Test the application to ensure photos load from local disk');
    console.log('2. Monitor the performance improvement');
    console.log('3. Keep Google Drive as backup only');
  }
}

// Executar migração
async function main() {
  const migration = new PhotoMigration();
  
  try {
    await migration.migrate();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = PhotoMigration;