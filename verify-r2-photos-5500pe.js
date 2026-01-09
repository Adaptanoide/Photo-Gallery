require('dotenv').config();
const { S3Client, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function verifyR2Photos() {
    console.log('🔍 VERIFICANDO FOTOS 5500PE NO R2 (CLOUDFLARE)\n');
    console.log('='.repeat(70) + '\n');

    try {
        // Configurar S3 Client para R2
        const s3Client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
        });

        const bucketName = process.env.R2_BUCKET_NAME;
        console.log(`📦 Bucket: ${bucketName}\n`);

        // Fotos a verificar
        const photoNumbers = ['25651', '31122', '31125', '31126', '31142'];
        const basePath = 'Cowhide Hair On BRA With Leather Binding And Lined/Palomino Exotic/';

        console.log('📸 Verificando fotos individuais:\n');

        let found = 0;
        let notFound = 0;

        for (const photoNum of photoNumbers) {
            const fileName = `5500PE_${photoNum}.webp`;
            const fullPath = basePath + fileName;

            try {
                const command = new HeadObjectCommand({
                    Bucket: bucketName,
                    Key: fullPath
                });

                const response = await s3Client.send(command);

                console.log(`✅ ${photoNum} - ENCONTRADA`);
                console.log(`   Path: ${fullPath}`);
                console.log(`   Tamanho: ${(response.ContentLength / 1024).toFixed(2)} KB`);
                console.log(`   Tipo: ${response.ContentType}`);
                console.log(`   Última modificação: ${response.LastModified}`);
                console.log('');

                found++;

            } catch (error) {
                if (error.name === 'NotFound') {
                    console.log(`❌ ${photoNum} - NÃO ENCONTRADA no R2`);
                    console.log(`   Path esperado: ${fullPath}`);
                    console.log('');
                    notFound++;
                } else {
                    console.log(`⚠️  ${photoNum} - ERRO ao verificar: ${error.message}`);
                    console.log('');
                }
            }
        }

        // Listar TODAS as fotos na pasta
        console.log('='.repeat(70));
        console.log('📂 Listando TODOS os arquivos na pasta:\n');

        try {
            const listCommand = new ListObjectsV2Command({
                Bucket: bucketName,
                Prefix: basePath,
                MaxKeys: 100
            });

            const listResponse = await s3Client.send(listCommand);

            if (listResponse.Contents && listResponse.Contents.length > 0) {
                console.log(`Total de arquivos: ${listResponse.Contents.length}\n`);

                listResponse.Contents.forEach(obj => {
                    const fileName = obj.Key.replace(basePath, '');
                    const size = (obj.Size / 1024).toFixed(2);
                    console.log(`   📄 ${fileName.padEnd(25)} | ${size.padStart(8)} KB | ${obj.LastModified}`);
                });
            } else {
                console.log('⚠️  Pasta vazia ou não existe!\n');
            }

        } catch (listError) {
            console.log(`❌ Erro ao listar pasta: ${listError.message}\n`);
        }

        // RESUMO
        console.log('\n' + '='.repeat(70));
        console.log('📊 RESUMO:\n');
        console.log(`   ✅ Fotos encontradas: ${found}`);
        console.log(`   ❌ Fotos não encontradas: ${notFound}`);
        console.log(`   📊 Total verificadas: ${photoNumbers.length}`);
        console.log('\n' + '='.repeat(70) + '\n');

        if (notFound > 0) {
            console.log('💡 PRÓXIMOS PASSOS:\n');
            console.log('   1. Verificar se as fotos existem no Google Drive');
            console.log('   2. Fazer upload manual das fotos para o R2');
            console.log('   3. Ou executar script de migração do Google Drive para R2\n');
        }

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

verifyR2Photos();
