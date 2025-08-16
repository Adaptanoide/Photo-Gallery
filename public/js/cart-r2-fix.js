// PATCH TEMPORÁRIO - Converter driveFileId para R2 path
(function() {
    const originalAddItem = window.CartManager?.addItem;
    if (originalAddItem) {
        window.CartManager.addItem = function(photoId, itemData = {}) {
            // Converter para formato R2
            if (photoId && photoId.includes('/')) {
                // Já é um path R2
                itemData.r2Path = photoId;
                itemData.driveFileId = photoId; // Compatibilidade
            }
            return originalAddItem.call(this, photoId, itemData);
        };
    }
})();
