// Adicionar ao src/routes/gallery.js

// ADICIONAR NO FINAL DO ARQUIVO, ANTES DO module.exports

// Endpoint para limpar cache manualmente
router.post('/clear-cache', verifyClientToken, async (req, res) => {
    try {
        // Verificar se é admin
        if (!req.client || req.client.accessType !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Only admins can clear cache'
            });
        }

        // Limpar todo o cache
        const cacheSize = structureCache.size;
        structureCache.clear();

        console.log(`🧹 Cache limpo: ${cacheSize} entradas removidas`);

        res.json({
            success: true,
            message: `Cache cleared: ${cacheSize} entries removed`
        });

    } catch (error) {
        console.error('❌ Erro ao limpar cache:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// OU endpoint GET para usar no navegador
router.get('/clear-cache', verifyClientToken, async (req, res) => {
    try {
        // Verificar se é admin
        if (!req.client || req.client.accessType !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Only admins can clear cache'
            });
        }

        // Limpar todo o cache
        const cacheSize = structureCache.size;
        structureCache.clear();

        console.log(`🧹 Cache limpo: ${cacheSize} entradas removidas`);

        res.json({
            success: true,
            message: `Cache cleared successfully`,
            entriesRemoved: cacheSize
        });

    } catch (error) {
        console.error('❌ Erro ao limpar cache:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

console.log('✅ Endpoint /api/gallery/clear-cache adicionado');
