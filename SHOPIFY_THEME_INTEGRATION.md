# 🎨 Guide d'Intégration Thème Shopify - Adlign

## 📁 **Fichiers à Ajouter au Thème**

### **1. Section : `sections/adlign-mapping-section.liquid`**
```liquid
{%- comment -%}
Section qui lit le metafield adlign.settings et applique le mapping
{%- endcomment -%}
```
**📍 Emplacement :** `sections/adlign-mapping-section.liquid`

### **2. Template : `templates/product.adlign.json`**
```json
{
  "sections": {
    "adlign_mapping": {
      "type": "adlign-mapping-section"
    },
    "main": {
      "type": "main-product"
    }
  }
}
```
**📍 Emplacement :** `templates/product.adlign.json`

## 🚀 **Installation**

### **Étape 1 : Upload des Fichiers**
1. **Via l'Admin Shopify :**
   - Aller dans `Online Store` → `Themes` → `Actions` → `Edit code`
   - Créer `sections/adlign-mapping-section.liquid`
   - Créer `templates/product.adlign.json`

2. **Via l'API Shopify :**
   ```bash
   # Le backend Adlign peut automatiquement uploader ces fichiers
   POST /api/saas/install-theme-files
   ```

### **Étape 2 : Test**
1. **Dupliquer un produit** via le SaaS Adlign
2. **Vérifier** que le template `adlign` est assigné
3. **Visiter** la page produit
4. **Observer** les éléments remplacés dynamiquement

## 🎯 **Fonctionnement**

### **Workflow Complet**
```
SaaS Adlign → API Backend → Metafield settings → Template adlign → Section mapping → DOM Update
```

### **1. SaaS Génère le Mapping**
- Analyse IA du thème
- Création du mapping CSS/XPath
- Données de contenu personnalisé

### **2. Backend Crée les Metafields**
```json
{
  "adlign_data.settings": {
    "landing_handle": "black-friday-2024",
    "mapping": {
      "product_title": ".product__title",
      "product_description": ".product__description",
      "add_to_cart": "[data-add-to-cart]"
    },
    "content": {
      "custom_title": "🔥 BLACK FRIDAY -70%",
      "custom_description": "Offre limitée!",
      "custom_cta_text": "⚡ JE PROFITE"
    }
  }
}
```

### **3. Template Adlign Chargé**
- Produit assigné au template `product.adlign.json`
- Section `adlign-mapping-section` incluse
- JavaScript lit le metafield et applique le mapping

### **4. Résultat Final**
- ✅ Titre remplacé par le contenu personnalisé
- ✅ Description mise à jour
- ✅ CTA modifié
- ✅ Animations fluides
- ✅ Indicateur visuel de succès

## 🔧 **Personnalisation**

### **Sélecteurs de Fallback**
La section inclut des sélecteurs de fallback pour maximiser la compatibilité :
```javascript
const fallbacks = [
  '[data-product-title]',
  '.product-title',
  '.product__title',
  'h1'
];
```

### **Types d'Éléments Supportés**
- `product_title` → Custom title
- `product_description` → Custom description  
- `product_price` → Custom price text
- `add_to_cart` → Custom CTA
- `vendor` → Custom vendor
- Et plus...

### **Mode Debug**
```liquid
{% assign debug_mode = true %}
```
Active les logs détaillés dans la console.

## 🎨 **Styles Inclus**

### **Animations**
```css
.adlign-updated {
  animation: adlignFadeIn 0.5s ease-in-out;
}
```

### **Indicateur de Succès**
```css
.adlign-indicator {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #10B981;
}
```

## 🧪 **Test Local**

### **URL de Test**
```
https://boutique.myshopify.com/products/produit-test?template=adlign
```

### **Vérifications**
1. ✅ Metafield `adlign.settings` présent
2. ✅ Template `product.adlign.json` actif
3. ✅ Section `adlign-mapping-section` chargée
4. ✅ JavaScript applique le mapping
5. ✅ Contenu remplacé dynamiquement

## 📊 **Monitoring**

### **Console Logs**
```javascript
[Adlign] Application du mapping...
[Adlign] ✅ product_title mis à jour
[Adlign] ✅ product_description mis à jour
```

### **Indicateurs Visuels**
- 🟢 Badge vert : Personnalisation active
- ✨ Animations : Éléments mis à jour
- 📱 Compatible mobile

## 🚨 **Troubleshooting**

### **Problème : Aucun changement visible**
1. Vérifier le metafield `adlign_data.settings`
2. Contrôler l'assignation du template
3. Examiner les logs console
4. Tester les sélecteurs CSS

### **Problème : Sélecteurs incorrects**
1. Utiliser l'outil d'inspection
2. Mettre à jour le mapping
3. Ajouter des fallbacks
4. Régénérer le mapping IA

## 🎯 **Prochaines Étapes**

1. **Installer** les fichiers dans le thème
2. **Tester** avec un produit
3. **Valider** le fonctionnement
4. **Déployer** en production

---

**🎨 Votre thème Shopify est maintenant compatible Adlign !**
