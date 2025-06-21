// ===== AGRUPAMENTO DE CATEGORIAS POR NOME BASE =====

class CategoryGrouper {
    constructor() {
        this.groupedCategories = new Map();
    }

    // Extrair nome base da categoria (remover tamanho)
    extractBaseName(categoryName) {
        // Para Brazil: remover XL, ML, Small do final
        let baseName = categoryName;

        // Remover tamanhos do final
        baseName = baseName.replace(/\s+(XL|ML|Small)$/, '');

        // Remover "Brazil" do início para simplificar
        baseName = baseName.replace(/^Brazil\s+/, '');

        return baseName.trim();
    }

    // Extrair tamanho da categoria
    extractSize(categoryName) {
        if (categoryName.includes(' XL')) return 'Extra Large';
        if (categoryName.includes(' ML')) return 'Medium Large';
        if (categoryName.includes(' Small')) return 'Small';
        return 'Unknown';
    }

    // Agrupar categorias por nome base
    groupBrazilTopSelectedCategories(categories) {
        console.log('🔄 Agrupando categorias Brazil Top Selected...');

        const grouped = new Map();

        // ✅ FILTRO MELHORADO: Apenas categorias que realmente pertencem ao Brazil Top Selected
        const brazilCategories = categories.filter(cat => {
            const name = cat.name;

            // Deve incluir "Brazil" e ter tamanhos
            const hasBrazil = name.includes('Brazil');
            const hasSize = name.includes(' XL') || name.includes(' ML') || name.includes(' Small');

            // NÃO deve incluir essas palavras-chave (são do Brazil Best Sellers)
            const isBestSellers = name.includes('Best Value') ||
                name.includes('Super Promo') ||
                name.includes('Dark Tones Mix') ||
                name.includes('Light Tones Mix') ||
                name.includes('Exotic Tones');

            // ✅ ADICIONAR: Deve ser especificamente do Top Selected
            // Assumindo que as categorias do Top Selected têm padrões específicos
            const isTopSelected = !isBestSellers && hasBrazil && hasSize;

            console.log(`📝 Verificando: ${name} -> ${isTopSelected ? 'INCLUIR' : 'EXCLUIR'}`);

            return isTopSelected;
        });

        console.log(`📊 Categorias Brazil Top Selected filtradas: ${brazilCategories.length}`);

        // Agrupar por nome base
        brazilCategories.forEach(category => {
            const baseName = this.extractBaseName(category.name);
            const size = this.extractSize(category.name);

            if (!grouped.has(baseName)) {
                grouped.set(baseName, {
                    baseName: baseName,
                    displayName: baseName,
                    categories: [],
                    sizes: new Set(),
                    // ✅ ADICIONAR: Estrutura que o sidebar espera
                    id: `group-${baseName.toLowerCase().replace(/\s+/g, '-')}`,
                    name: baseName,
                    isGroup: true
                });
            }

            const group = grouped.get(baseName);
            group.categories.push(category);
            group.sizes.add(size);
        });

        // Converter para array e ordenar
        const groupedArray = Array.from(grouped.values()).map(group => ({
            ...group,
            sizes: Array.from(group.sizes).sort((a, b) => {
                const order = ['Small', 'Medium Large', 'Extra Large'];
                return order.indexOf(a) - order.indexOf(b);
            })
        }));

        console.log('📂 Grupos Brazil Top Selected criados:');
        groupedArray.forEach(group => {
            console.log(`  ${group.displayName}: ${group.sizes.length} tamanhos, ${group.categories.length} categorias`);
        });

        return groupedArray;
    }

    // Obter categorias de um grupo específico por tamanho
    getCategoriesForGroupAndSize(group, size) {
        return group.categories.filter(cat => this.extractSize(cat.name) === size);
    }

    // Debug: mostrar estrutura de agrupamento
    debugGroupStructure(groups) {
        console.log('🔍 Estrutura de agrupamento:');
        groups.forEach(group => {
            console.log(`\n📁 ${group.displayName}:`);
            group.sizes.forEach(size => {
                const categoriesForSize = this.getCategoriesForGroupAndSize(group, size);
                console.log(`  ${size}: ${categoriesForSize.length} categorias`);
                categoriesForSize.slice(0, 2).forEach(cat => {
                    console.log(`    - ${cat.name}`);
                });
            });
        });
    }
}

// Instância global
const categoryGrouper = new CategoryGrouper();
window.categoryGrouper = categoryGrouper;