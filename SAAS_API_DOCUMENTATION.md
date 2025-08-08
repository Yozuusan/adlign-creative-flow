# 🚀 API SaaS Adlign - Documentation Frontend

## 📋 Vue d'ensemble

Cette API permet au frontend Lovable de gérer les boutiques Shopify, les landing pages personnalisées et les analyses de thèmes via l'IA.

**Base URL**: `http://localhost:3000/api/saas`

## 🔐 Authentification

Tous les endpoints utilisent CORS avec les origines autorisées :
- `http://localhost:5173` (dev local)
- `https://lovable.dev`
- `https://adlign-creative-flow.vercel.app`

## 📡 Endpoints

### 1. 🔗 Connexion Shopify

**POST** `/connect-shopify`

Génère une URL OAuth pour connecter une boutique Shopify.

**Body:**
```json
{
  "shop_domain": "myshop.myshopify.com"
}
```

**Response:**
```json
{
  "success": true,
  "oauth_url": "https://myshop.myshopify.com/admin/oauth/authorize?...",
  "message": "URL OAuth générée pour le frontend"
}
```

**Usage Frontend:**
```javascript
const response = await fetch('/api/saas/connect-shopify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ shop_domain: 'myshop.myshopify.com' })
});

const { oauth_url } = await response.json();
window.open(oauth_url, '_blank'); // Redirige vers OAuth Shopify
```

---

### 2. 🏪 Lister les boutiques

**GET** `/stores`

Récupère toutes les boutiques connectées.

**Response:**
```json
{
  "success": true,
  "stores": [
    {
      "domain": "adlign.myshopify.com",
      "connected": true,
      "connected_at": "2024-08-08T08:20:00.000Z",
      "status": "active"
    }
  ],
  "total": 1
}
```

**Usage Frontend:**
```javascript
const response = await fetch('/api/saas/stores');
const { stores } = await response.json();

// Afficher dans le dashboard
stores.forEach(store => {
  console.log(`${store.domain} - ${store.status}`);
});
```

---

### 3. 📄 Créer une landing page

**POST** `/landings`

Crée une nouvelle landing page personnalisée.

**Body:**
```json
{
  "shop_domain": "adlign.myshopify.com",
  "landing_data": {
    "handle": "black-friday-2024",
    "campaign_name": "Black Friday 2024",
    "mapping_id": "mapping_123",
    "custom_title": "🔥 Black Friday - 50% OFF",
    "custom_description": "Offre exceptionnelle !",
    "custom_price_text": "€99 au lieu de €199",
    "custom_cta_text": "Acheter maintenant",
    "is_active": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Landing page \"black-friday-2024\" créée via SaaS",
  "landing": {
    "id": "landing_1234567890_abc123",
    "handle": "black-friday-2024",
    "shop_domain": "adlign.myshopify.com",
    "created_at": "2024-08-08T08:20:00.000Z",
    "updated_at": "2024-08-08T08:20:00.000Z",
    // ... autres champs
  },
  "storage_type": "local_json"
}
```

---

### 4. 📋 Lister les landings

**GET** `/landings?shop_domain=adlign.myshopify.com`

Récupère toutes les landing pages d'une boutique.

**Response:**
```json
{
  "success": true,
  "landings": [
    {
      "id": "landing_1234567890_abc123",
      "handle": "black-friday-2024",
      "campaign_name": "Black Friday 2024",
      "is_active": true,
      "created_at": "2024-08-08T08:20:00.000Z"
    }
  ],
  "total": 1
}
```

---

### 5. 🔍 Récupérer une landing

**GET** `/landings/:handle?shop_domain=adlign.myshopify.com`

Récupère une landing page spécifique.

**Response:**
```json
{
  "success": true,
  "landing": {
    "id": "landing_1234567890_abc123",
    "handle": "black-friday-2024",
    "custom_title": "🔥 Black Friday - 50% OFF",
    "custom_description": "Offre exceptionnelle !",
    "custom_price_text": "€99 au lieu de €199",
    "custom_cta_text": "Acheter maintenant",
    "is_active": true,
    "created_at": "2024-08-08T08:20:00.000Z",
    "updated_at": "2024-08-08T08:20:00.000Z"
  }
}
```

---

### 6. ✏️ Mettre à jour une landing

**PUT** `/landings/:handle`

Met à jour une landing page existante.

**Body:**
```json
{
  "shop_domain": "adlign.myshopify.com",
  "landing_data": {
    "custom_title": "🔥 Black Friday - 60% OFF (Mise à jour)",
    "custom_price_text": "€79 au lieu de €199"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Landing page \"black-friday-2024\" mise à jour",
  "landing": {
    // Landing mise à jour
  }
}
```

---

### 7. 🗑️ Supprimer une landing

**DELETE** `/landings/:handle?shop_domain=adlign.myshopify.com`

Supprime une landing page.

**Response:**
```json
{
  "success": true,
  "message": "Landing page \"black-friday-2024\" supprimée"
}
```

---

### 8. 🤖 Analyser un thème

**POST** `/analyze-theme`

Analyse le thème d'une boutique avec l'IA pour détecter les éléments modifiables.

**Body:**
```json
{
  "shop_domain": "adlign.myshopify.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Analyse du thème terminée",
  "mapping": {
    "id": "mapping_1234567890",
    "shop_domain": "adlign.myshopify.com",
    "mapping": {
      "product_title": {
        "selector": ".product-title",
        "type": "text",
        "description": "Titre du produit"
      },
      "product_price": {
        "selector": ".product-price",
        "type": "text",
        "description": "Prix du produit"
      }
      // ... autres éléments
    }
  },
  "elements_count": 15
}
```

---

### 9. 📊 Métriques et Analytics

**GET** `/analytics?shop_domain=adlign.myshopify.com`

Récupère les métriques de performance.

**Response:**
```json
{
  "success": true,
  "analytics": {
    "total_shops": 1,
    "total_landings": 5,
    "total_mappings": 3,
    "shop_domain": "adlign.myshopify.com"
  }
}
```

---

### 10. 🧪 Test du workflow

**POST** `/test-workflow`

Teste le workflow complet : landing + mapping + génération de script JS.

**Body:**
```json
{
  "shop_domain": "adlign.myshopify.com",
  "landing_handle": "black-friday-2024"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Workflow SaaS testé pour \"black-friday-2024\"",
  "landing": { /* landing data */ },
  "mapping": { /* mapping data */ },
  "replacements": {
    ".product-title": {
      "content": "🔥 Black Friday - 50% OFF",
      "type": "text"
    }
  },
  "elements_count": 5,
  "js_script": "// Script JS généré pour l'injection..."
}
```

## 🎯 Intégration Frontend Lovable

### Configuration dans le frontend

```javascript
// config/api.js
const API_BASE_URL = 'http://localhost:3000/api/saas';

export const apiClient = {
  // Connexion Shopify
  connectShopify: async (shopDomain) => {
    const response = await fetch(`${API_BASE_URL}/connect-shopify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_domain: shopDomain })
    });
    return response.json();
  },

  // Lister les boutiques
  getStores: async () => {
    const response = await fetch(`${API_BASE_URL}/stores`);
    return response.json();
  },

  // Créer une landing
  createLanding: async (shopDomain, landingData) => {
    const response = await fetch(`${API_BASE_URL}/landings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_domain: shopDomain, landing_data: landingData })
    });
    return response.json();
  },

  // Analyser un thème
  analyzeTheme: async (shopDomain) => {
    const response = await fetch(`${API_BASE_URL}/analyze-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_domain: shopDomain })
    });
    return response.json();
  }
};
```

### Usage dans les composants React

```javascript
// pages/Connect.tsx
import { apiClient } from '@/config/api';

const Connect = () => {
  const [shop, setShop] = useState("");
  const [connected, setConnected] = useState(false);

  const handleConnect = async () => {
    if (!shop) {
      toast("Enter your shop domain");
      return;
    }

    try {
      const { oauth_url } = await apiClient.connectShopify(shop);
      window.open(oauth_url, "_blank");
      setConnected(true);
      toast("Connection flow started in a new tab.");
    } catch (error) {
      toast.error("Connection failed");
    }
  };

  // ... reste du composant
};
```

## 🚀 Prochaines étapes

1. **Tester les endpoints** avec le fichier `test-saas-endpoints.http`
2. **Intégrer dans le frontend** Lovable
3. **Ajouter la gestion d'erreurs** côté frontend
4. **Implémenter la synchronisation** avec Supabase
5. **Ajouter l'authentification** multi-tenant

## 📝 Notes importantes

- Tous les endpoints retournent `{ success: boolean }`
- Les erreurs incluent un message descriptif
- Le stockage actuel est local (`local_landings.json`)
- L'IA utilise Claude 3.5 Sonnet pour l'analyse des thèmes
- CORS est configuré pour les origines Lovable
