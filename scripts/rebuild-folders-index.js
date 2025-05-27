// Create a file: scripts/rebuild-folders-index.js

const fs = require('fs').promises;
const path = require('path');
const localStorageService = require('../src/services/localStorageService');

async function rebuildFolderIndex() {
  console.log('🔄 Starting complete folder index rebuild...');
  
  try {
    // Force a complete rebuild of the index
    const result = await localStorageService.rebuildIndex();
    console.log(`✅ Index rebuilt successfully!`);
    console.log(`📊 Total photos: ${result.totalPhotos}`);
    console.log(`📁 Total folders: ${result.folders.length}`);
    
    // List all found folders
    console.log('📋 Found folders:');
    result.folders.forEach(folder => {
      console.log(`- ${folder.name} (${folder.photoCount} photos)`);
      if (folder.children && folder.children.length > 0) {
        folder.children.forEach(child => {
          console.log(`  └─ ${child.name} (${child.photoCount} photos)`);
        });
      }
    });
  } catch (error) {
    console.error('❌ Error rebuilding index:', error);
  }
}

// Initialize localStorageService first, then rebuild
localStorageService.initialize()
  .then(() => rebuildFolderIndex())
  .catch(console.error);