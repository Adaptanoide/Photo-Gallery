// test-r2-minimal.js
require('dotenv').config();
const AWS = require('@aws-sdk/client-s3');

const client = new AWS.S3Client({
  endpoint: "https://07cf9ea2c821b24e386a498f5905bd2c.r2.cloudflarestorage.com",
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

// Teste direto no bucket
const command = new AWS.ListObjectsV2Command({
  Bucket: "sunshine-photos"
});

client.send(command)
  .then(data => console.log("✅ FUNCIONOU!", data))
  .catch(err => console.log("❌ Erro:", err.message));
