// ADICIONE ISSO EM src/routes/admin-selections.js

/**
 * POST /api/selections/:selectionId/revert-sold
 * Reverter fotos vendidas para disponível
 */
router.post('/:selectionId/revert-sold', async (req, res) => {
    const session = await mongoose.startSession();
    
    try {
        return await session.withTransaction(async () => {
            const { selectionId } = req.params;
            const { adminUser, reason } = req.body;
            
            console.log(`🔄 Revertendo seleção ${selectionId} de SOLD para AVAILABLE...`);
            
            // 1. Buscar seleção
            const selection = await Selection.findOne({ selectionId }).session(session);
            
            if (!selection) {
                return res.status(404).json({
                    success: false,
                    message: 'Seleção não encontrada'
                });
            }
            
            if (selection.status !== 'finalized') {
                return res.status(400).json({
                    success: false,
                    message: 'Apenas seleções finalizadas podem ser revertidas'
                });
            }
            
            // 2. Usar PhotoTagService para reverter
            const driveFileIds = selection.items.map(item => item.driveFileId);
            
            // Reverter tags
            const result = await PhotoStatus.updateMany(
                { photoId: { $in: driveFileIds } },
                {
                    $set: {
                        'virtualStatus.status': 'available',
                        'virtualStatus.currentSelection': null,
                        'virtualStatus.clientCode': null
                    },
                    $pull: {
                        'virtualStatus.tags': { $in: ['sold', 'reserved', /^client_/, /^selection_/] }
                    },
                    $push: {
                        'virtualStatus.tags': 'available'
                    }
                }
            ).session(session);
            
            // 3. Atualizar produtos
            await Product.updateMany(
                { driveFileId: { $in: driveFileIds } },
                { $set: { status: 'available' } }
            ).session(session);
            
            // 4. Atualizar seleção
            selection.status = 'reverted';
            selection.addMovementLog('reverted', `Revertida por ${adminUser}: ${reason}`);
            await selection.save({ session });
            
            console.log(`✅ ${result.modifiedCount} fotos revertidas para AVAILABLE`);
            
            res.json({
                success: true,
                message: `${result.modifiedCount} fotos revertidas com sucesso`,
                selection: selection.getSummary()
            });
        });
        
    } catch (error) {
        console.error('❌ Erro ao reverter seleção:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao reverter seleção',
            error: error.message
        });
    } finally {
        await session.endSession();
    }
});
