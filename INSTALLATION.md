# 🚀 Installation Adlign Backend

## 📋 Prérequis

- Node.js 18+ 
- npm ou yarn
- Compte Shopify Partner
- Clé API Claude (Anthropic)

## 🔧 Installation

### **1. Cloner le projet**
```bash
git clone https://github.com/Yozuusan/adlign-creative-flow.git
cd adlign-creative-flow
```

### **2. Installer les dépendances**
```bash
npm install
```

### **3. Configuration des variables d'environnement**

Créer un fichier `.env` à la racine :

```env
# Clé de chiffrement (OBLIGATOIRE en production)
ENCRYPTION_KEY=votre-clé-secrète-très-longue-et-complexe

# Clés Shopify
SHOPIFY_API_KEY=votre-api-key
SHOPIFY_API_SECRET=votre-api-secret
SHOPIFY_SCOPES=read_products,write_products,read_metaobjects,write_metaobjects,read_themes,write_themes,write_metaobject_definitions

# URL de l'app
SHOPIFY_APP_URL=http://localhost:3000

# Clé Claude AI
CLAUDE_API_KEY=votre-clé-claude-ici
```

### **4. Démarrer le serveur**
```bash
npm start
# ou
node index.js
```

## 🔗 Configuration Shopify

1. **Créer une app personnalisée** dans votre Partner Dashboard
2. **Configurer les scopes** requis
3. **Définir l'URL de redirection** : `http://localhost:3000/auth/callback`
4. **Installer l'app** sur votre boutique de test

## 🧪 Tests

```bash
# Test des endpoints SaaS
curl http://localhost:3000/api/saas/stores

# Test de connexion Shopify
curl -X POST http://localhost:3000/api/saas/connect-shopify \
  -H "Content-Type: application/json" \
  -d '{"shop_domain": "votre-boutique.myshopify.com"}'
```

## 📚 Documentation

- [API SaaS Documentation](SAAS_API_DOCUMENTATION.md)
- [Sécurité](SECURITY.md)
- [Scopes Shopify](SHOPIFY_SCOPES.md)
