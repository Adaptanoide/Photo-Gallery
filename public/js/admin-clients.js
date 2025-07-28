/**
 * ADMIN CLIENTS - SUNSHINE COWHIDES
 * Gestão completa de códigos de acesso e clientes
 */

class AdminClients {
    constructor() {
        this.clients = [];
        this.availableCategories = [];
        this.selectedCategories = [];
        this.isLoading = false;
        this.currentClient = null;
        this.filters = {
            search: '',
            status: 'all'
        };
        
        this.init();
    }

    // ===== INICIALIZAÇÃO =====
    init() {
        console.log('👥 Inicializando Gestão de Clientes...');
        this.setupElements();
        this.setupEventListeners();
        this.loadInitialData();
        console.log('✅ Gestão de Clientes inicializada');
    }

    setupElements() {
        // Container principal
        this.section = document.getElementById('section-clients');
        
        // Elementos que criaremos dinamicamente
        this.clientsContainer = null;
        this.modal = null;
        this.form = null;
        this.table = null;
        
        // Loading
        this.loading = document.getElementById('loading');
    }

    setupEventListeners() {
        // Event listeners serão configurados após criar o HTML
        console.log('🔗 Event listeners configurados');
    }

    // ===== RENDERIZAÇÃO INICIAL =====
    async loadInitialData() {
        if (!this.section) {
            console.log('⚠️ Seção de clientes não encontrada');
            return;
        }

        this.showLoading(true);
        
        try {
            // Criar HTML da interface
            this.renderClientInterface();
            
            // Carregar dados em paralelo
            await Promise.all([
                this.loadClients(),
                this.loadAvailableCategories()
            ]);
            
            // Renderizar tabela
            this.renderClientsTable();
            
            // Configurar event listeners após criar HTML
            this.setupEventListenersAfterRender();
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados iniciais:', error);
            this.showError('Erro ao carregar dados de clientes');
        } finally {
            this.showLoading(false);
        }
    }

    renderClientInterface() {
        this.section.innerHTML = `
            <!-- Cabeçalho da Seção -->
            <div class="clients-section-header">
                <h2 class="clients-title">
                    <i class="fas fa-users"></i>
                    Gestão de Clientes
                </h2>
                <div class="clients-actions">
                    <button id="btnRefreshClients" class="btn btn-secondary">
                        <i class="fas fa-sync-alt"></i>
                        Atualizar
                    </button>
                    <button id="btnNewClient" class="btn btn-primary">
                        <i class="fas fa-plus"></i>
                        Novo Código
                    </button>
                </div>
            </div>

            <!-- Filtros -->
            <div class="clients-filters">
                <div class="filters-row">
                    <div class="filter-group">
                        <label class="filter-label">Buscar Cliente</label>
                        <input type="text" id="searchClients" class="filter-input" 
                               placeholder="Nome, código ou email...">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Status</label>
                        <select id="filterStatus" class="filter-select">
                            <option value="all">Todos</option>
                            <option value="active">Ativos</option>
                            <option value="inactive">Inativos</option>
                            <option value="expired">Expirados</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Ordenar</label>
                        <select id="sortClients" class="filter-select">
                            <option value="recent">Mais Recentes</option>
                            <option value="name">Nome A-Z</option>
                            <option value="code">Código</option>
                            <option value="usage">Mais Usados</option>
                        </select>
                    </div>
                    <button id="btnApplyFilters" class="btn-filter">
                        <i class="fas fa-filter"></i>
                        Filtrar
                    </button>
                </div>
            </div>

            <!-- Tabela de Códigos -->
            <div class="clients-table-container">
                <table class="clients-table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Cliente</th>
                            <th>Categorias</th>
                            <th>Uso</th>
                            <th>Expira em</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="clientsTableBody">
                        <tr>
                            <td colspan="7" class="text-center">
                                <i class="fas fa-spinner fa-spin"></i>
                                Carregando códigos...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Modal de Código -->
            <div id="clientModal" class="client-modal">
                <div class="client-modal-content">
                    <div class="client-modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-user-plus"></i>
                            <span id="modalTitle">Novo Código de Acesso</span>
                        </h3>
                        <button class="modal-close" onclick="adminClients.closeModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="client-modal-body">
                        <form id="clientForm" class="client-form">
                            <!-- Informações do Cliente -->
                            <div class="form-section-clients">
                                <h4 class="form-section-title-clients">
                                    <i class="fas fa-user"></i>
                                    Informações do Cliente
                                </h4>
                                <div class="form-grid">
                                    <div class="form-group-clients">
                                        <label class="form-label-clients required">Nome Completo</label>
                                        <input type="text" id="clientName" class="form-input-clients" 
                                               placeholder="Ex: João Silva" required>
                                    </div>
                                    <div class="form-group-clients">
                                        <label class="form-label-clients">Email</label>
                                        <input type="email" id="clientEmail" class="form-input-clients" 
                                               placeholder="joao@email.com">
                                    </div>
                                </div>
                            </div>

                            <!-- Código de Acesso -->
                            <div class="form-section-clients">
                                <h4 class="form-section-title-clients">
                                    <i class="fas fa-key"></i>
                                    Código de Acesso
                                </h4>
                                <div class="form-group-clients">
                                    <div id="codePreview" class="code-preview">
                                        ----
                                    </div>
                                    <small style="color: #666; text-align: center; display: block; margin-top: 0.5rem;">
                                        Código será gerado automaticamente
                                    </small>
                                </div>
                            </div>

                            <!-- Configurações -->
                            <div class="form-section-clients">
                                <h4 class="form-section-title-clients">
                                    <i class="fas fa-cog"></i>
                                    Configurações
                                </h4>
                                <div class="form-grid">
                                    <div class="form-group-clients">
                                        <label class="form-label-clients">Expira em (dias)</label>
                                        <input type="number" id="expireDays" class="form-input-clients" 
                                               value="30" min="1" max="365">
                                    </div>
                                    <div class="form-group-clients">
                                        <label class="form-label-clients">Status</label>
                                        <select id="clientStatus" class="form-input-clients">
                                            <option value="true">Ativo</option>
                                            <option value="false">Inativo</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <!-- Categorias Permitidas -->
                            <div class="form-section-clients">
                                <h4 class="form-section-title-clients">
                                    <i class="fas fa-folder-open"></i>
                                    Categorias Permitidas
                                </h4>
                                <div class="form-group-clients full-width">
                                    <div id="categoriesSelection" class="categories-selection">
                                        <div style="padding: 2rem; text-align: center; color: #666;">
                                            <i class="fas fa-spinner fa-spin"></i>
                                            Carregando categorias...
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                        
                        <!-- Loading Overlay -->
                        <div id="modalLoading" class="loading-overlay">
                            <div class="loading-spinner-modal">
                                <div class="spinner-modal"></div>
                                <p>Processando...</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="client-modal-footer">
                        <button type="button" class="btn-modal btn-cancel" onclick="adminClients.closeModal()">
                            <i class="fas fa-times"></i>
                            Cancelar
                        </button>
                        <button type="submit" form="clientForm" class="btn-modal btn-save" id="btnSaveClient">
                            <i class="fas fa-save"></i>
                            <span id="saveButtonText">Criar Código</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Armazenar referências dos elementos
        this.clientsContainer = this.section;
        this.modal = document.getElementById('clientModal');
        this.form = document.getElementById('clientForm');
        this.table = document.getElementById('clientsTableBody');
    }

    setupEventListenersAfterRender() {
        // Botões principais
        document.getElementById('btnNewClient').addEventListener('click', () => this.openCreateModal());
        document.getElementById('btnRefreshClients').addEventListener('click', () => this.refreshData());
        
        // Filtros
        document.getElementById('searchClients').addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('filterStatus').addEventListener('change', (e) => this.handleStatusFilter(e.target.value));
        document.getElementById('sortClients').addEventListener('change', (e) => this.handleSort(e.target.value));
        document.getElementById('btnApplyFilters').addEventListener('click', () => this.applyFilters());
        
        // Formulário
        this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // Inputs do formulário
        document.getElementById('clientName').addEventListener('input', () => this.generateCodePreview());
        
        // Fechar modal clicando fora
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        console.log('🔗 Event listeners configurados após renderização');
    }

    // ===== CARREGAMENTO DE DADOS =====
    async loadClients() {
        try {
            const token = this.getAdminToken();
            const response = await fetch('/api/admin/access-codes', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.clients = data.codes || [];
                console.log(`✅ ${this.clients.length} códigos carregados`);
            } else {
                throw new Error(data.message || 'Erro ao carregar códigos');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar clientes:', error);
            // Dados de fallback para desenvolvimento
            this.clients = [
                {
                    _id: '1',
                    code: '7064',
                    clientName: 'João Silva',
                    clientEmail: 'joao@email.com',
                    allowedCategories: ['1. Colombian Cowhides', '2. Brazil Best Sellers'],
                    isActive: true,
                    usageCount: 3,
                    lastUsed: new Date(),
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    createdAt: new Date()
                }
            ];
        }
    }

    async loadAvailableCategories() {
        try {
            const response = await fetch('/api/drive/folders');
            const data = await response.json();

            if (data.success) {
                this.availableCategories = data.folders.map(folder => ({
                    id: folder.id,
                    name: folder.name,
                    modifiedTime: folder.modifiedTime
                }));
                console.log(`✅ ${this.availableCategories.length} categorias carregadas`);
            } else {
                throw new Error(data.message || 'Erro ao carregar categorias');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar categorias:', error);
            // Fallback
            this.availableCategories = [
                { id: '1', name: '1. Colombian Cowhides' },
                { id: '2', name: '2. Brazil Best Sellers' },
                { id: '3', name: '3. Premium Selection' }
            ];
        }
    }

    // ===== RENDERIZAÇÃO DA TABELA =====
    renderClientsTable() {
        if (!this.table) return;

        if (this.clients.length === 0) {
            this.table.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <i class="fas fa-inbox"></i>
                        Nenhum código encontrado
                        <br><small style="color: #666;">Clique em "Novo Código" para criar o primeiro</small>
                    </td>
                </tr>
            `;
            return;
        }

        const rows = this.clients.map(client => `
            <tr onclick="adminClients.viewClient('${client._id || client.code}')">
                <td class="client-code-cell">${client.code}</td>
                <td class="client-name-cell">
                    <div>${client.clientName}</div>
                    <div class="client-email-cell">${client.clientEmail || 'Sem email'}</div>
                </td>
                <td class="client-categories-cell">
                    <div class="categories-preview">
                        ${this.renderCategoriesPreview(client.allowedCategories)}
                    </div>
                </td>
                <td class="client-usage-cell">
                    <div class="usage-count">${client.usageCount || 0}x</div>
                    <div class="usage-last">${this.formatDate(client.lastUsed, 'Nunca usado')}</div>
                </td>
                <td>${this.formatDate(client.expiresAt)}</td>
                <td class="client-status-cell">
                    ${this.renderStatusBadge(client)}
                </td>
                <td class="client-actions-cell" onclick="event.stopPropagation();">
                    <div class="action-buttons">
                        <button class="btn-action btn-view" onclick="adminClients.viewClient('${client._id || client.code}')">
                            <i class="fas fa-eye"></i>
                            Ver
                        </button>
                        <button class="btn-action btn-edit" onclick="adminClients.editClient('${client._id || client.code}')">
                            <i class="fas fa-edit"></i>
                            Editar
                        </button>
                        <button class="btn-action btn-toggle ${client.isActive ? '' : 'activate'}" 
                                onclick="adminClients.toggleClientStatus('${client._id || client.code}')">
                            <i class="fas fa-${client.isActive ? 'ban' : 'check'}"></i>
                            ${client.isActive ? 'Desativar' : 'Ativar'}
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        this.table.innerHTML = rows;
    }

    renderCategoriesPreview(categories) {
        if (!categories || categories.length === 0) {
            return '<span style="color: #999; font-style: italic;">Nenhuma categoria</span>';
        }

        const maxShow = 2;
        let html = '';

        categories.slice(0, maxShow).forEach(category => {
            html += `<span class="category-tag">${this.truncateText(category, 15)}</span>`;
        });

        if (categories.length > maxShow) {
            html += `<span class="categories-more">+${categories.length - maxShow}</span>`;
        }

        return html;
    }

    renderStatusBadge(client) {
        const now = new Date();
        const isExpired = client.expiresAt && new Date(client.expiresAt) < now;
        
        if (isExpired) {
            return '<span class="status-badge-client status-expired">Expirado</span>';
        } else if (client.isActive) {
            return '<span class="status-badge-client status-active">Ativo</span>';
        } else {
            return '<span class="status-badge-client status-inactive">Inativo</span>';
        }
    }

    // ===== MODAL E FORMULÁRIO =====
    openCreateModal() {
        this.currentClient = null;
        this.selectedCategories = [];
        
        // Resetar formulário
        this.form.reset();
        document.getElementById('expireDays').value = '30';
        document.getElementById('clientStatus').value = 'true';
        
        // Atualizar títulos
        document.getElementById('modalTitle').textContent = 'Novo Código de Acesso';
        document.getElementById('saveButtonText').textContent = 'Criar Código';
        
        // Gerar preview do código
        this.generateCodePreview();
        
        // Renderizar categorias
        this.renderCategoriesSelection();
        
        // Mostrar modal
        this.modal.classList.add('active');
        document.getElementById('clientName').focus();
    }

    closeModal() {
        this.modal.classList.remove('active');
        this.currentClient = null;
        this.selectedCategories = [];
    }

    generateCodePreview() {
        // Gerar código de 4 dígitos único
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        document.getElementById('codePreview').textContent = code;
    }

    renderCategoriesSelection() {
        const container = document.getElementById('categoriesSelection');
        
        if (this.availableCategories.length === 0) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: #666;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Nenhuma categoria disponível</p>
                </div>
            `;
            return;
        }

        const html = this.availableCategories.map(category => `
            <div class="category-item">
                <input type="checkbox" 
                       class="category-checkbox" 
                       id="cat_${category.id}" 
                       value="${category.name}"
                       ${this.selectedCategories.includes(category.name) ? 'checked' : ''}
                       onchange="adminClients.handleCategoryChange('${category.name}', this.checked)">
                <div class="category-info">
                    <div class="category-name">${category.name}</div>
                    <div class="category-details">Atualizada: ${this.formatDate(category.modifiedTime)}</div>
                </div>
                <div class="category-preview">
                    <i class="fas fa-folder"></i>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    handleCategoryChange(categoryName, isChecked) {
        if (isChecked) {
            if (!this.selectedCategories.includes(categoryName)) {
                this.selectedCategories.push(categoryName);
            }
        } else {
            this.selectedCategories = this.selectedCategories.filter(cat => cat !== categoryName);
        }
        
        console.log('📝 Categorias selecionadas:', this.selectedCategories);
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = {
            clientName: document.getElementById('clientName').value.trim(),
            clientEmail: document.getElementById('clientEmail').value.trim(),
            allowedCategories: this.selectedCategories,
            expiresInDays: parseInt(document.getElementById('expireDays').value),
            isActive: document.getElementById('clientStatus').value === 'true'
        };

        // Validações
        if (!formData.clientName) {
            this.showError('Nome do cliente é obrigatório');
            return;
        }

        if (formData.allowedCategories.length === 0) {
            this.showError('Selecione pelo menos uma categoria');
            return;
        }

        try {
            this.showModalLoading(true);
            
            if (this.currentClient) {
                await this.updateClient(this.currentClient._id, formData);
            } else {
                await this.createClient(formData);
            }
            
            this.closeModal();
            await this.refreshData();
            this.showSuccess(this.currentClient ? 'Código atualizado com sucesso!' : 'Código criado com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro ao salvar:', error);
            this.showError(error.message || 'Erro ao salvar código');
        } finally {
            this.showModalLoading(false);
        }
    }

    async createClient(formData) {
        const token = this.getAdminToken();
        const response = await fetch('/api/admin/access-codes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Erro ao criar código');
        }

        return data.accessCode;
    }

    // ===== AÇÕES DA TABELA =====
    viewClient(clientId) {
        const client = this.clients.find(c => c._id === clientId || c.code === clientId);
        if (client) {
            // TODO: Implementar modal de visualização
            console.log('👁️ Visualizar cliente:', client);
        }
    }

    editClient(clientId) {
        const client = this.clients.find(c => c._id === clientId || c.code === clientId);
        if (!client) return;

        this.currentClient = client;
        this.selectedCategories = [...client.allowedCategories];

        // Preencher formulário
        document.getElementById('clientName').value = client.clientName;
        document.getElementById('clientEmail').value = client.clientEmail || '';
        document.getElementById('expireDays').value = this.calculateDaysUntilExpiry(client.expiresAt);
        document.getElementById('clientStatus').value = client.isActive.toString();
        document.getElementById('codePreview').textContent = client.code;

        // Atualizar títulos
        document.getElementById('modalTitle').textContent = 'Editar Código de Acesso';
        document.getElementById('saveButtonText').textContent = 'Salvar Alterações';

        // Renderizar categorias
        this.renderCategoriesSelection();

        // Mostrar modal
        this.modal.classList.add('active');
    }

    async toggleClientStatus(clientId) {
        const client = this.clients.find(c => c._id === clientId || c.code === clientId);
        if (!client) return;

        try {
            // TODO: Implementar API de toggle
            client.isActive = !client.isActive;
            this.renderClientsTable();
            this.showSuccess(`Código ${client.isActive ? 'ativado' : 'desativado'} com sucesso!`);
        } catch (error) {
            console.error('❌ Erro ao alterar status:', error);
            this.showError('Erro ao alterar status do código');
        }
    }

    // ===== FILTROS E BUSCA =====
    handleSearch(query) {
        this.filters.search = query.toLowerCase();
        this.applyFilters();
    }

    handleStatusFilter(status) {
        this.filters.status = status;
        this.applyFilters();
    }

    handleSort(sortBy) {
        this.filters.sortBy = sortBy;
        this.applyFilters();
    }

    applyFilters() {
        let filteredClients = [...this.clients];

        // Aplicar busca
        if (this.filters.search) {
            filteredClients = filteredClients.filter(client => 
                client.clientName.toLowerCase().includes(this.filters.search) ||
                client.code.includes(this.filters.search) ||
                (client.clientEmail && client.clientEmail.toLowerCase().includes(this.filters.search))
            );
        }

        // Aplicar filtro de status
        if (this.filters.status !== 'all') {
            filteredClients = filteredClients.filter(client => {
                const now = new Date();
                const isExpired = client.expiresAt && new Date(client.expiresAt) < now;
                
                switch (this.filters.status) {
                    case 'active':
                        return client.isActive && !isExpired;
                    case 'inactive':
                        return !client.isActive;
                    case 'expired':
                        return isExpired;
                    default:
                        return true;
                }
            });
        }

        // Aplicar ordenação
        if (this.filters.sortBy) {
            filteredClients.sort((a, b) => {
                switch (this.filters.sortBy) {
                    case 'name':
                        return a.clientName.localeCompare(b.clientName);
                    case 'code':
                        return a.code.localeCompare(b.code);
                    case 'usage':
                        return (b.usageCount || 0) - (a.usageCount || 0);
                    case 'recent':
                    default:
                        return new Date(b.createdAt) - new Date(a.createdAt);
                }
            });
        }

        // Atualizar array temporariamente para renderização
        const originalClients = this.clients;
        this.clients = filteredClients;
        this.renderClientsTable();
        this.clients = originalClients;
    }

    async refreshData() {
        this.showLoading(true);
        try {
            await Promise.all([
                this.loadClients(),
                this.loadAvailableCategories()
            ]);
            this.renderClientsTable();
            this.showSuccess('Dados atualizados com sucesso!');
        } catch (error) {
            this.showError('Erro ao atualizar dados');
        } finally {
            this.showLoading(false);
        }
    }

    // ===== UTILITÁRIOS =====
    getAdminToken() {
        const sessionData = localStorage.getItem('sunshineSession');
        if (sessionData) {
            const session = JSON.parse(sessionData);
            return session.token;
        }
        return null;
    }

    formatDate(date, fallback = '-') {
        if (!date) return fallback;
        return new Date(date).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    calculateDaysUntilExpiry(expiresAt) {
        if (!expiresAt) return 30;
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diffTime = expiry - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays);
    }

    truncateText(text, length) {
        if (!text || text.length <= length) return text;
        return text.substring(0, length) + '...';
    }

    // ===== LOADING E FEEDBACK =====
    showLoading(show) {
        if (this.loading) {
            this.loading.classList.toggle('hidden', !show);
        }
    }

    showModalLoading(show) {
        const modalLoading = document.getElementById('modalLoading');
        if (modalLoading) {
            modalLoading.classList.toggle('active', show);
        }
    }

    showError(message) {
        console.error('❌ Erro:', message);
        // TODO: Implementar sistema de notificação melhor
        alert('Erro: ' + message);
    }

    showSuccess(message) {
        console.log('✅ Sucesso:', message);
        // TODO: Implementar sistema de notificação melhor
        alert('Sucesso: ' + message);
    }
}

// ===== INICIALIZAÇÃO GLOBAL =====
let adminClients = null;

// Inicializar quando a seção de clientes for ativada
document.addEventListener('DOMContentLoaded', () => {
    // Observar mudanças na seção ativa
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const section = document.getElementById('section-clients');
                if (section && section.style.display !== 'none' && !adminClients) {
                    // Seção de clientes foi ativada
                    adminClients = new AdminClients();
                }
            }
        });
    });

    const clientsSection = document.getElementById('section-clients');
    if (clientsSection) {
        observer.observe(clientsSection, { attributes: true });
        
        // Se já estiver visível, inicializar imediatamente
        if (clientsSection.style.display !== 'none') {
            adminClients = new AdminClients();
        }
    }
});

// Expor globalmente para uso em HTML
window.adminClients = adminClients;