# 🔐 Scopes Shopify - Adlign

## 📋 Scopes Actuels

```
read_products,write_products,read_metaobjects,write_metaobjects,read_themes,write_themes,write_metaobject_definitions
```

## 🎯 Explication des Scopes

### **Produits**
- `read_products` : Lire les informations des produits
- `write_products` : Modifier les produits (pour les metaobjects)

### **Metaobjects** ⭐ **COMPLET**
- `read_metaobjects` : Lire les metaobjects (landings personnalisées)
- `write_metaobjects` : Créer/modifier les instances de metaobjects
- `write_metaobject_definitions` : **NOUVEAU** - Créer les types de metaobjects

### **Thèmes** ⭐ **NOUVEAU**
- `read_themes` : Lire les fichiers Liquid/HTML du thème
- `write_themes` : Modifier les fichiers du thème (pour injection automatique)

## 🚀 Pourquoi ces scopes ?

### **read_themes**
- **Analyse de structure** : Détecter les sélecteurs CSS dans les fichiers Liquid
- **Mapping automatique** : Identifier les éléments modifiables
- **Compatibilité** : Fonctionner avec tous les thèmes Shopify

### **write_themes**
- **Injection automatique** : Ajouter le script Adlign automatiquement
- **Modifications futures** : Possibilité de modifier le thème si nécessaire
- **Installation simplifiée** : Pas d'intervention manuelle requise

## 🔧 Configuration

### **Fichier .env**
```env
SHOPIFY_SCOPES=read_products,write_products,read_metaobjects,write_metaobjects,read_themes,write_themes,write_metaobject_definitions
```

### **App Shopify**
Dans votre app Shopify, assurez-vous que ces scopes sont configurés dans les paramètres de l'app.

## ⚠️ Important

- **Permissions étendues** : L'app aura accès aux fichiers du thème
- **Sécurité** : Seuls les fichiers nécessaires sont lus/modifiés
- **Transparence** : L'utilisateur voit clairement les permissions demandées

## 🔄 Renouvellement OAuth

Si vous devez renouveler l'OAuth avec les nouveaux scopes :

```bash
curl "http://localhost:3000/renew-auth?shop=votre-boutique.myshopify.com"
```

Puis suivez l'URL générée pour réinstaller l'app avec les nouveaux scopes.
