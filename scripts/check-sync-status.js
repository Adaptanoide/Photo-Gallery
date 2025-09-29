require('dotenv').config();
const mongoose = require('mongoose');

async function checkStatus() {
    console.log('\n=== VERIFICAÇÃO DE CONFIGURAÇÃO DE SYNC ===\n');
    
    // Verificar variáveis de ambiente
    console.log('📋 CONFIGURAÇÃO LOCAL:');
    console.log('   ENABLE_CDE_SYNC:', process.env.ENABLE_CDE_SYNC);
    console.log('   SYNC_MODE:', process.env.SYNC_MODE);
    console.log('   SYNC_INSTANCE_ID:', process.env.SYNC_INSTANCE_ID);
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    console.log('   SYNC_INTERVAL_MINUTES:', process.env.SYNC_INTERVAL_MINUTES);
    
    try {
        // Conectar ao MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('\n✅ Conectado ao MongoDB');
        
        // Verificar se há locks ativos
        const db = mongoose.connection.db;
        const lock = await db.collection('sync_locks').findOne({ _id: 'cde_sync' });
        
        if (lock) {
            console.log('\n🔒 LOCK ATIVO:');
            console.log('   Bloqueado por:', lock.lockedBy);
            console.log('   Bloqueado em:', lock.lockedAt);
            console.log('   Expira em:', lock.expiresAt);
            
            // Verificar se expirou
            if (new Date() > new Date(lock.expiresAt)) {
                console.log('   ⚠️  LOCK EXPIRADO - pode ser removido');
            }
        } else {
            console.log('\n✅ Nenhum lock ativo');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n=== FIM DA VERIFICAÇÃO ===\n');
    }
}

checkStatus();