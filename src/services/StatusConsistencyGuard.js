// src/services/StatusConsistencyGuard.js
// VERSÃO CORRIGIDA para funcionar com transações

class StatusConsistencyGuard {
    // Método atualizado para aceitar sessão de transação
    static async ensureConsistency(photoId, session = null) {
        const UnifiedProductComplete = require('../models/UnifiedProductComplete');

        // Se tiver sessão, usar ela. Se não, buscar normalmente
        const photo = session
            ? await UnifiedProductComplete.findById(photoId).session(session)
            : await UnifiedProductComplete.findById(photoId);

        if (!photo) return photo;

        // Se cdeStatus existe, sincronizar os outros com ele
        if (photo.cdeStatus) {
            const mapping = {
                'INGRESADO': 'available',
                'PRE-SELECTED': 'reserved',
                'CONFIRMED': 'in_selection',
                'RETIRADO': 'sold',
                'RESERVED': 'unavailable',
                'STANDBY': 'unavailable'
            };

            const correctStatus = mapping[photo.cdeStatus];

            // Só atualizar se estiver diferente
            if (photo.status !== correctStatus || photo.currentStatus !== correctStatus) {
                photo.status = correctStatus;
                photo.currentStatus = correctStatus;
                photo.virtualStatus.status = correctStatus;

                // Se tiver sessão, salvar com ela. Se não, salvar normal
                if (session) {
                    await photo.save({ session });
                } else {
                    await photo.save();
                }

                console.log(`[GUARD] Corrigido status de ${photo.fileName}: ${correctStatus}`);
            }
        }

        return photo; // Retornar o documento atualizado
    }

    // Resto do código permanece igual...
    static checkConsistency(photo) {
        const issues = [];

        if (photo.status !== photo.currentStatus) {
            issues.push(`status (${photo.status}) ≠ currentStatus (${photo.currentStatus})`);
        }

        if (photo.cdeStatus) {
            const expectedStatus = this.mapCDEToInternal(photo.cdeStatus);
            if (photo.status !== expectedStatus) {
                issues.push(`status (${photo.status}) não corresponde ao cdeStatus (${photo.cdeStatus})`);
            }
        }

        return issues;
    }

    static mapCDEToInternal(cdeStatus) {
        const mapping = {
            'INGRESADO': 'available',
            'PRE-SELECTED': 'reserved',
            'CONFIRMED': 'in_selection',
            'RETIRADO': 'sold',
            'RESERVED': 'unavailable',
            'STANDBY': 'unavailable'
        };
        return mapping[cdeStatus] || 'available';
    }
}

module.exports = StatusConsistencyGuard;