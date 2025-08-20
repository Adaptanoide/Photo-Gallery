// scripts/pricing/cadastrar-precos-r2.js
require('dotenv').config();
const mongoose = require('mongoose');
const PhotoCategory = require('../../src/models/PhotoCategory');

// TABELA DE PREÇOS ATUALIZADA - AGOSTO 2025
const TABELA_PRECOS = {
    // ============ COLOMBIAN COWHIDES ============
    'Colombian Cowhides': [
        { pattern: 'Medium.*Brown & White M', price: 105 },
        { pattern: 'Medium.*Exotic M', price: 105 },
        { pattern: 'Medium.*Tricolor Mix M', price: 105 },
        { pattern: 'Large.*Black & White L', price: 119 },
        { pattern: 'Large.*Brindle Mix L', price: 119 },
        { pattern: 'Large.*Tricolor Clouded L', price: 125 },
        { pattern: 'Large.*Tricolor Mix L', price: 119 },
        { pattern: 'Large.*Tricolor Spotted L', price: 119 },
        { pattern: 'X-Large.*Tricolor Clouded XL', price: 125 },
        { pattern: 'X-Large.*Tricolor Mix XL', price: 125 },
        { pattern: 'X-Large.*Tricolor Spotted XL', price: 125 },
        { pattern: 'Value Tricolor.*L-XL', price: 99 },
    ],

    // ============ BRAZIL BEST SELLERS ============
    'Brazil Best Sellers': [
        { pattern: 'Super Promo XS', price: 85 },
        { pattern: 'Super Promo Small', price: 89 },
        { pattern: 'Best Value.*Brindle.*ML-XL', price: 99 },
        { pattern: 'Best Value.*Salt & Pepper.*Black & White', price: 99 },
        { pattern: 'Best Value.*Salt & Pepper.*Brown.*Tricolor', price: 99 },
        { pattern: 'Best Value.*Salt & Pepper.*Chocolate', price: 99 },
        { pattern: 'Dark Tones Mix ML-XL', price: 105 },
        { pattern: 'Light Tones Mix ML-XL', price: 149 },
        { pattern: 'Exotic Tones ML-XL', price: 109 },
        { pattern: 'Tannery Run.*SMALL', price: 99 },
        { pattern: 'Tannery Run.*ML.*XL', price: 109 },
    ],

    // ============ BRAZIL TOP SELECTED - SMALL ============
    'Brazil Top Selected.*Small': [
        { pattern: 'Hereford Small', price: 109 },
        { pattern: 'Palomino Exotic Small', price: 109 },
        { pattern: 'Brindle Medium Tone Small', price: 109 },
        { pattern: 'Brindle White Belly Small', price: 119 },
        { pattern: 'Brindle White Backbone Small', price: 139 },
        { pattern: 'Champagne Small', price: 119 },
        { pattern: 'Taupe Small', price: 119 },
        { pattern: 'Black & White Reddish Small', price: 119 },
        { pattern: 'Black & White Small', price: 139 },
        { pattern: 'Salt & Pepper.*Black.*Small', price: 139 },
        { pattern: 'Salt & Pepper.*Tricolor.*Brown.*Small', price: 139 },
        { pattern: 'Grey Small', price: 159 },
        { pattern: 'Grey Beige Small', price: 159 },
        { pattern: 'Brindle Light Grey.*Small', price: 159 },
        { pattern: 'Brindle Grey Small', price: 159 },
        { pattern: 'Natural White Small', price: 399 },
        { pattern: 'Tricolor Small', price: 139 },
        { pattern: 'Brown & White Small', price: 139 },
    ],

    // ============ BRAZIL TOP SELECTED - MEDIUM LARGE ============
    'Brazil Top Selected.*Medium Large': [
        { pattern: 'Hereford ML', price: 119 },
        { pattern: 'Palomino Exotic ML', price: 119 },
        { pattern: 'Palomino ML', price: 119 },
        { pattern: 'Brindle White Belly ML', price: 129 },
        { pattern: 'Brindle White Backbone ML', price: 159 },
        { pattern: 'Black & White Reddish ML', price: 149 },
        { pattern: 'Black & White ML', price: 149 },
        { pattern: 'Taupe ML', price: 149 },
        { pattern: 'Grey Beige ML', price: 169 },
        { pattern: 'Champagne ML', price: 169 },
        { pattern: 'Buttercream ML', price: 169 },
        { pattern: 'Salt & Pepper.*Tricolor.*Brown.*ML', price: 179 },
        { pattern: 'Salt & Pepper.*Tricolor.*Brown.*Medium', price: 179 },
        { pattern: 'Salt & Pepper Black.*ML', price: 179 },
        { pattern: 'Salt & Pepper Chocolate.*ML', price: 179 },
        { pattern: 'Brown & White ML', price: 189 },
        { pattern: 'Brindle Light Grey.*ML', price: 199 },
        { pattern: 'Grey ML', price: 199 },
        { pattern: 'Brindle Grey ML', price: 219 },
        { pattern: 'Natural White ML', price: 399 },
        { pattern: 'Tricolor ML', price: 179 },
    ],

    // ============ BRAZIL TOP SELECTED - EXTRA LARGE ============
    'Brazil Top Selected.*Extra Large': [
        { pattern: 'Hereford XL', price: 129 },
        { pattern: 'Palomino Exotic XL', price: 129 },
        { pattern: 'Brindle White Belly XL', price: 139 },
        { pattern: 'Brindle White Backbone XL', price: 169 },
        { pattern: 'Black & White Reddish XL', price: 159 },
        { pattern: 'Black & White XL', price: 159 },
        { pattern: 'Taupe XL', price: 159 },
        { pattern: 'Grey Beige XL', price: 179 },
        { pattern: 'Champagne XL', price: 179 },
        { pattern: 'Salt & Pepper.*Tricolor.*Brown.*XL', price: 189 },
        { pattern: 'Salt & Pepper Black.*XL', price: 189 },
        { pattern: 'Salt & Pepper Chocolate.*XL', price: 189 },
        { pattern: 'Brown & White XL', price: 199 },
        { pattern: 'Brindle Light Grey.*XL', price: 209 },
        { pattern: 'Grey XL', price: 209 },
        { pattern: 'Brindle Grey XL', price: 229 },
        { pattern: 'Natural White XL', price: 419 },
        { pattern: 'Tricolor XL', price: 189 },
    ],

    // ============ RODEO RUGS ============
    'Rodeo Rugs': [
        { pattern: '3.*x 5.*Star & Longhorns', price: 79 },
        { pattern: '3.*x 5.*Star', price: 79 },
        { pattern: '40.*Round.*Single Star', price: 59 },
        { pattern: '60.*Round.*Multi Star', price: 109 },
        { pattern: '60.*Round Rug', price: 109 },
    ],

    // ============ OUTROS PRODUTOS ============
    'Calfskins': [
        { pattern: 'Metallica Silver', price: 45 },
    ],

    'Sheepskins': [
        { pattern: 'Himalayan Exotic', price: 49 },
        { pattern: 'Tibetan Exotic', price: 49 },
    ],
};

async function cadastrarPrecosR2() {
    console.log('💰 CADASTRO DE PREÇOS EM MASSA - SISTEMA R2\n');
    console.log('📅 Tabela de preços: AGOSTO 2025\n');
    console.log('═'.repeat(60) + '\n');

    await mongoose.connect(process.env.MONGODB_URI);

    // Buscar todas as categorias sem preço
    const categoriasSemPreco = await PhotoCategory.find({
        isActive: true,
        $or: [
            { basePrice: 0 },
            { basePrice: null },
            { basePrice: { $exists: false } }
        ]
    });

    console.log(`📊 Categorias sem preço: ${categoriasSemPreco.length}`);

    // Buscar todas as categorias (para relatório completo)
    const todasCategorias = await PhotoCategory.countDocuments({ isActive: true });
    console.log(`📊 Total de categorias ativas: ${todasCategorias}\n`);
    console.log('═'.repeat(60) + '\n');

    let sucesso = 0;
    let erro = 0;
    let semRegra = [];

    // Processar cada categoria sem preço
    for (const categoria of categoriasSemPreco) {
        const nome = categoria.displayName;
        let precoEncontrado = null;
        let regraUsada = '';

        // Procurar preço nas regras
        for (const [grupoKey, regras] of Object.entries(TABELA_PRECOS)) {
            // Verificar se o nome contém o grupo
            const grupoRegex = new RegExp(grupoKey, 'i');
            if (grupoRegex.test(nome)) {
                // Testar cada padrão do grupo
                for (const regra of regras) {
                    const padraoRegex = new RegExp(regra.pattern, 'i');
                    if (padraoRegex.test(nome)) {
                        precoEncontrado = regra.price;
                        regraUsada = `${grupoKey} → ${regra.pattern}`;
                        break;
                    }
                }
            }
            if (precoEncontrado) break;
        }

        if (precoEncontrado) {
            // Atualizar categoria
            categoria.basePrice = precoEncontrado;
            categoria.pricingMode = 'base';

            // Adicionar ao histórico de preços
            if (!categoria.priceHistory) categoria.priceHistory = [];
            categoria.priceHistory.push({
                oldPrice: 0,
                newPrice: precoEncontrado,
                changedBy: 'script-cadastro-massa',
                changedAt: new Date(),
                reason: 'Cadastro em massa via script - Tabela Agosto 2025'
            });

            await categoria.save();

            const nomeSimples = nome.split('→').pop().trim();
            console.log(`✅ ${nomeSimples}`);
            console.log(`   💵 Preço: $${precoEncontrado}`);
            console.log(`   📋 Regra aplicada: ${regraUsada}\n`);

            sucesso++;
        } else {
            semRegra.push(nome);
        }
    }

    // Estatísticas finais
    const categoriasComPreco = await PhotoCategory.countDocuments({
        isActive: true,
        basePrice: { $gt: 0 }
    });

    // Resumo final
    console.log('═'.repeat(60));
    console.log('📊 RESUMO FINAL');
    console.log('═'.repeat(60));
    console.log(`\n✅ Categorias atualizadas agora: ${sucesso}`);
    console.log(`❌ Categorias sem regra encontrada: ${semRegra.length}`);
    console.log(`\n📈 STATUS GERAL:`);
    console.log(`   Total de categorias: ${todasCategorias}`);
    console.log(`   Com preço: ${categoriasComPreco}`);
    console.log(`   Sem preço: ${todasCategorias - categoriasComPreco}`);
    console.log(`   Porcentagem com preço: ${((categoriasComPreco / todasCategorias) * 100).toFixed(1)}%`);

    if (semRegra.length > 0) {
        console.log('\n⚠️  CATEGORIAS QUE PRECISAM DE PREÇO MANUAL:');
        console.log('─'.repeat(40));
        semRegra.forEach((cat, i) => {
            const nomeSimples = cat.split('→').slice(-2).join(' → ');
            console.log(`${(i + 1).toString().padStart(2, '0')}. ${nomeSimples}`);
        });

        // Salvar em arquivo
        const fs = require('fs');
        const conteudo = `CATEGORIAS SEM PREÇO - ${new Date().toLocaleString('pt-BR')}\n` +
            '═'.repeat(60) + '\n\n' +
            semRegra.map((cat, i) => `${i + 1}. ${cat}`).join('\n');

        fs.writeFileSync('categorias-sem-preco.txt', conteudo);
        console.log('\n💾 Lista completa salva em: categorias-sem-preco.txt');
    } else {
        console.log('\n🎉 EXCELENTE! Todas as categorias têm preço!');
    }

    console.log('\n✨ Script finalizado com sucesso!\n');

    mongoose.connection.close();
}

// Executar com confirmação
console.clear();
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           CADASTRO DE PREÇOS EM MASSA - R2                ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');
console.log('⚠️  ATENÇÃO: Este script vai cadastrar preços no banco de dados!');
console.log('📋 Baseado no PDF: Sunshine Cowhides - Agosto 2025');
console.log('🎯 Sistema: R2 (Cloudflare)');
console.log('💡 QB Items: Serão cadastrados manualmente via interface\n');
console.log('Pressione Ctrl+C para cancelar ou aguarde 3 segundos...\n');

setTimeout(() => {
    cadastrarPrecosR2().catch(console.error);
}, 3000);