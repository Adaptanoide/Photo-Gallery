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
    }
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
    
    return groups;
}

// ===== SELECIONAR CATEGORIA SIMPLES =====
function selectSimpleCategory(mainName) {
    console.log(`🎯 Selecionando categoria: ${mainName}`);
    alert(`Categoria selecionada: ${mainName}\n\nAqui carregaríamos todas as fotos desta categoria com filtros simples.`);
}

// ===== TOGGLE ENTRE SISTEMAS =====
function toggleSimpleNav() {
    SIMPLE_NAV.enabled = !SIMPLE_NAV.enabled;
    console.log(`🔄 Simple Navigation: ${SIMPLE_NAV.enabled ? 'ATIVADO' : 'DESATIVADO'}`);
    
    if (SIMPLE_NAV.enabled) {
        initSimpleNavigation();
    } else {
        location.reload(); // Recarrega para voltar ao sistema atual
    }
}

// ===== DISPONIBILIZAR GLOBALMENTE =====
window.toggleSimpleNav = toggleSimpleNav;
window.selectSimpleCategory = selectSimpleCategory;

// ===== AUTO-INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM carregado - verificando Simple Navigation');
    
    // Aguardar um pouco para garantir que outras variáveis foram carregadas
    setTimeout(initSimpleNavigation, 1000);
});

console.log('📁 simple-navigation.js carregado com sucesso');