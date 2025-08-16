// image-utils.js - VERSÃO R2 com Thumbnails
window.ImageUtils = {
    
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
