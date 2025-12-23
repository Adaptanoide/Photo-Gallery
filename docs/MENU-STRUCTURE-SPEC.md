# Especificacao da Nova Estrutura de Menu - Sunshine Cowhides Gallery

## Regras de Exibicao

| Categoria | Tipo de Exibicao | Regra |
|-----------|------------------|-------|
| COWHIDES | SO fotos unicas | Cowhides SEM foto NAO aparecem |
| Accessories | SO estoque regular | Nunca mostrar como foto unica |
| Designer Rugs | SO estoque regular | Sao padroes, nao unicos |
| Rodeo Rugs | MISTO (abas) | Alguns sao unicos, outros estoque |
| Pillows | SO estoque | Nao tem foto |
| Furniture | SO estoque | Remover fotos unicas |
| Duffle Bags | SO estoque | Remover fotos unicas |
| Small Hides | MISTO (abas) | Alguns tem foto, maioria estoque |
| Sheepskin | MISTO (abas) | Poucos com foto, maioria estoque |

---

## Estrutura de Menu Proposta

```
[COWHIDES v]     [SMALL HIDES v]     [RUGS v]     [ACCESSORIES]     [FURNITURE]
     |                  |                |
     v                  v                v
  DROPDOWN          DROPDOWN         DROPDOWN
```

### 1. COWHIDES (Dropdown)
```
COWHIDES
├── All Cowhides (so fotos)
├── Natural Cowhides
│   ├── Brazilian
│   ├── Colombian
│   └── By Size (S/M/L/XL)
├── Specialty Cowhides ►
│   ├── Printed (Zebra, Leopard, etc)
│   ├── Devore Metallic
│   └── Dyed (colored)
└── With Leather Binding
```

### 2. SMALL HIDES (Dropdown)
```
SMALL HIDES
├── Sheepskins
│   └── [Abas: Fotos Unicas | Estoque]
├── Calfskins
│   └── [Abas: Fotos Unicas | Estoque]
├── Goatskins
├── Icelandic
└── Reindeer
```

### 3. RUGS (Dropdown)
```
RUGS
├── Rodeo Rugs
│   └── [Abas: Fotos Unicas | Estoque]
├── Designer Rugs (so estoque)
│   ├── By Size
│   └── By Pattern
└── Bedside Rugs
```

### 4. ACCESSORIES (Direto ou Dropdown)
```
ACCESSORIES (so estoque)
├── Pillows
├── Coasters
├── Place Mats
├── Bags (Duffle, etc)
├── Slippers
└── Others
```

### 5. FURNITURE (Direto)
```
FURNITURE (so estoque)
├── Chairs
└── Others
```

---

## UI/UX: Sistema de Abas para Categorias Mistas

Quando uma subcategoria tem AMBOS os tipos (foto + estoque):

```
+------------------------------------------+
|  [Fotos Unicas]  |  [Estoque Regular]    |  <- Abas
+------------------------------------------+
|                                          |
|  Grid de produtos (6-12 por pagina)      |
|                                          |
|  [< Anterior]  1 2 3  [Proximo >]        |  <- Paginacao
+------------------------------------------+
```

### Card de Foto Unica:
- Imagem real do produto
- Badge: "Foto Unica" ou "Peca Exclusiva"
- Preco individual
- Botao: "Ver Detalhes" / "Adicionar"

### Card de Estoque Regular:
- Icone/placeholder da categoria
- Nome do produto
- Estoque disponivel: "45 unidades"
- Seletor de quantidade: [-] 1 [+]
- Botao: "Adicionar ao Carrinho"

---

## Filtros Melhorados

### Para Cowhides (Fotos):
- Padrao/Cor: Brindle, Tricolor, Black&White, etc
- Tamanho: S, M, L, XL
- Origem: Brazil, Colombia
- Preco: faixas

### Para Estoque Regular:
- Categoria
- Disponibilidade: Em estoque / Baixo estoque
- Ordenar: Nome, Estoque, Preco

---

## Paginacao (Mostrar Menos)

- Desktop: 12 produtos por pagina
- Mobile: 8 produtos por pagina
- Infinite scroll OU paginacao tradicional

---

## Proximos Passos

1. [ ] Implementar HTML do menu com dropdowns
2. [ ] CSS dos dropdowns e submenus
3. [ ] JavaScript da navegacao
4. [ ] Sistema de abas (foto/estoque)
5. [ ] Cards diferenciados
6. [ ] Paginacao
7. [ ] Filtros por categoria
