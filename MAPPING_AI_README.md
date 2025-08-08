# 🧠 Mapping Auto IA - Adlign

## 🎯 Objectif

La feature **Mapping Auto IA** permet d'analyser automatiquement n'importe quelle page produit Shopify et de détecter tous les éléments modifiables (titres, prix, images, CTA, etc.) sans intervention manuelle.

## 🚀 Fonctionnement

### 1. **Analyse Automatique**
- Prend l'URL d'une page produit Shopify
- Récupère le HTML complet
- Analyse avec des patterns intelligents pour détecter les éléments
- Génère un mapping JSON avec les sélecteurs CSS/XPath

### 2. **Détection d'Éléments**
Le système détecte automatiquement :
- **Titre du produit** (`h1.product-title`, `h1.product__title`)
- **Prix** (`.price`, `.product__price`)
- **Description** (`.product-description`, `.description`)
- **Image principale** (`.product-image img`, `.product__image img`)
- **Bouton CTA** (`.add-to-cart`, `.btn`)
- **Avis/Étoiles** (`.reviews`, `.rating`)
- **Variantes** (`.variant`, `.product-options`)
- **Badges/Promotions** (`.badge`, `.promo`)

### 3. **Application Dynamique**
- Le mapping est stocké et réutilisable
- Le script JS injecté utilise le mapping pour remplacer le contenu
- Compatible avec tous les thèmes Shopify

## 📡 API Endpoints

### Analyser une page produit
```http
POST /analyze-product-page
Content-Type: application/json

{
  "product_url": "https://shop.myshopify.com/products/mon-produit",
  "shop_domain": "shop.myshopify.com"
}
```

**Réponse :**
```json
{
  "success": true,
  "mapping_id": "mapping_1703123456789_abc123def",
  "mapping": {
    "product_title": {
      "type": "text",
      "selector": "h1.product-title, h1.product__title, h1.title",
      "description": "Titre principal du produit",
      "current_value": "Savon Naturel Premium"
    },
    "product_price": {
      "type": "price",
      "selector": ".price, .product__price",
      "description": "Prix du produit",
      "current_value": "19,90€"
    }
  },
  "message": "Mapping généré avec 8 éléments détectés"
}
```

### Récupérer un mapping
```http
GET /mapping/:mappingId
```

### Lister tous les mappings d'un shop
```http
GET /mappings/:shopDomain
```

### Tester un mapping
```http
POST /test-mapping
Content-Type: application/json

{
  "mapping_id": "mapping_1703123456789_abc123def",
  "test_content": {
    "product_title": "🔥 OFFRE EXCLUSIVE",
    "product_price": "9,90€ au lieu de 19,90€",
    "add_to_cart_button": "🚀 COMMANDER MAINTENANT"
  }
}
```

## 🎨 Utilisation dans Shopify

### 1. **Injection du Script**
Ajouter dans le template produit Liquid :
```liquid
{% if request.query_string contains 'landing' %}
  <script src="{{ 'adlign-injection.js' | asset_url }}"></script>
{% endif %}
```

### 2. **URL avec Mapping**
```
https://shop.myshopify.com/products/savon?landing=landing-promo&mapping=mapping_1703123456789_abc123def
```

### 3. **Fonctionnement Automatique**
- Le script détecte les paramètres `landing` et `mapping`
- Récupère le mapping depuis le backend
- Récupère le contenu de la landing
- Applique les remplacements automatiquement
- Masque le contenu Shopify natif

## 🔧 Configuration

### Variables d'environnement
```env
# Shopify Configuration
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_SCOPES=read_products,write_products,read_metaobjects,write_metaobjects,read_themes,write_themes
SHOPIFY_APP_URL=https://your-app.com

# Claude AI Configuration
CLAUDE_API_KEY=your_claude_api_key_here

# Backend Configuration
PORT=3000
NODE_ENV=development
```

### Configuration du script
```javascript
const ADLIGN_CONFIG = {
  backendUrl: 'https://your-backend.com', // URL de production
  debug: false // Désactiver en production
};
```

## 📊 Stockage

### Structure des mappings
```json
{
  "shop.myshopify.com": {
    "mapping_1703123456789_abc123def": {
      "id": "mapping_1703123456789_abc123def",
      "product_url": "https://shop.myshopify.com/products/savon",
      "mapping": {
        "product_title": {
          "type": "text",
          "selector": "h1.product-title",
          "description": "Titre principal du produit",
          "current_value": "Savon Naturel"
        }
      },
      "created_at": "2024-01-01T12:00:00.000Z",
      "updated_at": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

## 🧪 Tests

### Fichier de test
Utiliser `test-mapping.http` avec REST Client pour tester toutes les routes.

### Test manuel
1. Analyser une page produit
2. Récupérer le mapping généré
3. Tester avec du contenu personnalisé
4. Vérifier l'application sur la page

## 🚀 Avantages

### **Scalabilité**
- Fonctionne sur tous les thèmes Shopify
- Aucun mapping manuel requis
- Onboarding en 1 clic

### **Flexibilité**
- Détection automatique des éléments
- Support de nouveaux thèmes sans intervention
- Mapping réutilisable

### **Performance**
- Mapping stocké localement
- Pas de re-analyse à chaque visite
- Script optimisé pour le rendu

## 🤖 Intégration Claude AI

### **Analyse Intelligente**
La feature utilise maintenant **Claude 3 Sonnet** pour analyser automatiquement les pages produit Shopify :

- **Détection automatique** de tous les éléments modifiables
- **Sélecteurs CSS robustes** qui fonctionnent sur tous les thèmes
- **Fallback intelligent** vers l'analyse par patterns si Claude échoue
- **Validation et nettoyage** automatique des résultats

### **Prompt Claude Optimisé**
Le système utilise un prompt spécialement conçu pour :
- Analyser le HTML de pages produit Shopify
- Détecter 10 types d'éléments différents
- Générer des sélecteurs CSS précis et robustes
- Extraire les valeurs actuelles des éléments
- Retourner un JSON structuré et validé

### **Configuration Claude API**
```bash
# Installer la dépendance
npm install @anthropic-ai/sdk

# Configurer la clé API dans .env
CLAUDE_API_KEY=your_claude_api_key_here
```

### **Avantages de Claude AI**
- **Précision supérieure** : Détection plus fine des éléments
- **Robustesse** : Fonctionne sur tous les thèmes Shopify
- **Évolutivité** : Facile d'ajouter de nouveaux types d'éléments
- **Fallback sécurisé** : Système de backup en cas d'échec

## 🔮 Évolutions Futures

### **IA Avancée**
- Analyse sémantique du contenu pour détecter le contexte
- Détection de nouveaux types d'éléments (vidéos, galeries, etc.)
- Optimisation des prompts pour des résultats encore plus précis

### **Interface Admin**
- Visualisation des mappings
- Édition manuelle des sélecteurs
- Tests en temps réel

### **Analytics**
- Suivi des performances par mapping
- A/B testing intégré
- Métriques de conversion

---

**Contact :** [faiizyounes@gmail.com]  
**Documentation :** [Lien vers la doc complète]
