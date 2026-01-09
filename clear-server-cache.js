require('dotenv').config();
const http = require('http');
const https = require('https');

async function clearServerCache() {
    console.log('🧹 LIMPANDO CACHE DO SERVIDOR\n');
    console.log('='.repeat(80) + '\n');

    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    const isHttps = baseUrl.startsWith('https');
    const httpModule = isHttps ? https : http;

    // 1. Fazer request com nocache=true para forçar limpeza
    const paths = [
        '/api/gallery/structure?nocache=true',
        '/api/gallery/structure?prefix=Cowhide%20Hair%20On%20BRA%20With%20Leather%20Binding%20And%20Lined&nocache=true',
        '/api/gallery/photos?prefix=Cowhide%20Hair%20On%20BRA%20With%20Leather%20Binding%20And%20Lined/Palomino%20Exotic/&nocache=true'
    ];

    console.log(`🌐 Base URL: ${baseUrl}\n`);

    for (const path of paths) {
        try {
            const url = `${baseUrl}${path}`;
            console.log(`🔄 Limpando cache: ${path}`);

            await new Promise((resolve, reject) => {
                const req = httpModule.get(url, (res) => {
                    let data = '';

                    res.on('data', (chunk) => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            if (json.success) {
                                console.log(`   ✅ Cache limpo com sucesso`);
                                if (json.photos) {
                                    console.log(`   📸 ${json.photos.length} fotos encontradas`);
                                }
                                if (json.structure) {
                                    console.log(`   📂 ${json.structure.folders ? json.structure.folders.length : 0} pastas encontradas`);
                                }
                            } else {
                                console.log(`   ⚠️  Resposta: ${json.message || 'unknown'}`);
                            }
                        } catch (e) {
                            console.log(`   ⚠️  Resposta não-JSON ou erro: ${e.message}`);
                        }
                        resolve();
                    });
                });

                req.on('error', (error) => {
                    console.log(`   ❌ Erro: ${error.message}`);
                    resolve(); // Continue mesmo com erro
                });

                req.setTimeout(10000, () => {
                    console.log(`   ⏱️  Timeout`);
                    req.destroy();
                    resolve();
                });
            });

            console.log('');

        } catch (error) {
            console.error(`   ❌ Erro: ${error.message}\n`);
        }
    }

    console.log('='.repeat(80));
    console.log('\n💡 PRÓXIMOS PASSOS:\n');
    console.log('   1. Se o script falhou (servidor não está rodando):');
    console.log('      - Adicione ?nocache=true na URL da galeria manualmente');
    console.log('      - Exemplo: /gallery?nocache=true\n');
    console.log('   2. Se funcionou:');
    console.log('      - Acesse a galeria novamente (sem nocache)');
    console.log('      - Navegue até Palomino Exotic');
    console.log('      - Devem aparecer as 5 fotos agora!\n');
    console.log('   3. Alternativamente: REINICIE O SERVIDOR para limpar todo o cache\n');
    console.log('='.repeat(80) + '\n');
}

clearServerCache();
