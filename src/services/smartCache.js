// src/services/smartCache.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Importar monitoramento (com proteção contra import circular)
let monitoringService;
try {
  monitoringService = require('./monitoringService');
} catch (error) {
  console.log('Monitoring service not available during cache initialization');
}

class SmartCache {
  constructor(maxSizeGB = 50) {
    this.maxSize = maxSizeGB * 1024 * 1024 * 1024; // 50GB em bytes
    
    // Usar path persistente da Render ou local
    this.cacheDir = process.env.CACHE_STORAGE_PATH || path.join(__dirname, '../../cache/optimized');
    this.persistentDir = path.join(this.cacheDir, 'persistent');
    this.tempDir = path.join(this.cacheDir, 'temp');
    this.metadataFile = path.join(this.cacheDir, 'cache-metadata.json');
    
    // Níveis de prioridade
    this.priorityLevels = {
      HIGH: 'high',    // Categorias populares
      MEDIUM: 'medium', // Acessadas recentemente
      LOW: 'low'       // Raramente acessadas
    };
    
    // Cache em memória
    this.memoryCache = {};
    this.memoryCacheSize = 0;
    this.maxMemoryCacheSize = 500 * 1024 * 1024; // 500MB em bytes
    this.maxMemoryCacheItems = 500; // Máximo de itens em memória
    
    // Garantir que diretórios existam
    this.ensureCacheDir();
    
    // Carregar metadados
    this.metadata = this.loadMetadata();
    
    // Limpeza automática a cada 24 horas
    setInterval(() => this.autoCleanup(), 24 * 60 * 60 * 1000);
    
    // Limpeza do cache em memória a cada 30 minutos
    setInterval(() => this.cleanupMemoryCache(), 30 * 60 * 1000);
    
    console.log(`✅ SmartCache initialized with ${maxSizeGB}GB limit at ${this.cacheDir}`);
  }
  
  ensureCacheDir() {
    try {
      const dirs = [this.cacheDir, this.persistentDir, this.tempDir];
      dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`📁 Created cache directory: ${dir}`);
        }
      });
    } catch (error) {
      console.error('Error creating cache directories:', error);
    }
  }
  
  loadMetadata() {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const data = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
        return {
          files: data.files || {},
          totalSize: data.totalSize || 0,
          categoryStats: data.categoryStats || {}
        };
      }
    } catch (error) {
      console.error('Error loading cache metadata:', error);
    }
    return { files: {}, totalSize: 0, categoryStats: {} };
  }
  
  saveMetadata() {
    try {
      const dataToSave = {
        files: this.metadata.files,
        totalSize: this.metadata.totalSize,
        categoryStats: this.metadata.categoryStats,
        lastUpdate: new Date().toISOString()
      };
      fs.writeFileSync(this.metadataFile, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
      console.error('Error saving cache metadata:', error);
    }
  }
  
  // Determinar prioridade baseado em categoria e uso
  getPriority(filename, categoryId) {
    // Verificar estatísticas da categoria
    if (this.metadata.categoryStats[categoryId]) {
      const stats = this.metadata.categoryStats[categoryId];
      if (stats.accessCount > 100) return this.priorityLevels.HIGH;
      if (stats.accessCount > 50) return this.priorityLevels.MEDIUM;
    }
    
    // Verificar padrões no nome do arquivo
    if (filename.includes('thumb_')) return this.priorityLevels.HIGH;
    if (filename.includes('popular_') || filename.includes('featured_')) {
      return this.priorityLevels.HIGH;
    }
    
    return this.priorityLevels.MEDIUM;
  }
  
  // Adicionar ao cache em memória
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
  
  // Limpar o cache em memória
  cleanupMemoryCache(neededSpace = 0) {
    console.log('🧠 Memory cache cleanup starting...');
    
    if (Object.keys(this.memoryCache).length === 0) return;
    
    const entries = Object.entries(this.memoryCache)
      .sort(([,a], [,b]) => {
        const valueA = a.accessCount / Math.max(1, (Date.now() - a.lastAccessed) / 3600000);
        const valueB = b.accessCount / Math.max(1, (Date.now() - b.lastAccessed) / 3600000);
        return valueA - valueB;
      });
    
    let freedSpace = 0;
    let freedItems = 0;
    
    for (const [filename, info] of entries) {
      if (neededSpace > 0 && freedSpace >= neededSpace && 
          this.memoryCacheSize - freedSpace <= this.maxMemoryCacheSize * 0.7) break;
      
      freedSpace += info.size;
      this.memoryCacheSize -= info.size;
      delete this.memoryCache[filename];
      freedItems++;
      
      if ((neededSpace === 0 && freedSpace >= this.maxMemoryCacheSize * 0.3) ||
          (neededSpace > 0 && freedSpace >= neededSpace * 1.2)) {
        break;
      }
    }
    
    console.log(`🧠 Memory cache: Freed ${Math.round(freedSpace / 1024 / 1024)}MB (${freedItems} items)`);
  }
  
  async addFile(filename, buffer, categoryId = null) {
    const priority = this.getPriority(filename, categoryId);
    const targetDir = priority === this.priorityLevels.HIGH ? this.persistentDir : this.tempDir;
    const filepath = path.join(targetDir, filename);
    const fileSize = buffer.length;
    
    // Atualizar estatísticas da categoria
    if (categoryId) {
      if (!this.metadata.categoryStats[categoryId]) {
        this.metadata.categoryStats[categoryId] = { accessCount: 0, cacheHits: 0 };
      }
      this.metadata.categoryStats[categoryId].accessCount++;
    }
    
    // Verificar se arquivo já existe
    if (this.metadata.files[filename]) {
      this.metadata.files[filename].lastAccessed = Date.now();
      this.metadata.files[filename].accessCount = (this.metadata.files[filename].accessCount || 0) + 1;
      this.saveMetadata();
      
      if (fileSize < 5 * 1024 * 1024) { // Apenas arquivos < 5MB
        this.addToMemoryCache(filename, buffer);
      }
      
      return filepath;
    }
    
    // Verificar se precisamos limpar cache
    if (this.metadata.totalSize + fileSize > this.maxSize) {
      await this.cleanup(fileSize);
    }
    
    try {
      // Criar diretório se não existir
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Salvar arquivo
      fs.writeFileSync(filepath, buffer);
      
      // Atualizar metadata
      this.metadata.files[filename] = {
        size: fileSize,
        lastAccessed: Date.now(),
        created: Date.now(),
        priority: priority,
        path: filepath,
        categoryId: categoryId,
        accessCount: 1
      };
      this.metadata.totalSize += fileSize;
      this.saveMetadata();
      
      // Adicionar ao cache em memória se for pequeno o suficiente
      if (fileSize < 5 * 1024 * 1024) {
        this.addToMemoryCache(filename, buffer);
      }
      
      console.log(`✅ Cache: Added ${filename} (${Math.round(fileSize / 1024)}KB) with ${priority} priority`);
      return filepath;
    } catch (error) {
      console.error('Error adding file to cache:', error);
      throw error;
    }
  }
  
  getFile(filename) {
    // Verificar cache em memória primeiro
    if (this.memoryCache[filename]) {
      this.memoryCache[filename].lastAccessed = Date.now();
      this.memoryCache[filename].accessCount++;
      
      // Atualizar estatísticas
      if (this.metadata.files[filename] && this.metadata.files[filename].categoryId) {
        const categoryId = this.metadata.files[filename].categoryId;
        if (this.metadata.categoryStats[categoryId]) {
          this.metadata.categoryStats[categoryId].cacheHits++;
        }
      }
      
      return {
        inMemory: true,
        data: this.memoryCache[filename].data
      };
    }
    
    // Procurar em disco
    if (this.metadata.files[filename]) {
      const fileInfo = this.metadata.files[filename];
      const filepath = fileInfo.path || path.join(this.cacheDir, filename);
      
      if (fs.existsSync(filepath)) {
        // Atualizar último acesso
        fileInfo.lastAccessed = Date.now();
        fileInfo.accessCount = (fileInfo.accessCount || 0) + 1;
        this.saveMetadata();
        
        try {
          const buffer = fs.readFileSync(filepath);
          
          // Adicionar à memória se for usado frequentemente e pequeno
          if (fileInfo.accessCount > 5 && buffer.length < 5 * 1024 * 1024) {
            this.addToMemoryCache(filename, buffer);
          }
          
          return {
            inMemory: false,
            path: filepath,
            data: buffer
          };
        } catch (err) {
          console.error(`Error reading file from disk cache: ${err.message}`);
          return null;
        }
      }
    }
    
    return null;
  }
  
  async cleanup(neededSpace = 0) {
    console.log('🧹 Cache cleanup starting...');
    
    // Ordenar arquivos por prioridade e último acesso
    const files = Object.entries(this.metadata.files)
      .filter(([, info]) => info.priority !== this.priorityLevels.HIGH) // Não remover alta prioridade
      .sort(([,a], [,b]) => {
        // Primeiro por prioridade, depois por último acesso
        if (a.priority !== b.priority) {
          return a.priority === this.priorityLevels.LOW ? -1 : 1;
        }
        return a.lastAccessed - b.lastAccessed;
      });
    
    let freedSpace = 0;
    let deletedCount = 0;
    
    for (const [filename, info] of files) {
      if (neededSpace > 0 && freedSpace >= neededSpace) break;
      
      try {
        const filepath = info.path || path.join(this.cacheDir, filename);
        
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
          freedSpace += info.size;
          deletedCount++;
          
          if (this.memoryCache[filename]) {
            this.memoryCacheSize -= this.memoryCache[filename].size;
            delete this.memoryCache[filename];
          }
        }
        
        this.metadata.totalSize -= info.size;
        delete this.metadata.files[filename];
        
      } catch (error) {
        console.error(`Error deleting cache file ${filename}:`, error);
      }
    }
    
    this.saveMetadata();
    console.log(`✅ Cache cleanup: Freed ${Math.round(freedSpace / 1024 / 1024)}MB (${deletedCount} files)`);
    
    if (monitoringService) {
      monitoringService.addCacheStats(this.getStatus());
    }
  }
  
  async autoCleanup() {
    console.log('🔄 Auto cleanup starting...');
    
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [filename, info] of Object.entries(this.metadata.files)) {
      // Não remover arquivos de alta prioridade mesmo se antigos
      if (info.priority === this.priorityLevels.HIGH) continue;
      
      if (info.lastAccessed < thirtyDaysAgo) {
        try {
          const filepath = info.path || path.join(this.cacheDir, filename);
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            this.metadata.totalSize -= info.size;
            delete this.metadata.files[filename];
            
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
  
  getStatus() {
    const totalFiles = Object.keys(this.metadata.files).length;
    const totalSizeMB = Math.round(this.metadata.totalSize / 1024 / 1024);
    const maxSizeMB = Math.round(this.maxSize / 1024 / 1024);
    const usagePercent = Math.round((this.metadata.totalSize / this.maxSize) * 100);
    
    const memCacheItems = Object.keys(this.memoryCache).length;
    const memCacheSizeMB = Math.round(this.memoryCacheSize / 1024 / 1024);
    const maxMemCacheSizeMB = Math.round(this.maxMemoryCacheSize / 1024 / 1024);
    const memUsagePercent = Math.round((this.memoryCacheSize / this.maxMemoryCacheSize) * 100);
    
    // Calcular estatísticas de categorias
    const topCategories = Object.entries(this.metadata.categoryStats)
      .sort(([,a], [,b]) => b.accessCount - a.accessCount)
      .slice(0, 5)
      .map(([id, stats]) => ({ id, ...stats }));
    
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
      },
      
      // Top categorias
      topCategories
    };
  }
}

module.exports = SmartCache;