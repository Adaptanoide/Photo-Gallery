// ======= SISTEMA DE NAVEGAÇÃO SIMPLES =======
// Substitui o sidebar.js gigante por algo limpo

console.log('🔧 Simple Navigation System carregado');

// Configuração
const SIMPLE_NAV = {
    enabled: false, // Mudar para true quando quiser testar
    debugMode: true
};

// Cache simples
let simpleCategories = [];
let simplePhotos = [];

// ===== FUNÇÃO PRINCIPAL =====
async function initSimpleNavigation() {
    if (!SIMPLE_NAV.enabled) {
        console.log('📋 Simple Navigation desabilitado - usando sistema atual');
        return;
    }

    console.log('🚀 Iniciando Simple Navigation System');

    try {
        // Carregar categorias
        await loadSimpleCategories();

        // Renderizar interface simples
        renderSimpleInterface();

        console.log('✅ Simple Navigation inicializado com sucesso');
    } catch (error) {
        console.error('❌ Erro no Simple Navigation:', error);
        console.log('🔄 Fallback para sistema atual');
    }
}

// ===== CARREGAR CATEGORIAS =====
async function loadSimpleCategories() {
    console.log('📂 Carregando categorias...');

    const response = await fetch(`/api/client/initial-data?code=${currentCustomerCode}`);
    const data = await response.json();

    if (data.success && data.categories) {
        simpleCategories = data.categories.filter(cat => !cat.isAll);
        console.log(`📊 ${simpleCategories.length} categorias carregadas`);
        return simpleCategories;
    }

    throw new Error('Falha ao carregar categorias');
}

// ===== RENDERIZAR INTERFACE SIMPLES =====
function renderSimpleInterface() {
    console.log('🎨 Renderizando interface simples');

    // Só renderizar se estivermos na home
    const breadcrumb = document.getElementById('breadcrumb-container');
    if (breadcrumb && breadcrumb.textContent.includes('Choose a category')) {
        renderSimpleHome();
    } else {
        console.log('🏠 Não estamos na home - não renderizando');
        // Se não estiver na home, forçar ir para home simples
        renderSimpleHome();
    }
}

// ===== HOME SIMPLES ===== (FUNÇÃO ESTAVA FALTANDO!)
function renderSimpleHome() {
    console.log('🏠 Renderizando home simples');

    const contentDiv = document.getElementById('content');
    if (!contentDiv) {
        console.error('❌ Elemento #content não encontrado');
        return;
    }

    // Agrupar por categoria principal
    const mainCategories = groupByMainCategory(simpleCategories);

    let html = `
        <div style="padding: 20px; text-align: center; background: #f8f9fa; margin: 20px; border-radius: 10px;">
            <h1 style="color: #333;">🎯 SISTEMA SIMPLES (TESTE)</h1>
            <p style="color: #666;">Versão de teste - ${Object.keys(mainCategories).length} categorias principais</p>
            <p style="color: #666;">${simpleCategories.length} subcategorias total</p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0;">
    `;

    Object.entries(mainCategories).forEach(([mainName, categories]) => {
        const totalPhotos = categories.reduce((sum, cat) => sum + (cat.fileCount || 0), 0);

        html += `
            <div onclick="selectSimpleCategory('${mainName}')" 
                 style="background: white; padding: 20px; border-radius: 8px; cursor: pointer; border: 2px solid #ddd; transition: all 0.3s ease;"
                 onmouseover="this.style.borderColor='#007bff'; this.style.transform='translateY(-2px)'"
                 onmouseout="this.style.borderColor='#ddd'; this.style.transform='translateY(0)'">
                <h3 style="margin: 0 0 10px 0; color: #333;">${mainName}</h3>
                <p style="margin: 5px 0; color: #666;">${totalPhotos} fotos</p>
                <small style="color: #999;">${categories.length} subcategorias</small>
            </div>
        `;
    });

    html += `
            </div>
            <hr style="margin: 30px 0;">
            <button onclick="toggleSimpleNav()" 
                    style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                ❌ Voltar para navegação atual
            </button>
        </div>
    `;

    contentDiv.innerHTML = html;
    console.log('✅ Home simples renderizada');
}

// ===== AGRUPAR POR CATEGORIA PRINCIPAL =====
function groupByMainCategory(categories) {
    const groups = {};

    categories.forEach(cat => {
        const fullPath = cat.fullPath || cat.name;
        const mainName = fullPath.split(' → ')[0].trim();

        if (!groups[mainName]) {
            groups[mainName] = [];
        }
        groups[mainName].push(cat);
    });

    console.log(`📊 Agrupadas em ${Object.keys(groups).length} categorias principais:`, Object.keys(groups));
    return groups;
}

// ===== SELECIONAR CATEGORIA SIMPLES =====
async function selectSimpleCategory(mainName) {
    console.log(`🎯 Selecionando categoria: ${mainName}`);

    // Mostrar loading
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <h2>Carregando ${mainName}...</h2>
            <div style="margin: 20px 0;">🔄 Buscando fotos...</div>
        </div>
    `;

    try {
        // Buscar todas as subcategorias desta categoria principal
        const categories = simpleCategories.filter(cat => {
            const fullPath = cat.fullPath || cat.name;
            return fullPath.startsWith(mainName);
        });

        console.log(`📁 Encontradas ${categories.length} subcategorias para ${mainName}`);

        // Carregar fotos de todas as subcategorias
        let allPhotos = [];
        let loadedCount = 0;

        for (const category of categories) {
            console.log(`📸 Carregando fotos de: ${category.name}`);

            // Atualizar progresso
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <h2>Carregando ${mainName}...</h2>
                    <div style="margin: 20px 0;">📁 ${loadedCount}/${categories.length} subcategorias carregadas</div>
                    <div style="color: #666;">Atual: ${category.name}</div>
                </div>
            `;

            try {
                const response = await fetch(`/api/photos?category_id=${category.id}&customer_code=${currentCustomerCode}&limit=100`);
                const photos = await response.json();

                if (Array.isArray(photos) && photos.length > 0) {
                    // Adicionar categoria info em cada foto para filtros
                    photos.forEach(photo => {
                        photo.categoryName = category.name;
                        photo.categoryPath = category.fullPath || category.name;
                    });

                    allPhotos = allPhotos.concat(photos);
                    console.log(`✅ ${photos.length} fotos carregadas de ${category.name}`);
                }
            } catch (error) {
                console.error(`❌ Erro carregando ${category.name}:`, error);
            }

            loadedCount++;
        }

        console.log(`🎯 Total: ${allPhotos.length} fotos carregadas para ${mainName}`);

        // Renderizar galeria simples
        renderSimpleGallery(mainName, allPhotos);

    } catch (error) {
        console.error('❌ Erro ao carregar categoria:', error);
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h2>❌ Erro ao carregar ${mainName}</h2>
                <button onclick="renderSimpleHome()" class="btn btn-secondary">Voltar</button>
            </div>
        `;
    }
}

// ===== RENDERIZAR GALERIA SIMPLES =====
function renderSimpleGallery(mainName, photos) {
    console.log(`🎨 Renderizando galeria simples: ${mainName} (${photos.length} fotos)`);

    const contentDiv = document.getElementById('content');

    // Extrair tamanhos únicos para filtro
    const sizes = [...new Set(photos.map(p => {
        const path = p.categoryPath || '';
        const parts = path.split(' → ');
        return parts[parts.length - 1]; // Último nível = tamanho
    }))].filter(Boolean).sort();

    let html = `
        <div style="padding: 20px;">
            <!-- Header da categoria -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h1 style="margin: 0; color: #333;">${mainName}</h1>
                    <p style="margin: 5px 0; color: #666;">${photos.length} fotos disponíveis</p>
                </div>
                <button onclick="renderSimpleHome()" 
                        style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    ← Voltar
                </button>
            </div>
            
            <!-- Filtros simples -->
            <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <strong>Filtrar por tamanho:</strong>
                <button onclick="filterSimpleGallery('all')" 
                        style="margin: 5px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">
                    Todos
                </button>
    `;

    sizes.forEach(size => {
        if (size && size !== mainName) {
            html += `
                <button onclick="filterSimpleGallery('${size}')" 
                        style="margin: 5px; padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">
                    ${size}
                </button>
            `;
        }
    });

    html += `
            </div>
            
            <!-- Grid de fotos -->
            <div id="simple-photos-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px;">
    `;

    photos.forEach((photo, index) => {
        const photoSize = photo.categoryPath ? photo.categoryPath.split(' → ').pop() : '';

        html += `
            <div class="simple-photo-item" data-size="${photoSize}" 
                 style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <img src="${photo.thumbnail || `/api/photos/local/thumbnail/${photo.id}`}" 
                     alt="${photo.name}" 
                     style="width: 100%; height: 200px; object-fit: cover;">
                <div style="padding: 10px;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">${photoSize}</div>
                    <div style="font-weight: 500;">${photo.price ? '$' + photo.price : 'Preço não definido'}</div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    contentDiv.innerHTML = html;

    // Armazenar fotos para filtros
    window.currentSimplePhotos = photos;

    console.log('✅ Galeria simples renderizada');
}

// ===== FILTRAR GALERIA =====
function filterSimpleGallery(filterSize) {
    console.log(`🔍 Filtrando por: ${filterSize}`);

    const photoItems = document.querySelectorAll('.simple-photo-item');

    photoItems.forEach(item => {
        const itemSize = item.getAttribute('data-size');

        if (filterSize === 'all' || itemSize === filterSize) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// ===== TOGGLE ENTRE SISTEMAS =====
function toggleSimpleNav() {
    SIMPLE_NAV.enabled = !SIMPLE_NAV.enabled;
    console.log(`🔄 Simple Navigation: ${SIMPLE_NAV.enabled ? 'ATIVADO' : 'DESATIVADO'}`);

    if (SIMPLE_NAV.enabled) {
        initSimpleNavigation();
    } else {
        console.log('🔄 Recarregando página para voltar ao sistema atual...');
        location.reload(); // Recarrega para voltar ao sistema atual
    }
}

// ===== DISPONIBILIZAR GLOBALMENTE =====
window.toggleSimpleNav = toggleSimpleNav;
window.selectSimpleCategory = selectSimpleCategory;

// ===== AUTO-INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function () {
    console.log('📱 DOM carregado - verificando Simple Navigation');

    // Aguardar um pouco para garantir que outras variáveis foram carregadas
    setTimeout(initSimpleNavigation, 1000);
});

console.log('📁 simple-navigation.js carregado com sucesso');

// Disponibilizar novas funções globalmente
window.filterSimpleGallery = filterSimpleGallery;
window.renderSimpleGallery = renderSimpleGallery;
window.renderSimpleHome = renderSimpleHome;