# 🎯 Guide d'Intégration Adlign pour Shopify

Ce guide vous explique comment intégrer Adlign dans votre thème Shopify pour activer la personnalisation dynamique des pages produit.

## 📋 Prérequis

- ✅ Backend Adlign déployé et accessible
- ✅ App Shopify Adlign installée avec les bonnes permissions
- ✅ Accès à l'éditeur de thème Shopify
- ✅ URL de votre backend Adlign

## 🚀 Installation

### Étape 1: Ajouter le snippet Liquid

1. **Allez dans votre admin Shopify** → **Online Store** → **Themes**
2. **Cliquez sur "Actions"** → **Edit code**
3. **Dans le dossier `snippets`**, créez un nouveau fichier : `adlign-injection.liquid`
4. **Copiez le contenu** du fichier `adlign-snippet.liquid` dans ce nouveau fichier
5. **Sauvegardez**

### Étape 2: Intégrer dans le template produit

#### Option A: Template Liquid (recommandé)

1. **Ouvrez** `templates/product.liquid`
2. **Ajoutez cette ligne** juste avant la fermeture de `</body>` :

```liquid
{% render 'adlign-injection' %}
```

#### Option B: Template JSON (Online Store 2.0)

1. **Ouvrez** `templates/product.json`
2. **Ajoutez cette section** dans le tableau `sections` :

```json
{
  "type": "custom-liquid",
  "name": "Adlign Injection",
  "settings": [],
  "blocks": [],
  "presets": [
    {
      "name": "Adlign Injection"
    }
  ]
}
```

3. **Créez un nouveau fichier** : `sections/adlign-injection.liquid`
4. **Ajoutez ce contenu** :

```liquid
{% comment %}
  Section Adlign pour Online Store 2.0
{% endcomment %}

{% render 'adlign-injection' %}
```

### Étape 3: Configurer les paramètres du thème

1. **Allez dans** **Online Store** → **Themes** → **Customize**
2. **Cliquez sur "Theme settings"** (icône engrenage)
3. **Ajoutez ces paramètres** dans `settings_schema.json` :

```json
{
  "name": "Adlign",
  "settings": [
    {
      "type": "header",
      "content": "Configuration Adlign"
    },
    {
      "type": "text",
      "id": "adlign_backend_url",
      "label": "URL du Backend Adlign",
      "default": "https://votre-backend.com",
      "info": "URL de votre serveur backend Adlign"
    },
    {
      "type": "checkbox",
      "id": "adlign_debug",
      "label": "Mode Debug",
      "default": false,
      "info": "Afficher les logs de debug dans la console"
    },
    {
      "type": "range",
      "id": "adlign_animation_duration",
      "label": "Durée d'animation (ms)",
      "min": 100,
      "max": 1000,
      "step": 50,
      "default": 300,
      "info": "Durée des animations de remplacement de contenu"
    }
  ]
}
```

## 🔧 Configuration

### Variables d'environnement

Assurez-vous que votre backend Adlign a ces variables configurées :

```env
SHOPIFY_API_KEY=votre_api_key
SHOPIFY_API_SECRET=votre_api_secret
SHOPIFY_SCOPES=read_products,write_products,read_metaobjects,write_metaobjects,read_themes,write_themes,write_metaobject_definitions,read_orders,write_orders,read_customers,write_customers,read_discounts,write_discounts,read_price_rules,write_price_rules,read_online_store_pages,read_content,write_content
```

### URL du Backend

Dans les paramètres du thème, configurez l'URL de votre backend :
- **Développement** : `http://localhost:3000`
- **Production** : `https://votre-domaine.com`

## 🧪 Test de l'Intégration

### 1. Créer une landing page de test

Utilisez l'API de duplication pour créer une page test :

```bash
curl -X POST http://localhost:3000/api/saas/duplicate-product-page \
  -H "Content-Type: application/json" \
  -d '{
    "shop_domain": "votre-boutique.myshopify.com",
    "product_id": "123456789",
    "landing_handle": "test-black-friday",
    "mapping_id": "mapping_123456789"
  }'
```

### 2. Tester l'URL

Visitez votre page produit avec les paramètres Adlign :

```
https://votre-boutique.myshopify.com/products/votre-produit?landing=test-black-friday&mapping=mapping_123456789
```

### 3. Vérifier les logs

Ouvrez la console du navigateur (F12) et vérifiez :
- ✅ `[Adlign] Initialisation d'Adlign Injection Script`
- ✅ `[Adlign] Paramètres détectés`
- ✅ `[Adlign] Remplacement de contenu terminé`
- ✅ Indicateur "🎯 Adlign Active" en haut à droite

## 🎯 Utilisation

### Créer une campagne

1. **Analysez votre thème** avec l'API de mapping IA
2. **Créez une landing page** avec le contenu personnalisé
3. **Dupliquez la page produit** avec les métadonnées
4. **Partagez l'URL** avec les paramètres `?landing=handle&mapping=id`

### Exemple d'URL de campagne

```
https://votre-boutique.myshopify.com/products/savon-noix-coco?landing=black-friday-2024&mapping=mapping_1754625541045_ubaly9sic
```

## 🔍 Dépannage

### Problème : Le script ne se charge pas

**Solutions :**
- ✅ Vérifiez que le snippet est bien inclus dans `product.liquid`
- ✅ Vérifiez la console pour les erreurs JavaScript
- ✅ Vérifiez que l'URL du backend est correcte

### Problème : Les métadonnées ne sont pas trouvées

**Solutions :**
- ✅ Vérifiez que l'app Shopify a les bonnes permissions
- ✅ Vérifiez que les métadonnées ont été créées
- ✅ Vérifiez le namespace `adlign` dans les métadonnées

### Problème : Les éléments ne sont pas remplacés

**Solutions :**
- ✅ Vérifiez que le mapping contient les bons sélecteurs
- ✅ Activez le mode debug pour voir les logs
- ✅ Vérifiez que les sélecteurs correspondent à votre thème

### Problème : Erreurs CORS

**Solutions :**
- ✅ Configurez CORS sur votre backend
- ✅ Vérifiez que l'URL du backend est accessible
- ✅ Vérifiez les paramètres de sécurité du navigateur

## 📊 Monitoring

### Logs de debug

Activez le mode debug dans les paramètres du thème pour voir :
- Détection des paramètres URL
- Récupération des métadonnées
- Application du mapping
- Erreurs éventuelles

### Indicateur visuel

Le script affiche un indicateur "🎯 Adlign Active" quand il fonctionne correctement.

## 🔒 Sécurité

### Bonnes pratiques

- ✅ Utilisez HTTPS en production
- ✅ Limitez l'accès au backend avec des tokens
- ✅ Validez les paramètres URL
- ✅ Sanitisez le contenu injecté
- ✅ Utilisez des namespaces uniques pour les métadonnées

### Permissions Shopify

Assurez-vous que votre app a ces permissions :
- `read_products` - Lire les produits
- `write_products` - Écrire les métadonnées
- `read_themes` - Lire les thèmes (pour le mapping)

## 🚀 Optimisation

### Performance

- ✅ Le script se charge uniquement sur les pages produit
- ✅ Les animations sont optimisées avec CSS transitions
- ✅ Fallback vers les sélecteurs standards
- ✅ Cache des métadonnées côté client

### Compatibilité

- ✅ Compatible avec tous les thèmes Shopify
- ✅ Fonctionne avec Online Store 2.0
- ✅ Support des thèmes personnalisés
- ✅ Fallback pour les sélecteurs non trouvés

## 📞 Support

En cas de problème :

1. **Vérifiez les logs** de la console du navigateur
2. **Vérifiez les logs** du backend Adlign
3. **Testez avec le serveur de test** local
4. **Consultez la documentation** Shopify

---

**🎯 Adlign est maintenant intégré dans votre boutique Shopify !**
