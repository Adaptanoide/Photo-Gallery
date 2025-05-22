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
    
    // NOVO: Adicionar cache em memória
    this.memoryCache = {};
    this.memoryCacheSize = 0;
    this.maxMemoryCacheSize = 100 * 1024 * 1024; // 100MB em bytes
    this.maxMemoryCacheItems = 100; // Máximo de itens em memória
    
    // Garantir que diretório existe
    this.ensureCacheDir();
    
    // Carregar metadados
    this.metadata = this.loadMetadata();
    
    // MODIFICADO: Aumentar intervalo de limpeza automática para 12 horas
    setInterval(() => this.autoCleanup(), 12 * 60 * 60 * 1000);
    
    // NOVO: Limpeza do cache em memória a cada 30 minutos
    setInterval(() => this.cleanupMemoryCache(), 30 * 60 * 1000);
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
  
  // NOVO: Método para adicionar ao cache em memória
  addToMemoryCache(filename, buffer) {
    // Verificar se precisamos limpar o cache em memória
    if (this.memoryCacheSize + buffer.length > this.maxMemoryCacheSize || 
        Object.keys(this.memoryCache).length >= this.maxMemoryCacheItems) {
      this.cleanupMemoryCache(buffer.length);
    }
    
    this.memoryCache[filename] = {
      data: buffer,
      size: buffer.length,
      lastAccessed: Date.now(),
      accessCount: 1
    };
    
    this.memoryCacheSize += buffer.length;
    console.log(`📝 Memory Cache: Added ${filename} (${Math.round(buffer.length / 1024)}KB)`);
  }
  
  // NOVO: Método para limpar o cache em memória
  cleanupMemoryCache(neededSpace = 0) {
    console.log('🧠 Memory cache cleanup starting...');
    
    // Verificar se temos items para limpar
    if (Object.keys(this.memoryCache).length === 0) return;
    
    // Ordenar por contagem de acesso / tempo do último acesso
    // Isso vai manter em cache os itens mais frequentemente acessados
    const entries = Object.entries(this.memoryCache)
      .sort(([,a], [,b]) => {
        // Cálculo de "valor" do item baseado em frequência e recência
        const valueA = a.accessCount / Math.max(1, (Date.now() - a.lastAccessed) / 3600000);
        const valueB = b.accessCount / Math.max(1, (Date.now() - b.lastAccessed) / 3600000);
        return valueA - valueB; // Menor valor primeiro (menos importante)
      });
    
    let freedSpace = 0;
    let freedItems = 0;
    
    for (const [filename, info] of entries) {
      // Parar se já liberamos espaço suficiente
      if (neededSpace > 0 && freedSpace >= neededSpace && 
          this.memoryCacheSize - freedSpace <= this.maxMemoryCacheSize * 0.7) break;
      
      // Remover do cache em memória
      freedSpace += info.size;
      this.memoryCacheSize -= info.size;
      delete this.memoryCache[filename];
      freedItems++;
      
      // Se limpamos mais de 30% ou todos os itens necessários, podemos parar
      if ((neededSpace === 0 && freedSpace >= this.maxMemoryCacheSize * 0.3) ||
          (neededSpace > 0 && freedSpace >= neededSpace * 1.2)) {
        break;
      }
    }
    
    console.log(`🧠 Memory cache: Freed ${Math.round(freedSpace / 1024 / 1024)}MB (${freedItems} items)`);
  }
  
  async addFile(filename, buffer) {
    const filepath = path.join(this.cacheDir, filename);
    const fileSize = buffer.length;
    
    // Verificar se arquivo já existe
    if (this.metadata.files[filename]) {
      // Atualizar último acesso
      this.metadata.files[filename].lastAccessed = Date.now();
      this.saveMetadata();
      
      // NOVO: Adicionar ao cache em memória se for pequeno o suficiente
      if (fileSize < 2 * 1024 * 1024) { // Apenas arquivos < 2MB
        this.addToMemoryCache(filename, buffer);
      }
      
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
      
      // NOVO: Adicionar ao cache em memória se for pequeno o suficiente
      if (fileSize < 2 * 1024 * 1024) { // Apenas arquivos < 2MB
        this.addToMemoryCache(filename, buffer);
      }
      
      console.log(`✅ Cache: Added ${filename} (${Math.round(fileSize / 1024)}KB)`);
      return filepath;
    } catch (error) {
      console.error('Error adding file to cache:', error);
      throw error;
    }
  }
  
  // MODIFICADO: Verificar cache em memória primeiro
  getFile(filename) {
    // NOVO: Verificar cache em memória primeiro
    if (this.memoryCache[filename]) {
      // Atualizar estatísticas de acesso
      this.memoryCache[filename].lastAccessed = Date.now();
      this.memoryCache[filename].accessCount++;
      
      // Retornar diretamente o buffer da memória
      return {
        inMemory: true,
        data: this.memoryCache[filename].data
      };
    }
    
    // Cache em disco como fallback
    const filepath = path.join(this.cacheDir, filename);
    
    if (fs.existsSync(filepath) && this.metadata.files[filename]) {
      // Atualizar último acesso
      this.metadata.files[filename].lastAccessed = Date.now();
      this.saveMetadata();
      
      try {
        // NOVO: Carregar arquivo para memória se for usado frequentemente
        const buffer = fs.readFileSync(filepath);
        
        // Apenas adicionar à memória se o arquivo for pequeno
        if (buffer.length < 2 * 1024 * 1024) {
          this.addToMemoryCache(filename, buffer);
        }
        
        return {
          inMemory: false,
          path: filepath,
          data: buffer
        };
      } catch (err) {
        console.error(`Error reading file from disk cache: ${err.message}`);
        return {
          inMemory: false,
          path: filepath
        };
      }
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
          
          // NOVO: Remover também do cache em memória se existir
          if (this.memoryCache[filename]) {
            this.memoryCacheSize -= this.memoryCache[filename].size;
            delete this.memoryCache[filename];
          }
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
  
  // MODIFICADO: aumentar prazo de limpeza automática de 1 semana para 2 semanas
  async autoCleanup() {
    console.log('🔄 Auto cleanup starting...');
    
    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000); // MODIFICADO: 2 semanas
    let cleaned = 0;
    
    for (const [filename, info] of Object.entries(this.metadata.files)) {
      if (info.lastAccessed < twoWeeksAgo) {
        try {
          const filepath = path.join(this.cacheDir, filename);
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            this.metadata.totalSize -= info.size;
            delete this.metadata.files[filename];
            
            // NOVO: Remover também do cache em memória se existir
            if (this.memoryCache[filename]) {
              this.memoryCacheSize -= this.memoryCache[filename].size;
              delete this.memoryCache[filename];
            }
            
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
  
  // Status do cache (MODIFICADO para incluir estatísticas de memória)
  getStatus() {
    const totalFiles = Object.keys(this.metadata.files).length;
    const totalSizeMB = Math.round(this.metadata.totalSize / 1024 / 1024);
    const maxSizeMB = Math.round(this.maxSize / 1024 / 1024);
    const usagePercent = Math.round((this.metadata.totalSize / this.maxSize) * 100);
    
    // NOVO: Adicionar estatísticas do cache em memória
    const memCacheItems = Object.keys(this.memoryCache).length;
    const memCacheSizeMB = Math.round(this.memoryCacheSize / 1024 / 1024);
    const maxMemCacheSizeMB = Math.round(this.maxMemoryCacheSize / 1024 / 1024);
    const memUsagePercent = Math.round((this.memoryCacheSize / this.maxMemoryCacheSize) * 100);
    
    return {
      // Estatísticas do cache em disco
      totalFiles,
      totalSizeMB,
      maxSizeMB,
      usagePercent,
      available: this.maxSize - this.metadata.totalSize,
      
      // Estatísticas do cache em memória
      memoryCache: {
        items: memCacheItems,
        sizeMB: memCacheSizeMB,
        maxSizeMB: maxMemCacheSizeMB,
        usagePercent: memUsagePercent
      }
    };
  }
}

module.exports = SmartCache;