// image-utils.js - VERSÃO R2 com Thumbnails
window.ImageUtils = {
    CDN_BASE: 'https://images.sunshinecowhides-gallery.com',

    getThumbnailUrl(photo) {
        // Usar thumbnails do R2
        // photo.id já tem o path completo do R2
        const photoPath = photo.id || photo.r2Key || photo.fileName || photo.name;

        // Se já tem barra, é path completo
        if (photoPath && photoPath.includes('/')) {
            return `https://images.sunshinecowhides-gallery.com/_thumbnails/${photoPath}`;
        }

        // Senão, tentar construir (não deveria chegar aqui)
        return `https://images.sunshinecowhides-gallery.com/_thumbnails/${photoPath}`;
    },

    getFullImageUrl(photo) {
        // URL completa sem thumbnail
        const photoPath = photo.id || photo.r2Key || photo.fileName || photo.name || photo.webViewLink;

        // Se já é URL completa, retornar
        if (photoPath && photoPath.startsWith("http")) {
            return photoPath;
        }

        // Se tem barra, é path do R2
        if (photoPath && photoPath.includes('/')) {
            return `https://images.sunshinecowhides-gallery.com/${photoPath}`;
        }

        // Fallback
        return `https://images.sunshinecowhides-gallery.com/${photoPath}`;
    },

    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }
};

// Tornar global
window.ImageUtils = ImageUtils;

// ========== OTIMIZAÇÃO PROGRESSIVA - TESTE ==========
window.ImageUtils.getPreviewUrl = function (photo) {
    const r2Key = photo.r2Key || photo.id;
    if (!r2Key) return this.getThumbnailUrl(photo);

    // TESTE: só para Sheepskins por enquanto
    if (r2Key.includes('Sheepskins')) {
        console.log('🚀 Usando preview otimizado para Sheepskins');
        return `${this.CDN_BASE}/_preview/${r2Key}`;
    }

    // Outras categorias usam original por enquanto
    return this.getFullImageUrl(photo);
};

window.ImageUtils.getDisplayUrl = function (photo) {
    const r2Key = photo.r2Key || photo.id;
    if (!r2Key) return this.getFullImageUrl(photo);

    // TESTE: só para Sheepskins por enquanto
    if (r2Key.includes('Sheepskins')) {
        console.log('🎯 Usando display otimizado para Sheepskins');
        return `${this.CDN_BASE}/_display/${r2Key}`;
    }

    // Outras categorias usam original
    return this.getFullImageUrl(photo);
};
// ========== FIM OTIMIZAÇÃO ==========
