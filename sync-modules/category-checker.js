const readline = require('readline');

class CategoryChecker {
    constructor() {
        this.PhotoCategory = require('../src/models/PhotoCategory');
    }

    ask(question) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(resolve => {
            rl.question(question, answer => {
                rl.close();
                resolve(answer);
            });
        });
    }

    async checkAndCreateCategories(photos) {
        console.log('\nVerificando categorias...');

        // ===== CORREÇÃO: Normalizar categorias antes de comparar =====
        const normalizeCategory = (cat) => {
            if (!cat) return 'uncategorized';
            return cat
                .replace(/\//g, ' → ')       // Converter / para →
                .replace(/\\/g, ' → ')       // Converter \ para → (WINDOWS)
                .replace(/\s*→\s*$/g, '')    // Remover → vazia no final
                .trim();
        };
        const photoCategories = [...new Set(photos.map(p => normalizeCategory(p.category)))];
        // ===== FIM DA CORREÇÃO =====

        const registered = await this.PhotoCategory.find({});
        const registeredNames = new Set(registered.map(cat => cat.displayName));
        const newCategories = photoCategories.filter(cat => !registeredNames.has(cat));

        if (newCategories.length === 0) {
            console.log('   Todas as categorias ja existem\n');
            return true;
        }

        console.log(`\nNOVAS CATEGORIAS DETECTADAS: ${newCategories.length}\n`);

        for (const catDisplay of newCategories) {
            const photoCount = photos.filter(p => normalizeCategory(p.category) === catDisplay).length;

            console.log('='.repeat(60));
            console.log(`Categoria: ${catDisplay}`);
            console.log(`Fotos: ${photoCount}`);
            console.log();

            const qbCode = await this.ask('QB Code: ');

            if (!qbCode || qbCode.trim() === '') {
                console.log('QB Code obrigatorio! Categoria nao sera criada.\n');
                return false;
            }

            const priceInput = await this.ask('Preco base (Enter = 100): ');
            const basePrice = parseFloat(priceInput) || 100;

            const googleDrivePath = catDisplay.replace(/ → /g, '/') + '/';

            try {
                const newCat = new this.PhotoCategory({
                    googleDriveId: googleDrivePath,
                    googleDrivePath: googleDrivePath,
                    displayName: catDisplay,
                    qbItem: qbCode.trim().toUpperCase(),
                    folderName: catDisplay.split(' → ').pop(),
                    photoCount: photoCount,
                    basePrice: basePrice,
                    pricingMode: 'base',
                    isActive: true,
                    metadata: {
                        level: (catDisplay.match(/→/g) || []).length + 1,
                        parentIds: []
                    }
                });

                await newCat.save();
                console.log(`Categoria criada: ${newCat.qbItem} - $${newCat.basePrice}\n`);

            } catch (error) {
                console.error(`Erro ao criar: ${error.message}\n`);
                return false;
            }
        }

        return true;
    }
}

module.exports = CategoryChecker;