// src/services/smartCache.js
const fs = require('fs');
const path = require('path');

// Importar monitoramento (com proteção contra import circular)
let monitoringService;
try {
  monitoringService = require('./monitoringService');
} catch (error) {
  console.log('Monitoring service not available during cache initialization');
}

class SmartCache {
  constructor(maxSizeGB = 5) {
    this.maxSize = maxSizeGB * 1024 * 1024 * 1024; // 5GB em bytes
    this.cacheDir = path.join(__dirname, '../../cache/optimized');
    this.metadataFile = path.join(this.cacheDir, 'cache-metadata.json');
    
    // Garantir que diretório existe
    this.ensureCacheDir();
    
    // Carregar metadados
    this.metadata = this.loadMetadata();
    
    // Limpeza automática a cada 6 horas
    setInterval(() => this.autoCleanup(), 6 * 60 * 60 * 1000);
  }
  
  ensureCacheDir() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (error) {
      console.error('Error creating cache directory:', error);
    }
  }
  
  loadMetadata() {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const data = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
        return {
          files: data.files || {},
          totalSize: data.totalSize || 0
        };
      }
    } catch (error) {
      console.error('Error loading cache metadata:', error);
    }
    return { files: {}, totalSize: 0 };
  }
  
  saveMetadata() {
    try {
      const dataToSave = {
        files: this.metadata.files,
        totalSize: this.metadata.totalSize,
        lastUpdate: new Date().toISOString()
      };
      fs.writeFileSync(this.metadataFile, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
      console.error('Error saving cache metadata:', error);
    }
  }
  
  async addFile(filename, buffer) {
    const filepath = path.join(this.cacheDir, filename);
    const fileSize = buffer.length;
    
    // Verificar se arquivo já existe
    if (this.metadata.files[filename]) {
      // Atualizar último acesso
      this.metadata.files[filename].lastAccessed = Date.now();
      this.saveMetadata();
      return filepath;
    }
    
    // Verificar se precisamos limpar cache
    if (this.metadata.totalSize + fileSize > this.maxSize) {
      await this.cleanup(fileSize);
    }
    
    try {
      // Salvar arquivo
      fs.writeFileSync(filepath, buffer);
      
      // Atualizar metadata
      this.metadata.files[filename] = {
        size: fileSize,
        lastAccessed: Date.now(),
        created: Date.now()
      };
      this.metadata.totalSize += fileSize;
      this.saveMetadata();
      
      console.log(`✅ Cache: Added ${filename} (${Math.round(fileSize / 1024)}KB)`);
      return filepath;
    } catch (error) {
      console.error('Error adding file to cache:', error);
      throw error;
    }
  }
  
  getFile(filename) {
    const filepath = path.join(this.cacheDir, filename);
    
    if (fs.existsSync(filepath) && this.metadata.files[filename]) {
      // Atualizar último acesso
      this.metadata.files[filename].lastAccessed = Date.now();
      this.saveMetadata();
      return filepath;
    }
    
    return null;
  }
  
  async cleanup(neededSpace = 0) {
    console.log('🧹 Cache cleanup starting...');
    
    // Ordenar arquivos por último acesso (mais antigos primeiro)
    const files = Object.entries(this.metadata.files)
      .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed);
    
    let freedSpace = 0;
    let deletedCount = 0;
    
    for (const [filename, info] of files) {
      // Parar se já liberamos espaço suficiente
      if (neededSpace > 0 && freedSpace >= neededSpace) break;
      
      try {
        const filepath = path.join(this.cacheDir, filename);
        
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
          freedSpace += info.size;
          deletedCount++;
        }
        
        // Remover dos metadados
        this.metadata.totalSize -= info.size;
        delete this.metadata.files[filename];
        
      } catch (error) {
        console.error(`Error deleting cache file ${filename}:`, error);
      }
    }
    
    this.saveMetadata();
    console.log(`✅ Cache cleanup: Freed ${Math.round(freedSpace / 1024 / 1024)}MB (${deletedCount} files)`);
    // Enviar estatísticas para monitoramento
    if (monitoringService) {
    monitoringService.addCacheStats(this.getStatus());
    } 
  }
  
  // Limpeza automática - remove arquivos mais antigos que 1 semana
  async autoCleanup() {
    console.log('🔄 Auto cleanup starting...');
    
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [filename, info] of Object.entries(this.metadata.files)) {
      if (info.lastAccessed < oneWeekAgo) {
        try {
          const filepath = path.join(this.cacheDir, filename);
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            this.metadata.totalSize -= info.size;
            delete this.metadata.files[filename];
            cleaned++;
          }
        } catch (error) {
          console.error(`Error during auto cleanup of ${filename}:`, error);
        }
      }
    }
    
    if (cleaned > 0) {
      this.saveMetadata();
      console.log(`✅ Auto cleanup: Removed ${cleaned} old files`);
    }
  }
  
  // Status do cache
  getStatus() {
    const totalFiles = Object.keys(this.metadata.files).length;
    const totalSizeMB = Math.round(this.metadata.totalSize / 1024 / 1024);
    const maxSizeMB = Math.round(this.maxSize / 1024 / 1024);
    const usagePercent = Math.round((this.metadata.totalSize / this.maxSize) * 100);
    
    return {
      totalFiles,
      totalSizeMB,
      maxSizeMB,
      usagePercent,
      available: this.maxSize - this.metadata.totalSize
    };
  }
}

module.exports = SmartCache;