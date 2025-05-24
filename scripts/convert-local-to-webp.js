const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

class LocalWebPConverter {
  constructor(inputDir, outputDir) {
    this.inputDir = inputDir;
    this.outputDir = outputDir;
    this.processedCount = 0;
    this.errorCount = 0;
    this.skippedCount = 0;
    this.stats = {
      jpg: 0,
      heic: 0,
      other: 0
    };
  }

  async convertDirectory(dirPath, relativePath = '') {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        const outputSubDir = path.join(this.outputDir, relativePath, item);
        if (!fs.existsSync(outputSubDir)) {
          fs.mkdirSync(outputSubDir, { recursive: true });
        }
        
        await this.convertDirectory(fullPath, path.join(relativePath, item));
      } else if (this.isImage(item)) {
        await this.convertImage(fullPath, relativePath, item);
      }
    }
  }

  isImage(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].includes(ext);
  }

  async convertImage(inputPath, relativePath, filename) {
    try {
      const ext = path.extname(filename).toLowerCase();
      const nameWithoutExt = path.parse(filename).name;
      const outputPath = path.join(this.outputDir, relativePath, `${nameWithoutExt}.webp`);
      
      // Estatísticas
      if (ext === '.jpg' || ext === '.jpeg') this.stats.jpg++;
      else if (ext === '.heic' || ext === '.heif') this.stats.heic++;
      else this.stats.other++;
      
      if (fs.existsSync(outputPath)) {
        console.log(`⏭️  Já existe: ${outputPath}`);
        this.skippedCount++;
        return;
      }
      
      console.log(`🔄 Convertendo: ${relativePath}/${filename} (${ext})`);
      
      await sharp(inputPath)
        .rotate() // Auto-rotaciona baseado em EXIF
        .webp({ quality: 85 })
        .toFile(outputPath);
      
      this.processedCount++;
      
      // A cada 100 arquivos, mostra progresso
      if (this.processedCount % 100 === 0) {
        console.log(`\n📊 Progresso: ${this.processedCount} convertidos\n`);
      }
      
    } catch (error) {
      console.error(`❌ Erro em ${filename}: ${error.message}`);
      this.errorCount++;
      
      // Se for erro de HEIC, avisar
      if (error.message.includes('heic') || error.message.includes('HEIC')) {
        console.log('💡 Dica: Instale libheif-dev para suportar HEIC');
      }
    }
  }

  async start() {
    console.log(`🚀 Iniciando conversão`);
    console.log(`📁 Origem: ${this.inputDir}`);
    console.log(`📁 Destino: ${this.outputDir}\n`);
    
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    const startTime = Date.now();
    await this.convertDirectory(this.inputDir);
    const duration = (Date.now() - startTime) / 1000;
    
    console.log(`\n✅ Conversão completa em ${duration.toFixed(1)}s!`);
    console.log(`📊 Processadas: ${this.processedCount}`);
    console.log(`⏭️  Puladas: ${this.skippedCount}`);
    console.log(`❌ Erros: ${this.errorCount}`);
    console.log(`\n📈 Tipos processados:`);
    console.log(`   JPG: ${this.stats.jpg}`);
    console.log(`   HEIC: ${this.stats.heic}`);
    console.log(`   Outros: ${this.stats.other}`);
  }
}

// Executar
if (require.main === module) {
  const converter = new LocalWebPConverter(
    '/home/tiago/Downloads/Sunshine Cowhides Actual Pictures',
    '/home/tiago/fotosystem/imagens-webp'
  );
  
  converter.start().catch(console.error);
}

module.exports = LocalWebPConverter;