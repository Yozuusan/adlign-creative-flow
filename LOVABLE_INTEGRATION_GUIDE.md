# 🚀 ADLIGN - GUIDE D'INTÉGRATION LOVABLE

## 📋 **RÉSUMÉ DES MODIFICATIONS**

Date: 09/01/2025
Status: ✅ **POC FONCTIONNEL VALIDÉ**

### 🎯 **OBJECTIF ATTEINT**
Système de personnalisation de pages produit Shopify basé sur des paramètres URL fonctionnel et stable.

---

## 🏗️ **ARCHITECTURE FINALE**

### **Principe de fonctionnement :**
```
URL normale → Page normale (aucun changement)
URL + ?adlign_variant=test → JavaScript détecte et applique les transformations
```

### **Technologies utilisées :**
- **Backend** : Node.js/Express avec API Claude pour auto-mapping
- **Frontend** : JavaScript vanilla avec injection directe dans le DOM
- **Shopify** : Section Liquid personnalisée + assets thème

---

## 📁 **FICHIERS PRINCIPAUX**

### 1. **Script Frontend Principal**
**Fichier :** `adlign-direct-injection.liquid`
**Localisation Shopify :** `sections/adlign-injection.liquid`

**Fonctionnalités :**
- ✅ Injection directe dans toute page `/products/`
- ✅ Détection paramètres URL (`adlign_variant`)
- ✅ Garde-fou anti-double exécution
- ✅ Protection contre modification des prix
- ✅ Logs debug complets
- ✅ Animations visuelles

### 2. **Mapping IA Generated**
**Fichier :** `adlign-mapping-182285697350.json`
**Localisation Shopify :** `assets/adlign-mapping-182285697350.json`

**Contenu :** Sélecteurs CSS générés par Claude AI pour le thème Horizon

### 3. **Backend API**
**Fichier :** `index.js`
**Endpoints actifs :**
- `/analyze-theme` - Génération mapping IA avec Claude
- `/mapping/:mappingId` - Récupération mapping généré
- `/api/campaign/:variant` - Configuration campagnes (pour usage futur)

---

## 🎯 **SÉLECTEURS CSS UTILISÉS**

### **Sélecteurs Actuels (Simplifiés)**
```javascript
const selectors = {
  title: ['h1'],
  cta: ['button[type="submit"]', '[name="add"]'],
  description: ['.product__description:not(.price)', '.rte:not(.price)', '.product-description']
};
```

### **Protection Prix**
```javascript
// Vérifications de sécurité pour éviter de modifier les prix
if (element.closest('.price') || 
    element.classList.contains('price') || 
    element.classList.contains('money') ||
    element.textContent.includes('€') || 
    element.textContent.includes('$')) {
  // Élément ignoré
}
```

### **Sélecteurs IA Disponibles (Non utilisés actuellement)**
```json
{
  "title": ["h1.product__title", ".product-title", "h1"],
  "price": ["product-price [ref='priceContainer']", ".price__current", ".money"],
  "cta": ["[ref='addToCartButton']", "[name='add']", "button[name='add']"],
  "description": [".product__description", ".rte", "[data-product-description]"]
}
```

---

## 🚀 **CAMPAGNES CONFIGURÉES**

### **Campaign "test"**
```javascript
{
  campaign_name: 'Test Campaign - Injection Directe',
  changes: {
    title: '🎯 INJECTION DIRECTE RÉUSSIE !',
    cta: '🎯 INJECTION DIRECTE',
    description: '<p><strong>✅ Injection directe fonctionnelle !</strong> Plus d\'ancien script.</p>'
  }
}
```

### **Campaign "promo"**
```javascript
{
  campaign_name: 'Promotion Spéciale',
  changes: {
    title: '🔥 OFFRE SPÉCIALE LIMITÉE - 50% DE RÉDUCTION',
    cta: '🔥 PROFITER DE L\'OFFRE',
    description: '<p><strong>🔥 Promotion exceptionnelle !</strong> Offre valable jusqu\'à épuisement des stocks.</p>'
  }
}
```

---

## 🔧 **VARIABLES GLOBALES**

### **Variables de Contrôle**
```javascript
window.AdlignDirectActive = true;  // Garde-fou anti-double exécution
window.AdlignDirectDebug = {       // Données de debug
  variant: 'test',
  modifications: 3,
  active: true
};
```

### **Fonction Debug**
```javascript
window.debugAdlignDirect();  // Affiche l'état complet du système
```

---

## 📊 **LOGS SYSTÈME**

### **Format des Logs**
```
🚀 [ADLIGN DIRECT] === INJECTION DIRECTE ===
🧹 [ADLIGN DIRECT] Nettoyage variables...
🎯 [ADLIGN DIRECT] Paramètre détecté: test
🎨 [ADLIGN DIRECT] Application: Test Campaign
✨ [ADLIGN DIRECT] title modifié avec h1
🎉 [ADLIGN DIRECT] Succès ! 3 modifications
```

### **Logs de Sécurité**
```
⚠️ [ADLIGN DIRECT] description - Élément prix ignoré: <div class="price">
```

---

## 🛠️ **DÉPLOIEMENT**

### **URLs de Test**
- **Normal :** `https://adlign.myshopify.com/products/echantillon-savon-a-barres-de-noix-de-coco`
- **Test :** `https://adlign.myshopify.com/products/echantillon-savon-a-barres-de-noix-de-coco?adlign_variant=test`
- **Promo :** `https://adlign.myshopify.com/products/echantillon-savon-a-barres-de-noix-de-coco?adlign_variant=promo`

### **Injection dans Shopify**
```bash
curl -X PUT "https://adlign.myshopify.com/admin/api/2024-07/themes/ID/assets.json" \
  -H "X-Shopify-Access-Token: TOKEN" \
  -d '{"asset": {"key": "sections/adlign-injection.liquid", "value": "SCRIPT_CONTENT"}}'
```

---

## ⚠️ **LIMITATIONS ACTUELLES**

### **Fonctionnalités Désactivées**
- ❌ **Modification des prix** (réservée à Shopify Plus)
- ❌ **Métadonnées Shopify** (trop complexes)
- ❌ **Templates personnalisés** (injection directe préférée)

### **Éléments Protégés**
- 🛡️ **Prix produit** (ne sera jamais modifié)
- 🛡️ **Éléments avec symboles monétaires** (€, $)
- 🛡️ **Classes `.price`, `.money`**

---

## 🚀 **ÉVOLUTIONS PRÉVUES**

### **Phase 2 - Auto-Mapping IA**
- Utiliser les sélecteurs générés par Claude AI
- Chargement mapping depuis asset Shopify
- Fallbacks intelligents par thème

### **Phase 3 - Interface Admin**
- Création campagnes via interface
- Gestion des variantes multiples
- Analytics des transformations

### **Phase 4 - Shopify Plus**
- Modification dynamique des prix
- Gestion avancée des variantes
- Intégration metafields

---

## 🔍 **DEBUGGING**

### **Console Browser**
```javascript
// Vérifier l'état du système
debugAdlignDirect();

// Tester les sélecteurs manuellement
document.querySelectorAll('h1');
document.querySelectorAll('.product__description:not(.price)');

// Vérifier les éléments modifiés
document.querySelectorAll('[data-adlign-direct="true"]');
```

### **Network Tab**
- Vérifier le chargement de `sections/adlign-injection.liquid`
- Pas d'appels vers `localhost` ou API externes

### **Elements Tab**
- Chercher `data-adlign-direct="true"` sur les éléments modifiés
- Vérifier que les prix n'ont pas d'attributs Adlign

---

## ✅ **VALIDATION POC**

### **Critères de Succès**
- [x] Activation conditionnelle par URL
- [x] Modification titre/CTA/description
- [x] Prix intact et non modifié
- [x] Pas de scripts conflictuels
- [x] Logs debug complets
- [x] Animations visuelles
- [x] Système anti-duplication

### **Tests Validés**
- [x] Page normale → Aucun changement
- [x] Page + `?adlign_variant=test` → Transformations appliquées
- [x] Page + `?adlign_variant=promo` → Campagne alternative
- [x] Navigation entre variantes → Pas de duplication
- [x] Rechargement page → Système stable

---

## 📞 **CONTACT TECHNIQUE**

**Développeur :** Assistant Claude (Anthropic)
**Date de livraison :** 09/01/2025
**Version :** POC 1.0 - Injection Directe
**Status :** ✅ Prêt pour intégration Lovable

---

**🎯 Le POC est fonctionnel et prêt pour l'intégration dans l'interface Lovable !**
