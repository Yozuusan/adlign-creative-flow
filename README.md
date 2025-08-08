# Adlign – SaaS de Landing Pages Personnalisées pour Shopify (MVP)

## 🌟 Objectif du projet

**Adlign** permet de générer dynamiquement des landing pages ultra-personnalisées pour les produits Shopify, sans dupliquer les produits ni toucher au thème.  
L'admin Adlign contrôle chaque élément d'une landing via une API (textes, images, pricing, blocks custom...), injectés dynamiquement sur la page produit Shopify.

**🆕 Nouveauté : Mapping Auto IA** - Analyse automatique des thèmes Shopify pour détecter tous les éléments modifiables en quelques secondes.

---

## 🔧 Stack technique

- **Backend** : Node.js + Express (API REST complète)
- **IA** : Claude 3.5 Sonnet pour l'analyse intelligente des thèmes Shopify
- **Base de données** : MVP = stockage local (JSON), migration Shopify metaobjects prévue
- **Shopify** : App custom avec OAuth, scopes étendus (read/write themes, products, metaobjects)
- **Frontend Shopify** : Injection JS dans le template produit (Liquid), détection URL `?landing=...` et `?mapping=...`
- **DevTools** : VS Code / Cursor, REST Client, scripts de démarrage automatisés

---

## 🚀 Fonctionnement MVP actuel

### **1. Analyse Intelligente des Thèmes** 🧠
- **Scan rapide** (15 fichiers) → Résultats en 2-3 secondes pour l'effet "wow"
- **Scan complet** (381+ fichiers) → Analyse exhaustive en arrière-plan (10-15 min)
- **Détection automatique** de tous les éléments modifiables : titre, prix, images, boutons CTA, badges, variantes, galeries, avis, etc.
- **Sélecteurs CSS précis** extraits du code Liquid réel (pas de "devinettes")

### **2. Landing Pages Dynamiques** ⚡
- URL produit avec `?landing=<handle>` et `?mapping=<id>`
- Script JS injecté qui masque le contenu natif et affiche le contenu personnalisé
- Remplacement intelligent des éléments basé sur le mapping IA
- Structure ultra-flexible : tous les éléments sont des "slots" modifiables

### **3. Gestion des Mappings** 📊
- **19+ éléments détectés** automatiquement sur le thème Horizon
- **377 fichiers analysés** pour une couverture complète
- **Stockage intelligent** des mappings avec versioning
- **API complète** pour CRUD des mappings et landing pages

---

## 📂 Ce qui est développé et fonctionnel

### **🧠 Système d'Analyse IA**
- ✅ **Intégration Claude 3.5 Sonnet** - Analyse intelligente des thèmes Shopify
- ✅ **Double stratégie** : Scan rapide (2-3s) + Scan complet (arrière-plan)
- ✅ **Détection automatique** de 19+ types d'éléments (titre, prix, images, CTA, badges, variantes...)
- ✅ **Extraction CSS réelle** - Sélecteurs précis basés sur le code Liquid, pas d'approximation
- ✅ **Rate limiting intelligent** - Gestion automatique des erreurs 429 avec retry

### **🔗 Infrastructure Shopify**
- ✅ **OAuth complet** - Authentification et tokens de boutiques
- ✅ **Scopes étendus** - `read/write_themes`, `read/write_products`, `read/write_metaobjects`
- ✅ **API Shopify Theme** - Accès direct aux fichiers Liquid/HTML du thème actif
- ✅ **Multi-boutiques** - Gestion de plusieurs boutiques simultanément

### **📡 API Backend Complète**
- ✅ **Routes d'analyse** : `/analyze-theme`, `/analyze-theme-smart`, `/scan-complete-theme`
- ✅ **Gestion mappings** : `/mapping/:id`, `/mappings/:shop`, `/test-mapping`
- ✅ **Statut temps réel** : `/scan-status/:shop` pour suivre les scans en cours
- ✅ **Debug & monitoring** : Routes de diagnostic et vérification permissions

### **🎯 Fonctionnalités Testées**
- ✅ **Thème Horizon** - 19 éléments détectés sur 377 fichiers analysés
- ✅ **Script d'injection JS** - Remplacement dynamique des éléments
- ✅ **Stockage persistant** - Mappings sauvegardés en JSON avec ID uniques
- ✅ **Tests automatisés** - Collection REST Client complète

---

## 🚀 Roadmap - Prochaines étapes

### **Phase 1 : Structure Metaobject (Immédiat)**
- 🔄 **Créer la structure metaobject** basée sur les 19 éléments détectés
- 🔄 **API CRUD metaobjects** - Création/édition/suppression des landing pages
- 🔄 **Interface de test** - Validation du remplacement d'éléments en live

### **Phase 2 : Personnalisation Avancée (Court terme)**
- 🎨 **Injection de styles personnalisés** - CSS/JS dynamique
- 📊 **Analytics et A/B testing** - Mesure d'impact automatique
- 🛒 **Expérience d'achat personnalisée** - Panier intelligent
- 👥 **Segmentation client automatique** - Tags et comportements

### **Phase 3 : Automatisation Marketing (Moyen terme)**
- 🎯 **Campagnes générées par IA** - Création automatique
- 📈 **Optimisation continue** - Performance et conversion
- 🤖 **Prédiction comportement client** - IA prédictive
- 📊 **Insights prédictifs** - Recommandations automatiques

### **Phase 4 : Intelligence Artificielle Avancée (Long terme)**
- 🧠 **Optimisation automatique** - Campagnes auto-optimisées
- 📱 **Extensions et widgets** - Personnalisation avancée
- 🔗 **URLs et redirections intelligentes** - SEO dynamique
- 🎯 **Promotions automatiques** - Discounts contextuels

### **Phase 5 : Écosystème Complet (Très long terme)**
- 🌐 **Intégrations tierces** - Google Analytics, Facebook, etc.
- 📈 **Reporting avancé** - Dashboards prédictifs
- 🤖 **Chatbot personnalisé** - Support client IA
- 📱 **Application mobile** - Gestion mobile
- 🌍 **Support multi-langues** - Internationalisation

---

## 👨‍💻 Guide de démarrage

### **🚀 Installation Express**
```bash
# 1. Démarrer le serveur backend
./start-dev.sh
# ou
node index.js

# 2. Vérifier Claude API
curl http://localhost:3000/test-claude

# 3. Vérifier l'authentification Shopify
curl http://localhost:3000/auth-status | jq .
```

### **🧠 Tester l'Analyse IA**
```bash
# Scan rapide (2-3 secondes)
curl -X POST http://localhost:3000/analyze-theme-smart \
  -H "Content-Type: application/json" \
  -d '{"shop_domain": "adlign.myshopify.com"}' | jq .

# Vérifier le statut du scan complet
curl http://localhost:3000/scan-status/adlign.myshopify.com | jq .

# Récupérer un mapping spécifique
curl http://localhost:3000/mapping/mapping_ID | jq .
```

### **🎯 Tester un Mapping**
```bash
curl -X POST http://localhost:3000/test-mapping \
  -H "Content-Type: application/json" \
  -d '{
    "mapping_id": "mapping_1754620066417_u3hwaygju",
    "test_content": {
      "product_title": "🔥 OFFRE EXCLUSIVE - PRODUIT PREMIUM",
      "product_price": "9,90€ au lieu de 19,90€",
      "add_to_cart": "🚀 COMMANDER MAINTENANT"
    }
  }' | jq .
```

### **📱 Test sur Page Produit Shopify**
1. **Injecter le script** `adlign-injection.js` dans le template produit
2. **Ajouter le div** `<div id="adlign-landing"></div>`
3. **Ouvrir l'URL** : `https://shop.myshopify.com/products/produit?landing=handle&mapping=ID`

---

## 📊 Résultats Actuels

### **🎯 Thème Horizon (Test)**
- **19 éléments détectés** automatiquement
- **377 fichiers analysés** en scan complet
- **Sélecteurs CSS précis** : `product-price`, `[ref="addToCartButton"]`, `variant-picker`, etc.
- **Temps de réponse** : 2-3s (scan rapide), 10-15min (scan complet en arrière-plan)

### **🚀 Performance IA**
- **Claude 3.5 Sonnet** - Analyse contextuelle des fichiers Liquid
- **Extraction CSS réelle** - Pas d'approximation, sélecteurs exacts
- **Gestion rate-limiting** - Retry automatique avec pauses intelligentes
- **Fallback robuste** - Patterns Liquid si Claude échoue

---

## 🔑 Avantages Compétitifs

### **🎯 Pour les Marketeurs**
- **Onboarding 1-clic** - Analyse automatique, pas de configuration manuelle
- **Compatible tous thèmes** - Fonctionne sur Dawn, Impulse, custom themes...
- **Pas de duplication produit** - SEO préservé, URLs natives
- **Contrôle total** - Chaque élément modifiable individuellement

### **⚡ Pour les Développeurs**
- **API REST complète** - Intégration facile dans tout workflow
- **Mappings intelligents** - Sélecteurs CSS fiables et maintenables
- **Monitoring intégré** - Logs détaillés, debugging facilité
- **Architecture scalable** - Prêt pour multi-tenant et haute charge

### **🚀 Pour les Agences**
- **Multi-boutiques** - Gestion centralisée de plusieurs clients
- **A/B Testing ready** - Infrastructure préparée pour les tests
- **Campagnes organisées** - Segmentation par client/campagne/objectif
- **ROI mesurable** - Tracking des conversions par landing page

---

## 📞 Contact & Support

> **Fondateur** : [faiizyounes@gmail.com]  
> **Rôle** : CEO-CTO, pilotage hybride business+tech  
> **Support** : Slack disponible pour onboarding développeur rapide 🚀

### **📚 Documentation Technique**
- `MAPPING_AI_README.md` - Guide complet du système d'analyse IA
- `SHOPIFY_SCOPES.md` - Configuration des permissions Shopify  
- `test-theme-analysis.http` - Collection complète de tests API
- `adlign-injection.js` - Script d'injection frontend

**Status Projet** : MVP fonctionnel, prêt pour Phase 1 (Structure Metaobject) 🎯

