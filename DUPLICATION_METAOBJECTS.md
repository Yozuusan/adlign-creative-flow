# 🚀 Duplication de Pages Produits avec Metaobjects

## 📋 Vue d'ensemble

Cette fonctionnalité permet de dupliquer automatiquement une page produit Shopify en créant des metaobjects basés sur le mapping IA détecté. Chaque élément mappé devient un metaobject personnalisable.

## 🔧 Fonctionnement

### **1. Analyse du mapping**
```javascript
// Mapping détecté par l'IA
const mapping = {
  product_title: { selector: ".product-title", type: "text" },
  product_price: { selector: ".product-price", type: "text" },
  product_description: { selector: ".product-description", type: "text" },
  add_to_cart_button: { selector: ".btn-add-to-cart", type: "text" }
};
```

### **2. Création des metaobjects**
```javascript
// Metaobjects générés automatiquement
const metaobjects = [
  {
    key: "adlign_product_title",
    value: "🔥 Black Friday - 50% OFF",
    type: "single_line_text_field"
  },
  {
    key: "adlign_product_price", 
    value: "€99 au lieu de €199",
    type: "single_line_text_field"
  },
  {
    key: "adlign_product_description",
    value: "Offre exceptionnelle Black Friday !",
    type: "multi_line_text_field"
  },
  {
    key: "adlign_add_to_cart_button",
    value: "⚡ COMMANDER MAINTENANT",
    type: "single_line_text_field"
  }
];
```

### **3. Page produit dupliquée**
```
URL: https://shop.myshopify.com/products/casque-audio?landing=black-friday-2024
```

## 📡 API Endpoint

### **POST** `/api/saas/duplicate-product-page`

**Body:**
```json
{
  "shop_domain": "shop.myshopify.com",
  "product_id": "123456789",
  "landing_handle": "black-friday-2024",
  "mapping_id": "mapping_123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Page produit dupliquée avec metaobjects pour \"black-friday-2024\"",
  "data": {
    "product_id": "123456789",
    "product_handle": "casque-audio",
    "landing_handle": "black-friday-2024",
    "mapping_id": "mapping_123",
    "metaobject_id": "gid://shopify/Metaobject/123456789",
    "duplicated_page_url": "https://shop.myshopify.com/products/casque-audio?landing=black-friday-2024",
    "metaobjects_created": 4,
    "mapping_elements": 4
  }
}
```

## 🔄 Workflow complet

### **Étape 1 : Analyser le thème**
```bash
curl -X POST http://localhost:3000/api/saas/analyze-theme \
  -H "Content-Type: application/json" \
  -d '{"shop_domain": "shop.myshopify.com"}'
```

### **Étape 2 : Créer une landing page**
```bash
curl -X POST http://localhost:3000/api/saas/landings \
  -H "Content-Type: application/json" \
  -d '{
    "shop_domain": "shop.myshopify.com",
    "landing_data": {
      "handle": "black-friday-2024",
      "mapping_id": "mapping_123",
      "custom_title": "🔥 Black Friday - 50% OFF",
      "custom_price_text": "€99 au lieu de €199",
      "custom_description": "Offre exceptionnelle !",
      "custom_cta_text": "⚡ COMMANDER MAINTENANT"
    }
  }'
```

### **Étape 3 : Dupliquer la page produit**
```bash
curl -X POST http://localhost:3000/api/saas/duplicate-product-page \
  -H "Content-Type: application/json" \
  -d '{
    "shop_domain": "shop.myshopify.com",
    "product_id": "123456789",
    "landing_handle": "black-friday-2024",
    "mapping_id": "mapping_123"
  }'
```

## 🎯 Mapping des éléments

### **Éléments supportés :**
- `product_title` → `adlign_product_title`
- `product_description` → `adlign_product_description`
- `product_price` → `adlign_product_price`
- `add_to_cart_button` → `adlign_add_to_cart_button`
- `product_main_image` → `adlign_product_main_image`
- `product_vendor` → `adlign_product_vendor`
- `product_type` → `adlign_product_type`
- `product_tags` → `adlign_product_tags`

### **Types de metaobjects :**
- `single_line_text_field` : Texte court (titre, prix, CTA)
- `multi_line_text_field` : Texte long (description)
- `url` : Images, liens
- `number` : Prix, quantités
- `boolean` : État actif/inactif

## 🔗 Intégration avec le thème

### **Template Liquid généré :**
```liquid
{% assign landing_handle = request.path | split: '/' | last %}
{% assign metaobject = shop.metaobjects.adlign_landing_page[landing_handle] %}

{% if metaobject %}
  <!-- Contenu personnalisé -->
  <h1 class="product-title">{{ metaobject.adlign_product_title }}</h1>
  <p class="product-description">{{ metaobject.adlign_product_description }}</p>
  <span class="product-price">{{ metaobject.adlign_product_price }}</span>
  <button class="btn-add-to-cart">{{ metaobject.adlign_add_to_cart_button }}</button>
{% else %}
  <!-- Contenu original -->
  <h1 class="product-title">{{ product.title }}</h1>
  <p class="product-description">{{ product.description }}</p>
  <span class="product-price">{{ product.price }}</span>
  <button class="btn-add-to-cart">Add to Cart</button>
{% endif %}
```

## 🧪 Tests

### **Fichier de test :**
```bash
# Utiliser le fichier test-duplication.http
# ou tester directement avec curl
```

### **Scénarios de test :**
1. ✅ Duplication réussie avec mapping valide
2. ❌ Produit inexistant
3. ❌ Mapping inexistant
4. ❌ Landing inexistante
5. ❌ Boutique non connectée

## 📊 Avantages

### **✅ Pour les marchands :**
- **Pages multiples** sans dupliquer les produits
- **A/B Testing** facile avec différentes variantes
- **Campagnes marketing** personnalisées
- **SEO optimisé** (même URL produit)

### **✅ Pour les développeurs :**
- **Mapping automatique** via IA
- **Metaobjects structurés** et réutilisables
- **API REST** simple et documentée
- **Gestion d'erreurs** complète

## 🚀 Prochaines étapes

1. **Template Adlign** : Créer le template Liquid pour les pages dupliquées
2. **Système de routage** : Gérer les URLs personnalisées
3. **A/B Testing** : Comparer les performances des variantes
4. **Analytics** : Mesurer l'impact des pages dupliquées
