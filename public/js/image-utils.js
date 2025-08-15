// public/js/image-utils.js

/**
 * Sistema centralizado de URLs de imagens
 * SEMPRE usa o cache do Cloudflare quando possível
 */
window.ImageUtils = {
    /**
     * Retorna URL da thumbnail com cache
     */
    getThumbnailUrl(photo) {
        if (!photo) return '';
        
        // SEMPRE usa nossa rota se tiver ID
        if (photo.id) {
            console.log(`🎯 Cache: thumbnail ${photo.id}`);
            return `/api/images/thumb/${photo.id}`;
        }
        
        // Fallback (não deveria acontecer)
        console.warn('⚠️ Foto sem ID:', photo);
        return photo.thumbnailLink || photo.thumbnailMedium || '';
    },
    
    /**
     * Retorna URL da imagem completa com cache
     */
    getFullImageUrl(photo) {
        if (!photo) return '';
        
        // SEMPRE usa nossa rota se tiver ID
        if (photo.id) {
            console.log(`🎯 Cache: full image ${photo.id}`);
            return `/api/images/full/${photo.id}`;
        }
        
        // Fallback
        console.warn('⚠️ Foto sem ID:', photo);
        return photo.webViewLink || photo.thumbnailLarge || '';
    },
    
    /**
     * Para zoom ou visualização grande
     */
    getZoomImageUrl(photo) {
        return this.getFullImageUrl(photo);
    }
};

console.log('✅ ImageUtils carregado - Todas imagens passarão pelo cache!');