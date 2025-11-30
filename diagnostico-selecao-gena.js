/**
 * SCRIPT DE DIAGNÓSTICO - ANALISAR SELEÇÃO DA GENA
 * 
 * Este script APENAS LÊ dados, não modifica nada.
 * Objetivo: Analisar a seleção PENDING da GENA e verificar estado das fotos no CDE
 * 
 * Executar: node diagnostico-selecao-gena.js
 */

const mongoose = require('mongoose');
const mysql = require('mysql2/promise');

// Configurações
const MONGODB_URI = 'mongodb+srv://easyadmin:2NwxuiOlK57wH8cY@cluster.tsbl7y8.mongodb.net/sunshine_cowhides?retryWrites=true&w=majority&appName=Cluster';

const CDE_CONFIG = {
    host: '216.246.112.6',
    port: 3306,
    user: 'tzwgctib_photos',
    password: 'T14g0@photos',
    database: 'tzwgctib_inventario'
};

async function diagnostico() {
    let cdeConnection = null;
    
    try {
        console.log('\n' + '='.repeat(70));
        console.log('🔍 DIAGNÓSTICO: SELEÇÃO DA GENA');
        console.log('='.repeat(70));
        console.log(`📅 Data/Hora: ${new Date().toLocaleString()}`);
        console.log('');

        // ============================================
        // PARTE 1: Conectar ao MongoDB
        // ============================================
        console.log('🔌 Conectando ao MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB conectado!\n');

        // ============================================
        // PARTE 2: Buscar seleção da GENA
        // ============================================
        console.log('📋 PARTE 1: Buscando seleção da GENA...\n');
        
        const Selection = mongoose.connection.collection('selections');
        
        // Buscar seleções PENDING da GENA (por nome ou código)
        const selecoes = await Selection.find({
            $or: [
                { clientName: /gena/i },
                { clientCode: '5188' }
            ],
            status: 'pending'
        }).toArray();
        
        console.log(`📊 Encontradas ${selecoes.length} seleções PENDING da GENA\n`);
        
        if (selecoes.length === 0) {
            console.log('⚠️ Nenhuma seleção PENDING encontrada para GENA');
            console.log('   Buscando todas as seleções da GENA (qualquer status)...\n');
            
            const todasSelecoes = await Selection.find({
                $or: [
                    { clientName: /gena/i },
                    { clientCode: '5188' }
                ]
            }).toArray();
            
            if (todasSelecoes.length > 0) {
                console.log('Seleções encontradas:');
                todasSelecoes.forEach(s => {
                    console.log(`   - ${s.selectionId}: ${s.status} | ${s.totalItems} items | $${s.totalValue}`);
                });
            }
            
            await mongoose.disconnect();
            return;
        }
        
        // Usar a primeira seleção PENDING encontrada
        const selecao = selecoes[0];
        
        // ============================================
        // PARTE 3: Mostrar detalhes da seleção
        // ============================================
        console.log('='.repeat(70));
        console.log('📋 PARTE 2: DETALHES DA SELEÇÃO');
        console.log('='.repeat(70));
        console.log(`
🆔 Selection ID:    ${selecao.selectionId}
👤 Cliente:         ${selecao.clientName}
🔢 Código:          ${selecao.clientCode}
🏢 Empresa:         ${selecao.clientCompany || '-'}
👔 Vendedor:        ${selecao.salesRep || '-'}
📊 Status:          ${selecao.status}
📦 Total Items:     ${selecao.totalItems}
💰 Total Value:     $${selecao.totalValue?.toFixed(2) || '0.00'}
📅 Criada em:       ${new Date(selecao.createdAt).toLocaleString()}
`);

        // ============================================
        // PARTE 4: Listar fotos por categoria
        // ============================================
        console.log('='.repeat(70));
        console.log('📋 PARTE 3: FOTOS POR CATEGORIA');
        console.log('='.repeat(70));
        
        // Agrupar por categoria
        const fotosPorCategoria = {};
        selecao.items.forEach(item => {
            const cat = item.category || 'Sem categoria';
            if (!fotosPorCategoria[cat]) {
                fotosPorCategoria[cat] = [];
            }
            fotosPorCategoria[cat].push(item);
        });
        
        console.log('');
        Object.entries(fotosPorCategoria).forEach(([categoria, fotos]) => {
            const totalCategoria = fotos.reduce((sum, f) => sum + (f.price || 0), 0);
            console.log(`📁 ${categoria}`);
            console.log(`   Quantidade: ${fotos.length} | Total: $${totalCategoria.toFixed(2)}`);
            console.log('   Fotos:');
            fotos.forEach(foto => {
                const numero = foto.fileName?.replace('.webp', '') || 'N/A';
                console.log(`      - ${numero} | $${(foto.price || 0).toFixed(2)}`);
            });
            console.log('');
        });

        // ============================================
        // PARTE 5: Conectar ao CDE e verificar fotos
        // ============================================
        console.log('='.repeat(70));
        console.log('📋 PARTE 4: VERIFICAÇÃO NO CDE');
        console.log('='.repeat(70));
        
        console.log('\n🔌 Conectando ao CDE (MySQL)...');
        cdeConnection = await mysql.createConnection(CDE_CONFIG);
        console.log('✅ CDE conectado!\n');
        
        const clientCode = selecao.clientCode;
        console.log(`🔍 Verificando fotos para cliente código: ${clientCode}\n`);
        
        console.log('Foto #     | Estado CDE    | RESERVEDUSU                    | Pertence? | Ação');
        console.log('-'.repeat(95));
        
        let fotosOK = 0;
        let fotasProblema = 0;
        const problemasDetalhados = [];
        
        for (const item of selecao.items) {
            const photoNumber = item.fileName?.replace('.webp', '') || '';
            
            if (!photoNumber) {
                console.log(`(vazio)    | ERRO          | Sem número de foto             | ❓        | VERIFICAR`);
                continue;
            }
            
            // Buscar no CDE
            const [result] = await cdeConnection.execute(
                'SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
                [photoNumber]
            );
            
            if (result.length === 0) {
                const linha = `${photoNumber.padEnd(10)} | NÃO ENCONTRADA| -                              | ❌        | REMOVER`;
                console.log(linha);
                fotasProblema++;
                problemasDetalhados.push({
                    foto: photoNumber,
                    motivo: 'Foto não encontrada no CDE',
                    acao: 'REMOVER'
                });
                continue;
            }
            
            const cdeRecord = result[0];
            const estado = cdeRecord.AESTADOP || '(vazio)';
            const reservedusu = cdeRecord.RESERVEDUSU || '';
            
            // Verificar se pertence ao cliente
            const pertenceAoCliente = reservedusu.includes(`-${clientCode}`);
            
            // Determinar ação
            let pertence = '';
            let acao = '';
            
            if (estado === 'INGRESADO') {
                pertence = '❌';
                acao = 'REMOVER';
                fotasProblema++;
                problemasDetalhados.push({
                    foto: photoNumber,
                    estado: estado,
                    reservedusu: reservedusu,
                    motivo: 'Foto voltou para INGRESADO (foi liberada)',
                    acao: 'REMOVER'
                });
            } else if (estado === 'PRE-SELECTED' || estado === 'CONFIRMED' || estado === 'RESERVED') {
                if (pertenceAoCliente) {
                    pertence = '✅';
                    acao = 'MANTER';
                    fotosOK++;
                } else {
                    pertence = '❌';
                    acao = 'REMOVER';
                    fotasProblema++;
                    problemasDetalhados.push({
                        foto: photoNumber,
                        estado: estado,
                        reservedusu: reservedusu,
                        motivo: `RESERVEDUSU não contém código ${clientCode}`,
                        acao: 'REMOVER'
                    });
                }
            } else if (estado === 'RETIRADO') {
                pertence = '🤷';
                acao = 'IGNORAR';
                fotosOK++; // Contamos como OK pois não vamos remover
            } else if (estado === 'STANDBY') {
                pertence = '⚠️';
                acao = 'ALERTAR';
                problemasDetalhados.push({
                    foto: photoNumber,
                    estado: estado,
                    reservedusu: reservedusu,
                    motivo: 'Foto em STANDBY (indisponível)',
                    acao: 'ALERTAR'
                });
            } else {
                pertence = '❓';
                acao = 'VERIFICAR';
            }
            
            const estadoPadded = estado.padEnd(13);
            const reservedusuPadded = (reservedusu || '-').substring(0, 30).padEnd(30);
            console.log(`${photoNumber.padEnd(10)} | ${estadoPadded} | ${reservedusuPadded} | ${pertence}        | ${acao}`);
        }
        
        // ============================================
        // PARTE 6: Resumo
        // ============================================
        console.log('\n' + '='.repeat(70));
        console.log('📋 PARTE 5: RESUMO');
        console.log('='.repeat(70));
        console.log(`
📊 RESULTADO DA VERIFICAÇÃO:
   ✅ Fotos OK:        ${fotosOK}
   ❌ Fotos problema:  ${fotasProblema}
   📦 Total na seleção: ${selecao.items.length}
`);

        if (problemasDetalhados.length > 0) {
            console.log('⚠️ PROBLEMAS DETECTADOS:');
            problemasDetalhados.forEach((p, i) => {
                console.log(`
   ${i + 1}. Foto ${p.foto}:
      Estado: ${p.estado || 'N/A'}
      RESERVEDUSU: ${p.reservedusu || 'N/A'}
      Motivo: ${p.motivo}
      Ação sugerida: ${p.acao}
`);
            });
        } else {
            console.log('✅ NENHUM PROBLEMA DETECTADO!');
            console.log('   Todas as fotos estão corretas e pertencem ao cliente.');
        }

        // ============================================
        // PARTE 7: Simulação de recálculo (se houver problemas)
        // ============================================
        if (fotasProblema > 0) {
            console.log('='.repeat(70));
            console.log('📋 PARTE 6: SIMULAÇÃO DE RECÁLCULO');
            console.log('='.repeat(70));
            console.log(`
🔄 SE REMOVERMOS ${fotasProblema} FOTO(S):

   ANTES:
   - Total items: ${selecao.totalItems}
   - Total value: $${selecao.totalValue?.toFixed(2) || '0.00'}
   - Tier atual: ${selecao.totalItems >= 37 ? 'Tier 4 (37+)' : selecao.totalItems >= 13 ? 'Tier 3 (13-36)' : selecao.totalItems >= 6 ? 'Tier 2 (6-12)' : 'Tier 1 (1-5)'}

   DEPOIS (estimativa):
   - Total items: ${selecao.totalItems - fotasProblema}
   - Tier novo: ${(selecao.totalItems - fotasProblema) >= 37 ? 'Tier 4 (37+)' : (selecao.totalItems - fotasProblema) >= 13 ? 'Tier 3 (13-36)' : (selecao.totalItems - fotasProblema) >= 6 ? 'Tier 2 (6-12)' : 'Tier 1 (1-5)'}

   ⚠️ ATENÇÃO: Se mudar de tier, os preços de TODAS as fotos serão recalculados!
`);
        }

        console.log('='.repeat(70));
        console.log('✅ DIAGNÓSTICO CONCLUÍDO');
        console.log('='.repeat(70) + '\n');

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (cdeConnection) {
            await cdeConnection.end();
            console.log('🔌 Conexão CDE fechada.');
        }
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('🔌 Conexão MongoDB fechada.\n');
        }
    }
}

// Executar
diagnostico();