// test-r2-bucket.js
require('dotenv').config();
const { S3Client, ListObjectsV2Command, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true
});

async function testBucket() {
  console.log('🔄 Testando acesso ao bucket sunshine-photos...\n');
  
  try {
    // Teste 1: Listar objetos (não buckets!)
    console.log('📁 Listando objetos no bucket...');
    const listCommand = new ListObjectsV2Command({
      Bucket: 'sunshine-photos',
      MaxKeys: 5
    });
    
    const listResult = await s3Client.send(listCommand);
    console.log('✅ Listagem funcionou!');
    console.log('📊 Objetos encontrados:', listResult.KeyCount || 0);
    
    // Teste 2: Upload de teste
    console.log('\n📤 Testando upload...');
    const uploadCommand = new PutObjectCommand({
      Bucket: 'sunshine-photos',
      Key: 'test/connection-test.txt',
      Body: 'Teste de conexão R2 - ' + new Date().toISOString(),
      ContentType: 'text/plain'
    });
    
    await s3Client.send(uploadCommand);
    console.log('✅ Upload funcionou!');
    
    console.log('\n🎉 SUCESSO TOTAL! R2 configurado corretamente!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Código:', error.Code);
    console.error('Status:', error.$metadata?.httpStatusCode);
  }
}

testBucket();
