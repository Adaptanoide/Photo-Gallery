// scripts/cache-stats.js
const fs = require('fs');
const path = require('path');
const SmartCache = require('../src/services/smartCache');
require('dotenv').config();

async function getCacheStats() {
  const cacheDir = process.env.CACHE_STORAGE_PATH || path.join(__dirname, '../cache');
  const webpDir = path.join(cacheDir, 'webp');
  
  console.log('\n📊 CACHE STATISTICS\n' + '='.repeat(50));
  
  // Estatísticas do SmartCache
  const cache = new SmartCache(50);
  const status = cache.getStatus();
  
  console.log('\n🧠 SmartCache Status:');
  console.log(`  Total files: ${status.totalFiles}`);
  console.log(`  Disk usage: ${status.totalSizeMB}MB / ${status.maxSizeMB}MB (${status.usagePercent}%)`);
  console.log(`  Memory cache: ${status.memoryCache.items} items, ${status.memoryCache.sizeMB}MB`);
  
  // Estatísticas do WebP
  if (fs.existsSync(webpDir)) {
    const hdDir = path.join(webpDir, 'hd');
    const thumbDir = path.join(cacheDir, 'thumbnails');
    
    const countFiles = (dir) => {
      try {
        return fs.readdirSync(dir).filter(f => f.endsWith('.webp')).length;
      } catch (e) {
        return 0;
      }
    };
    
    const getDirSize = (dir) => {
      let size = 0;
      try {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const stats = fs.statSync(path.join(dir, file));
          if (stats.isFile()) size += stats.size;
        });
      } catch (e) {}
      return size;
    };
    
    console.log('\n🖼️  WebP Files:');
    console.log(`  HD images: ${countFiles(hdDir)}`);
    console.log(`  Small thumbs: ${countFiles(path.join(thumbDir, 'small'))}`);
    console.log(`  Medium thumbs: ${countFiles(path.join(thumbDir, 'medium'))}`);
    console.log(`  Large thumbs: ${countFiles(path.join(thumbDir, 'large'))}`);
    
    const hdSize = getDirSize(hdDir);
    const thumbSize = getDirSize(thumbDir);
    console.log(`\n💾 Storage Usage:`);
    console.log(`  HD WebP: ${Math.round(hdSize / 1024 / 1024)}MB`);
    console.log(`  Thumbnails: ${Math.round(thumbSize / 1024 / 1024)}MB`);
    console.log(`  Total: ${Math.round((hdSize + thumbSize) / 1024 / 1024)}MB`);
  }
  
  // Top categorias
  if (status.topCategories.length > 0) {
    console.log('\n🔥 Top Categories:');
    status.topCategories.forEach((cat, i) => {
      console.log(`  ${i + 1}. Category ${cat.id}: ${cat.accessCount} accesses, ${cat.cacheHits || 0} cache hits`);
    });
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

getCacheStats().catch(console.error);