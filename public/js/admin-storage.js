// admin-storage.js - Storage Management

class StorageManager {
    constructor() {
        this.selectedFiles = [];
        this.init();
    }

    init() {
        // FLAG TEMPORÁRIA - mude para false quando quiser usar o storage real
        const IN_DEVELOPMENT = true;

        if (IN_DEVELOPMENT) {
            // Aguarda um momento para garantir que o DOM está pronto
            setTimeout(() => {
                const storageSection = document.getElementById('section-storage');
                if (storageSection) {
                    // Guarda o HTML original (opcional)
                    storageSection.dataset.originalHtml = storageSection.innerHTML;

                    // Mostra a mensagem de desenvolvimento
                    storageSection.innerHTML = `
                    <h2>Storage Management - In Development</h2>
                    <p>This section will be implemented in the next phase.</p>
                `;
                }
            }, 100);
            return; // Para aqui, não executa o resto
        }

        // CÓDIGO ORIGINAL (não mude nada)
        this.setupElements();
        this.checkStatus();
        this.setupEventListeners();
    }

    setupElements() {
        this.uploadZone = document.getElementById('uploadZone');
        this.fileInput = document.getElementById('fileInput');
        this.filesPreview = document.getElementById('filesPreview');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.folderInput = document.getElementById('folderPath');
        this.resultsDiv = document.getElementById('uploadResults');
    }

    async checkStatus() {
        try {
            const response = await fetch('/api/storage/status');
            const data = await response.json();

            document.getElementById('storageMode').textContent =
                data.mode === 'r2' ? 'Cloudflare R2' : 'Google Drive';

            document.getElementById('storageMode').className =
                data.mode === 'r2' ? 'value active' : 'value';

            document.getElementById('storageUrl').textContent =
                data.mode === 'r2' ? 'R2 Público' : 'Drive API';

        } catch (error) {
            console.error('Erro ao verificar status:', error);
        }
    }

    setupEventListeners() {
        // Click to upload
        this.uploadZone.addEventListener('click', () => {
            this.fileInput.click();
        });

        // Drag and drop
        this.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadZone.classList.add('dragover');
        });

        this.uploadZone.addEventListener('dragleave', () => {
            this.uploadZone.classList.remove('dragover');
        });

        this.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        // File input change
        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Upload button
        this.uploadBtn.addEventListener('click', () => this.uploadFiles());
    }

    handleFiles(files) {
        this.selectedFiles = Array.from(files).filter(file =>
            file.type.startsWith('image/')
        );

        this.displayFiles();
        this.updateUploadButton();
    }

    displayFiles() {
        this.filesPreview.innerHTML = '';

        this.selectedFiles.forEach((file, index) => {
            const card = document.createElement('div');
            card.className = 'file-card';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);

            const name = document.createElement('div');
            name.className = 'file-name';
            name.textContent = file.name;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => this.removeFile(index);

            card.appendChild(img);
            card.appendChild(name);
            card.appendChild(removeBtn);

            this.filesPreview.appendChild(card);
        });
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.displayFiles();
        this.updateUploadButton();
    }

    updateUploadButton() {
        const count = this.selectedFiles.length;
        this.uploadBtn.disabled = count === 0;
        this.uploadBtn.textContent = count > 0 ?
            `Upload ${count} arquivo(s)` : 'Selecione arquivos';
    }

    async uploadFiles() {
        if (this.selectedFiles.length === 0) return;

        this.uploadBtn.disabled = true;
        this.uploadBtn.textContent = 'Enviando...';
        this.resultsDiv.innerHTML = '';

        const folder = this.folderInput.value.trim();

        for (const file of this.selectedFiles) {
            const formData = new FormData();
            formData.append('photo', file);
            formData.append('folder', folder);

            try {
                const response = await fetch('/api/storage/upload', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.success) {
                    this.showResult(file.name, true, data.url);
                } else {
                    this.showResult(file.name, false, data.error);
                }
            } catch (error) {
                this.showResult(file.name, false, error.message);
            }
        }

        // Reset
        this.selectedFiles = [];
        this.displayFiles();
        this.updateUploadButton();

        setTimeout(() => {
            this.uploadBtn.textContent = 'Upload Concluído!';
        }, 1000);
    }

    showResult(fileName, success, message) {
        const item = document.createElement('div');
        item.className = `result-item ${success ? 'success' : 'error'}`;

        if (success) {
            item.innerHTML = `
                <span>✅ ${fileName}</span>
                <a href="${message}" target="_blank">Ver imagem</a>
            `;
        } else {
            item.innerHTML = `
                <span>❌ ${fileName}</span>
                <span>${message}</span>
            `;
        }

        this.resultsDiv.appendChild(item);
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('uploadZone')) {
        window.storageManager = new StorageManager();
    }
});
