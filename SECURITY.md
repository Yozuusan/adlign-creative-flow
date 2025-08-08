# 🔒 Sécurité Adlign Backend

## ✅ Corrections de sécurité implémentées

### 1. **CORS sécurisé**
- ✅ Validation stricte des origines autorisées
- ✅ Fonction de validation personnalisée
- ✅ Headers et méthodes limités
- ✅ Cache CORS configuré (24h)

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'https://lovable.dev',
  'https://adlign-creative-flow.vercel.app'
];
```

### 2. **Protection CSRF OAuth**
- ✅ State unique généré avec `crypto.randomBytes(32)`
- ✅ Validation du state dans le callback
- ✅ Expiration automatique (10 minutes)
- ✅ Stockage temporaire avec nettoyage

```javascript
const state = crypto.randomBytes(32).toString('hex');
stateStore.set(state, {
  shop: shop,
  timestamp: Date.now(),
  ip: req.ip
});
```

### 3. **Chiffrement des tokens Shopify**
- ✅ Chiffrement AES-256-CBC des tokens
- ✅ IV unique pour chaque token
- ✅ Clé de chiffrement configurable via `ENCRYPTION_KEY`
- ✅ Stockage sécurisé avec métadonnées

```javascript
const { encrypted, iv } = encryptToken(access_token);
shopTokens[shop] = {
  token: encrypted,
  iv: iv.toString('hex'),
  created_at: new Date().toISOString(),
  ip: req.ip
};
```

### 4. **Rate Limiting**
- ✅ Limite de 100 requêtes par IP par fenêtre de 15 minutes
- ✅ Nettoyage automatique des anciennes requêtes
- ✅ Réponse HTTP 429 appropriée

### 5. **Sanitization des inputs**
- ✅ Suppression des balises HTML
- ✅ Suppression des protocoles dangereux
- ✅ Limitation de la longueur des inputs

### 6. **Sanitization des logs**
- ✅ Masquage des données sensibles
- ✅ Suppression des caractères dangereux
- ✅ Limitation de la longueur des logs

## 🚨 Variables d'environnement requises

```bash
# Clé de chiffrement (OBLIGATOIRE en production)
ENCRYPTION_KEY=votre-clé-secrète-très-longue-et-complexe

# Clés Shopify
SHOPIFY_API_KEY=votre-api-key
SHOPIFY_API_SECRET=votre-api-secret
SHOPIFY_SCOPES=read_products,write_products,read_metaobjects,write_metaobjects,read_themes,write_themes,write_metaobject_definitions

# URL de l'app
SHOPIFY_APP_URL=http://localhost:3000

# Clé Claude AI
CLAUDE_API_KEY=votre-clé-claude
```

## 🔧 Configuration recommandée pour la production

### 1. **Base de données sécurisée**
```javascript
// Remplacer le stockage JSON par une base de données
// - PostgreSQL avec chiffrement au repos
// - Redis pour le cache et les sessions
// - Chiffrement des colonnes sensibles
```

### 2. **Authentification robuste**
```javascript
// Ajouter JWT avec rotation des tokens
// Implémenter l'authentification multi-tenant
// Ajouter la validation des permissions
```

### 3. **Monitoring et alertes**
```javascript
// Logs structurés (Winston/Pino)
// Monitoring des tentatives d'attaque
// Alertes en temps réel
```

### 4. **HTTPS obligatoire**
```javascript
// Certificats SSL/TLS
// HSTS headers
// CSP (Content Security Policy)
```

## 🧪 Tests de sécurité

### Test CORS
```bash
curl -H "Origin: https://evil.com" http://localhost:3000/api/saas/stores
# Doit retourner une erreur CORS
```

### Test Rate Limiting
```bash
# Faire 101 requêtes rapides
for i in {1..101}; do curl http://localhost:3000/api/saas/stores; done
# La 101ème doit retourner 429
```

### Test OAuth State
```bash
# Essayer d'accéder au callback sans state valide
curl "http://localhost:3000/auth/callback?shop=test.myshopify.com&code=invalid"
# Doit retourner 403
```

## 📋 Checklist de déploiement

- [ ] Variable `ENCRYPTION_KEY` configurée
- [ ] HTTPS activé
- [ ] Base de données sécurisée
- [ ] Monitoring configuré
- [ ] Logs sécurisés
- [ ] Tests de sécurité passés
- [ ] Documentation équipe mise à jour

## 🆘 En cas de compromission

1. **Révoquer immédiatement** les tokens Shopify
2. **Changer** la clé de chiffrement
3. **Analyser** les logs pour identifier l'attaque
4. **Mettre à jour** les dépendances
5. **Auditer** le code pour d'autres vulnérabilités

## 📞 Contact sécurité

Pour signaler une vulnérabilité :
- Email : security@adlign.com
- GitHub : Issue privée avec label "security"
- Réponse sous 24h garantie
