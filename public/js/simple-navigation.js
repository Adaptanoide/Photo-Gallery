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
function selectSimpleCategory(mainName) {
    console.log(`🎯 Selecionando categoria: ${mainName}`);

    const categories = simpleCategories.filter(cat => {
        const fullPath = cat.fullPath || cat.name;
        return fullPath.startsWith(mainName);
    });

    const totalPhotos = categories.reduce((sum, cat) => sum + (cat.fileCount || 0), 0);

    alert(`✅ Categoria: ${mainName}\n\n📸 ${totalPhotos} fotos total\n📁 ${categories.length} subcategorias\n\n🔧 Aqui carregaríamos todas as fotos com filtros simples!`);
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