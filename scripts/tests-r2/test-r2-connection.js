// test-r2-connection.js
require('dotenv').config();
const { S3Client, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

// Configurar cliente R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function testConnection() {
  console.log('🔄 Testando conexão com Cloudflare R2...\n');
  
  try {
    // Teste 1: Listar buckets
    console.log('�� Teste 1: Listando buckets...');
    const bucketsCommand = new ListBucketsCommand({});
    const bucketsData = await s3Client.send(bucketsCommand);
    console.log('✅ Buckets encontrados:', bucketsData.Buckets.map(b => b.Name));
    
    // Teste 2: Verificar bucket sunshine-photos
    console.log('\n📁 Teste 2: Verificando bucket sunshine-photos...');
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      MaxKeys: 5
    });
    const listData = await s3Client.send(listCommand);
    console.log('✅ Bucket acessível!');
    console.log('📊 Objetos no bucket:', listData.KeyCount || 0);
    
    console.log('\n🎉 SUCESSO! R2 está configurado corretamente!');
    
  } catch (error) {
    console.error('❌ ERRO na conexão:', error.message);
    console.error('Detalhes:', error);
  }
}

// Executar teste
testConnection();
