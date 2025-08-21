require('dotenv').config();
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function countAllR2() {
    const client = new S3Client({
        region: 'auto',
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
        credentials: {
            accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
        }
    });
    
    console.log('\n📊 CONTANDO TODAS AS FOTOS NO R2:\n');
    
    let continuationToken;
    let totalFiles = 0;
    let webpFiles = 0;
    let thumbnails = 0;
    
    do {
        const command = new ListObjectsV2Command({
            Bucket: 'sunshine-photos',
            ContinuationToken: continuationToken
        });
        
        const response = await client.send(command);
        
        if (response.Contents) {
            for (const obj of response.Contents) {
                totalFiles++;
                
                if (obj.Key.includes('_thumbnails/')) {
                    thumbnails++;
                } else if (obj.Key.endsWith('.webp')) {
                    webpFiles++;
                    
                    // Mostrar alguns exemplos
                    if (webpFiles <= 5 || webpFiles % 500 === 0) {
                        console.log(`   ${webpFiles}: ${obj.Key}`);
                    }
                }
            }
        }
        
        continuationToken = response.NextContinuationToken;
        
    } while (continuationToken);
    
    console.log('\n📊 TOTAIS:');
    console.log(`   Total de arquivos: ${totalFiles}`);
    console.log(`   Fotos WebP: ${webpFiles}`);
    console.log(`   Thumbnails: ${thumbnails}`);
    console.log(`   Outros: ${totalFiles - webpFiles - thumbnails}`);
}

countAllR2();
