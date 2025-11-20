#!/bin/bash

# Upload Category Thumbnails para R2 (com conversão para WebP)
echo "📸 Processando thumbnails..."

# Criar pasta temporária para WebP
mkdir -p category-thumbnails-webp

# Converter todas as imagens para WebP
echo "🔄 Convertendo para WebP..."
for img in category-thumbnails/*.{png,jpg,jpeg}; do
    if [ -f "$img" ]; then
        filename=$(basename "$img" | cut -d. -f1)
        echo "  Convertendo: $img -> ${filename}.webp"
        cwebp -q 85 "$img" -o "category-thumbnails-webp/${filename}.webp"
    fi
done

# Criar pasta no R2
echo "📁 Criando estrutura no R2..."
rclone mkdir r2:sunshine-photos/category-thumbnails

# Upload apenas WebP
echo "⬆️ Enviando thumbnails WebP..."
rclone copy ./category-thumbnails-webp/ r2:sunshine-photos/category-thumbnails/ \
  --progress

# Verificar upload
echo "✅ Arquivos enviados:"
rclone ls r2:sunshine-photos/category-thumbnails/

echo "🎉 Upload completo!"
