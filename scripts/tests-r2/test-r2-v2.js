// test-r2-v2.js
require('dotenv').config();
const { S3Client, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

console.log('🔍 Verificando variáveis de ambiente:');
console.log('Endpoint:', process.env.R2_ENDPOINT);
console.log('Bucket:', process.env.R2_BUCKET_NAME);
console.log('Access Key (8 chars):', process.env.R2_ACCESS_KEY_ID?.substring(0, 8) + '...');
console.log('Secret Key existe?', !!process.env.R2_SECRET_ACCESS_KEY);
console.log('');

// Configuração MAIS ESPECÍFICA para R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  signatureVersion: 'v4'
});

async function testConnection() {
  console.log('🔄 Testando conexão com R2 (v2)...\n');
  
  try {
    // Teste mais simples - direto no bucket
    console.log('📁 Listando objetos no bucket sunshine-photos...');
    const listCommand = new ListObjectsV2Command({
      Bucket: 'sunshine-photos',
      MaxKeys: 1
    });
    
    const response = await s3Client.send(listCommand);
    console.log('✅ SUCESSO! Conectou ao R2!');
    console.log('📊 Objetos no bucket:', response.KeyCount || 0);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.$metadata) {
      console.error('Status HTTP:', error.$metadata.httpStatusCode);
    }
  }
}

testConnection();
