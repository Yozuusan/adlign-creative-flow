const { request, gql } = require('graphql-request');
const fs = require('fs');
const path = require('path');
const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();        // <--- cette ligne AVANT app.use()

// Stockage sécurisé des states OAuth (en production, utiliser Redis)
const stateStore = new Map();

// Rate limiting simple (en production, utiliser Redis ou un middleware dédié)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requêtes par fenêtre

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, []);
  }
  
  const requests = rateLimitStore.get(ip);
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  validRequests.push(now);
  rateLimitStore.set(ip, validRequests);
  return true;
}

// Middleware CORS pour les appels depuis Shopify
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Middleware de rate limiting
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please try again later.'
    });
  }
  
  next();
});

// Fonctions utilitaires de sécurité
const crypto = require('crypto');

function encryptToken(token) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key-change-in-prod', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { encrypted, iv: iv.toString('hex') };
}

function decryptToken(encrypted, iv) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key-change-in-prod', 'salt', 32);
  const decipher = crypto.createDecipher(algorithm, key);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Sanitization des inputs
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/[<>]/g, '') // Supprimer les balises HTML
    .replace(/javascript:/gi, '') // Supprimer les protocoles dangereux
    .trim();
}

// Sanitization des logs
function sanitizeLog(message) {
  if (typeof message !== 'string') return '[Object]';
  return message
    .replace(/password|token|secret|key/gi, '[REDACTED]')
    .replace(/[<>]/g, '')
    .substring(0, 1000); // Limiter la longueur
}

app.use(cors());
app.use(cookieParser());



app.get('/', (req, res) => {
  // Shopify va appeler la racine avec ?shop=xxx lors de l'installation personnalisée
  const shop = req.query.shop;
  if (shop) {
    // Redirige vers le flow OAuth natif (toujours dynamique)
    res.redirect(`/auth?shop=${shop}`);
  } else {
    // Si jamais pas de shop, affiche un message d'erreur simple
    res.send('Paramètre "shop" manquant dans l’URL.');
  }
});

const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOPIFY_SCOPES,
  SHOPIFY_APP_URL,
} = process.env;

// 1. Lancement du flow OAuth sécurisé
app.get('/auth', (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send('Paramètre "shop" manquant');
  
  // Validation du domaine Shopify
  if (!shop.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/)) {
    return res.status(400).send('Domaine Shopify invalide');
  }
  
  // Génération d'un state unique et sécurisé
  const crypto = require('crypto');
  const state = crypto.randomBytes(32).toString('hex');
  
  // Stockage temporaire du state (en production, utiliser Redis)
  const stateStore = new Map();
  stateStore.set(state, {
    shop: shop,
    timestamp: Date.now(),
    ip: req.ip
  });
  
  // Nettoyage des states expirés (plus de 10 minutes)
  const now = Date.now();
  for (const [key, value] of stateStore.entries()) {
    if (now - value.timestamp > 600000) { // 10 minutes
      stateStore.delete(key);
    }
  }
  
  const redirectUri = `${SHOPIFY_APP_URL}/auth/callback`;
  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${SHOPIFY_API_KEY}` +
    `&scope=${SHOPIFY_SCOPES}` +
    `&redirect_uri=${redirectUri}` +
    `&state=${state}` +
    `&grant_options[]=per-user`;

  res.redirect(installUrl);
});

// 2. Callback OAuth - récupération du token
app.get('/auth/callback', async (req, res) => {
  const { shop, code } = req.query;
  if (!shop || !code) return res.send('Paramètres manquants');

  try {
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code,
    });

   const { access_token } = tokenResponse.data;

// ======= Gestion du stockage des tokens =======
const tokensPath = path.join(__dirname, 'shop_tokens.json');
let shopTokens = {};
if (fs.existsSync(tokensPath)) {
  shopTokens = JSON.parse(fs.readFileSync(tokensPath));
}
shopTokens[shop] = access_token;
fs.writeFileSync(tokensPath, JSON.stringify(shopTokens, null, 2));
console.log(`✅ [${shop}] Nouveau token sauvegardé`);
// ==============================================

res.send('OAuth Shopify réussi ! Tu peux continuer le dev.');
  } catch (error) {
    console.error('Erreur OAuth Shopify:', error.response?.data || error.message);
    res.status(500).send('Erreur lors du callback OAuth');
  }
});


// Endpoint pour lister les produits de la boutique connectée
app.get('/products', async (req, res) => {
  const shop = 'adlign.myshopify.com'; // adapte au tien si besoin
  const tokensPath = path.join(__dirname, 'shop_tokens.json');
  let shopTokens = {};
  if (fs.existsSync(tokensPath)) {
    shopTokens = JSON.parse(fs.readFileSync(tokensPath));
  }
  const access_token = shopTokens[shop];

  if (!access_token) {
    return res.status(401).send('Token Shopify manquant pour ce shop');
  }

  try {
    const response = await axios.get(`https://${shop}/admin/api/2024-07/products.json`, {
      headers: {
        'X-Shopify-Access-Token': access_token,
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error('Erreur API Shopify :', error.response?.data || error.message);
    res.status(500).send('Erreur API Shopify');
  }
});

// PORT sera défini plus tard

// ===== SYSTÈME HYBRIDE - STOCKAGE LOCAL LANDING PAGES =====

// Créer une landing page avec stockage local (alternative aux metaobjects)
app.post('/create-local-landing', express.json(), async (req, res) => {
  const { shop_domain, landing_data } = req.body;
  
  if (!shop_domain || !landing_data) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain et landing_data requis' 
    });
  }

  if (!landing_data.handle || !landing_data.mapping_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'handle et mapping_id requis dans landing_data' 
    });
  }

  try {
    console.log(`🚀 Création landing page locale: ${landing_data.handle} pour ${shop_domain}`);
    
    // Ajouter métadonnées
    const landingWithMeta = {
      ...landing_data,
      id: `landing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      shop_domain: shop_domain,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Stockage local dans un fichier JSON
    const landingsPath = path.join(__dirname, 'local_landings.json');
    let allLandings = {};
    
    if (fs.existsSync(landingsPath)) {
      allLandings = JSON.parse(fs.readFileSync(landingsPath, 'utf8'));
    }

    if (!allLandings[shop_domain]) {
      allLandings[shop_domain] = {};
    }

    allLandings[shop_domain][landing_data.handle] = landingWithMeta;
    
    fs.writeFileSync(landingsPath, JSON.stringify(allLandings, null, 2));

    console.log(`✅ Landing page locale créée: ${landing_data.handle}`);

    res.json({ 
      success: true, 
      message: `Landing page "${landing_data.handle}" créée avec succès (stockage local)`,
      landing: landingWithMeta,
      storage_type: "local_json"
    });

  } catch (error) {
    console.error('❌ Erreur création landing page locale:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la création de la landing page locale',
      message: error.message 
    });
  }
});

// Récupérer une landing page locale par handle
app.get('/local-landing/:handle', async (req, res) => {
  const { handle } = req.params;
  const { shop_domain } = req.query;

  if (!shop_domain) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain requis en query parameter' 
    });
  }

  try {
    console.log(`🔍 Récupération landing page locale: ${handle} pour ${shop_domain}`);
    
    const landingsPath = path.join(__dirname, 'local_landings.json');
    
    if (!fs.existsSync(landingsPath)) {
      return res.status(404).json({ 
        success: false, 
        error: `Aucune landing page trouvée` 
      });
    }

    const allLandings = JSON.parse(fs.readFileSync(landingsPath, 'utf8'));
    
    if (!allLandings[shop_domain] || !allLandings[shop_domain][handle]) {
      return res.status(404).json({ 
        success: false, 
        error: `Landing page "${handle}" non trouvée pour ${shop_domain}` 
      });
    }

    const landing = allLandings[shop_domain][handle];

    console.log(`✅ Landing page locale trouvée: ${handle}`);

    res.json({ 
      success: true, 
      landing: landing,
      storage_type: "local_json"
    });

  } catch (error) {
    console.error('❌ Erreur récupération landing page locale:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération de la landing page locale',
      message: error.message 
    });
  }
});

// Lister toutes les landing pages locales d'une boutique
app.get('/local-landings/:shop_domain', async (req, res) => {
  const { shop_domain } = req.params;

  try {
    console.log(`📋 Liste des landing pages locales pour ${shop_domain}`);
    
    const landingsPath = path.join(__dirname, 'local_landings.json');
    
    if (!fs.existsSync(landingsPath)) {
      return res.json({ 
        success: true, 
        count: 0,
        landings: [],
        storage_type: "local_json"
      });
    }

    const allLandings = JSON.parse(fs.readFileSync(landingsPath, 'utf8'));
    
    if (!allLandings[shop_domain]) {
      return res.json({ 
        success: true, 
        count: 0,
        landings: [],
        storage_type: "local_json"
      });
    }

    const landings = Object.values(allLandings[shop_domain]);

    console.log(`✅ ${landings.length} landing pages locales trouvées`);

    res.json({ 
      success: true, 
      count: landings.length,
      landings: landings,
      storage_type: "local_json"
    });

  } catch (error) {
    console.error('❌ Erreur liste landing pages locales:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des landing pages locales',
      message: error.message 
    });
  }
});

// Route de test pour workflow complet avec stockage local : Landing Page + Mapping
app.post('/test-local-workflow', express.json(), async (req, res) => {
  const { shop_domain, landing_handle } = req.body;
  
  if (!shop_domain || !landing_handle) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain et landing_handle requis' 
    });
  }

  try {
    console.log(`🧪 Test workflow local complet: ${landing_handle} pour ${shop_domain}`);
    
    // 1. Récupérer la landing page locale
    const landingResponse = await fetch(`http://localhost:3000/local-landing/${landing_handle}?shop_domain=${shop_domain}`);
    const landingResult = await landingResponse.json();
    
    if (!landingResult.success) {
      return res.status(404).json({ 
        success: false, 
        error: 'Landing page locale non trouvée',
        details: landingResult 
      });
    }

    // 2. Récupérer le mapping associé
    const mapping_id = landingResult.landing.mapping_id;
    const mappingResponse = await fetch(`http://localhost:3000/mapping/${mapping_id}`);
    const mappingResult = await mappingResponse.json();
    
    if (!mappingResult.success) {
      return res.status(404).json({ 
        success: false, 
        error: 'Mapping non trouvé',
        details: mappingResult 
      });
    }

    // 3. Simuler le remplacement des éléments
    const replacements = {};
    const landingData = landingResult.landing;
    const mappingData = mappingResult.mapping.mapping;

    // Mapper le contenu personnalisé avec les sélecteurs CSS
    if (landingData.custom_title && mappingData.product_title) {
      replacements.product_title = {
        selector: mappingData.product_title.selector,
        original_content: "{{ product.title }}",
        new_content: landingData.custom_title,
        type: "text"
      };
    }

    if (landingData.custom_price_text && mappingData.product_price) {
      replacements.product_price = {
        selector: mappingData.product_price.selector,
        original_content: "{{ product.price | money }}",
        new_content: landingData.custom_price_text,
        type: "text"
      };
    }

    if (landingData.custom_cta_text && mappingData.add_to_cart) {
      replacements.add_to_cart = {
        selector: mappingData.add_to_cart.selector,
        original_content: "Ajouter au panier",
        new_content: landingData.custom_cta_text,
        type: "text"
      };
    }

    if (landingData.custom_description && mappingData.product_description) {
      replacements.product_description = {
        selector: mappingData.product_description.selector,
        original_content: "{{ product.description }}",
        new_content: landingData.custom_description,
        type: "text"
      };
    }

    // Ajouter mapping pour galerie et inventaire (nouveaux éléments détectés)
    if (mappingData.product_gallery) {
      replacements.product_gallery = {
        selector: mappingData.product_gallery.selector,
        original_content: "galerie originale",
        new_content: landingData.custom_main_image || "image personnalisée",
        type: "image"
      };
    }

    if (mappingData.variant_selector) {
      replacements.variant_selector = {
        selector: mappingData.variant_selector.selector,
        original_content: "sélecteur original",
        new_content: "Choisir une option",
        type: "component"
      };
    }

    // Générer le script JS pour le frontend
    const jsScript = generateLandingScript(replacements, landingData);

    console.log(`✅ Workflow local testé: ${Object.keys(replacements).length} éléments à remplacer`);

    res.json({ 
      success: true, 
      message: `Workflow local complet testé pour "${landing_handle}"`,
      storage_type: "local_json",
      landing: landingResult.landing,
      mapping: mappingData,
      replacements: replacements,
      elements_count: Object.keys(replacements).length,
      js_script: jsScript
    });

  } catch (error) {
    console.error('❌ Erreur test workflow local complet:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du test du workflow local complet',
      message: error.message 
    });
  }
});

// Créer le type metaobject Adlign Landing Page - Version Complète
app.post('/create-adlign-metaobject-type', express.json(), async (req, res) => {
  const { shop_domain } = req.body;
  if (!shop_domain) {
    return res.status(400).json({ error: 'shop_domain requis' });
  }

  const tokensPath = path.join(__dirname, 'shop_tokens.json');
  let shopTokens = {};
  if (fs.existsSync(tokensPath)) {
    shopTokens = JSON.parse(fs.readFileSync(tokensPath));
  }
  const access_token = shopTokens[shop_domain];

  if (!access_token) {
    return res.status(401).json({ error: 'Token Shopify manquant pour ce shop' });
  }

  const endpoint = `https://${shop_domain}/admin/api/2024-07/graphql.json`;

  // Structure metaobject complète basée sur les 19 éléments détectés par l'IA
  const mutation = gql`
  mutation {
    metaobjectDefinitionCreate(
      definition: {
        name: "Adlign Landing Page"
        type: "page"
                         access: { storefront: PUBLIC_READ }
        fieldDefinitions: [
                               # MÉTADONNÉES DE LA LANDING
                     { name: "Handle Unique", key: "landing_handle", type: "single_line_text_field", required: true, description: "Identifiant unique (ex: landing-promo-noel-2024)" }
          { name: "Nom de Campagne", key: "campaign_name", type: "single_line_text_field", required: false, description: "Nom de la campagne marketing" }
          { name: "ID Mapping Thème", key: "mapping_id", type: "single_line_text_field", required: true, description: "ID du mapping généré par l'IA" }
          { name: "Domaine Boutique", key: "shop_domain", type: "single_line_text_field", required: true, description: "Domaine de la boutique Shopify" }
          
          # ÉLÉMENTS TEXTUELS (7 champs)
          { name: "Titre Personnalisé", key: "custom_title", type: "single_line_text_field", required: false, description: "Remplace le titre produit original" }
          { name: "Description Personnalisée", key: "custom_description", type: "multi_line_text_field", required: false, description: "Remplace la description produit" }
          { name: "Texte Prix Personnalisé", key: "custom_price_text", type: "single_line_text_field", required: false, description: "Prix avec mise en forme" }
          { name: "Texte Bouton CTA", key: "custom_cta_text", type: "single_line_text_field", required: false, description: "Texte du bouton d'ajout panier" }
          { name: "Badges Personnalisés", key: "custom_badges", type: "multi_line_text_field", required: false, description: "Badges promotionnels (JSON array)" }
          { name: "Marque Personnalisée", key: "custom_vendor", type: "single_line_text_field", required: false }
          { name: "Message d'Urgence", key: "custom_urgency_text", type: "single_line_text_field", required: false, description: "Message de rareté/urgence" }
          
          # ÉLÉMENTS VISUELS (4 champs)
          { name: "Image Principale", key: "custom_main_image", type: "file_reference", required: false, description: "Remplace l'image produit principale" }
          { name: "Galerie Images", key: "custom_gallery", type: "list.file_reference", required: false, description: "Images supplémentaires" }
          { name: "URL Vidéo", key: "custom_video_url", type: "url", required: false, description: "Vidéo de démonstration" }
          { name: "Badges de Confiance", key: "custom_trust_badges", type: "list.file_reference", required: false, description: "Logos sécurité, garanties" }
          
          # ÉLÉMENTS COMMERCIAUX (3 champs)
          { name: "Info Livraison", key: "custom_shipping_text", type: "single_line_text_field", required: false, description: "Message livraison personnalisé" }
          { name: "Code Promo", key: "custom_discount_code", type: "single_line_text_field", required: false }
          { name: "Produits Upsell", key: "custom_upsell_products", type: "list.product_reference", required: false, description: "Produits recommandés" }
          
          # CONFIGURATION AVANCÉE (5 champs)
          { name: "Landing Active", key: "is_active", type: "boolean", required: false, description: "Si la landing est active" }
          { name: "Groupe A/B Test", key: "ab_test_group", type: "single_line_text_field", required: false, description: "Version A, B, C..." }
          { name: "Audience Cible", key: "target_audience", type: "single_line_text_field", required: false, description: "Segment marketing ciblé" }
          { name: "CSS Personnalisé", key: "custom_css", type: "multi_line_text_field", required: false, description: "Styles CSS additionnels" }
          { name: "Données Analytics", key: "analytics_data", type: "json", required: false, description: "Métriques de performance" }
        ]
      }
    ) {
      metaobjectDefinition {
        id
        name
        type
        fieldDefinitions {
          name
          key
          type {
            name
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;


  try {
    console.log(`🏗️ Création du type metaobject Adlign Landing Page pour ${shop_domain}`);
    
    const data = await request(
      endpoint,
      mutation,
      {},
      {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json",
      }
    );
    
    if (data.metaobjectDefinitionCreate.userErrors.length > 0) {
      console.error('❌ Erreurs lors de la création:', data.metaobjectDefinitionCreate.userErrors);
      return res.status(400).json({ 
        success: false, 
        errors: data.metaobjectDefinitionCreate.userErrors 
      });
    }
    
    const metaobjectDef = data.metaobjectDefinitionCreate.metaobjectDefinition;
    console.log(`✅ Type metaobject créé: ${metaobjectDef.name} (${metaobjectDef.type})`);
    console.log(`📊 ${metaobjectDef.fieldDefinitions.length} champs créés`);
    
    res.json({ 
      success: true, 
      message: `Type metaobject "Adlign Landing Page" créé avec ${metaobjectDef.fieldDefinitions.length} champs`,
      metaobjectDefinition: metaobjectDef 
    });
    
  } catch (error) {
    console.error('❌ Erreur création metaobject type:', error);
    
    if (error.response && error.response.errors) {
      console.error('Détails GraphQL:', error.response.errors);
      return res.status(500).json({ success: false, errors: error.response.errors });
    }
    if (error.response && error.response.data) {
      console.error('Données réponse:', error.response.data);
      return res.status(500).json({ success: false, errors: error.response.data });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la création du type metaobject',
      message: error.message 
    });
  }
});

// ===== ROUTES CRUD POUR LES LANDING PAGES =====

// Créer une nouvelle landing page
app.post('/create-adlign-landing', express.json(), async (req, res) => {
  const { shop_domain, landing_data } = req.body;
  
  if (!shop_domain || !landing_data) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain et landing_data requis' 
    });
  }

  const tokensPath = path.join(__dirname, 'shop_tokens.json');
  let shopTokens = {};
  if (fs.existsSync(tokensPath)) {
    shopTokens = JSON.parse(fs.readFileSync(tokensPath));
  }
  const access_token = shopTokens[shop_domain];

  if (!access_token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Token Shopify manquant pour ce shop' 
    });
  }

  const endpoint = `https://${shop_domain}/admin/api/2024-07/graphql.json`;

  // Construire les champs pour la mutation
  const buildFieldsForMutation = (data) => {
    const fields = [];
    
    // Champs obligatoires
    if (data.handle) fields.push(`{ key: "handle", value: "${data.handle}" }`);
    if (data.mapping_id) fields.push(`{ key: "mapping_id", value: "${data.mapping_id}" }`);
    if (data.shop_domain) fields.push(`{ key: "shop_domain", value: "${data.shop_domain}" }`);
    
    // Champs optionnels textuels
    if (data.campaign_name) fields.push(`{ key: "campaign_name", value: "${data.campaign_name}" }`);
    if (data.custom_title) fields.push(`{ key: "custom_title", value: "${data.custom_title}" }`);
    if (data.custom_description) fields.push(`{ key: "custom_description", value: "${data.custom_description}" }`);
    if (data.custom_price_text) fields.push(`{ key: "custom_price_text", value: "${data.custom_price_text}" }`);
    if (data.custom_cta_text) fields.push(`{ key: "custom_cta_text", value: "${data.custom_cta_text}" }`);
    if (data.custom_badges) fields.push(`{ key: "custom_badges", value: "${data.custom_badges}" }`);
    if (data.custom_vendor) fields.push(`{ key: "custom_vendor", value: "${data.custom_vendor}" }`);
    if (data.custom_urgency_text) fields.push(`{ key: "custom_urgency_text", value: "${data.custom_urgency_text}" }`);
    if (data.custom_shipping_text) fields.push(`{ key: "custom_shipping_text", value: "${data.custom_shipping_text}" }`);
    if (data.custom_discount_code) fields.push(`{ key: "custom_discount_code", value: "${data.custom_discount_code}" }`);
    if (data.ab_test_group) fields.push(`{ key: "ab_test_group", value: "${data.ab_test_group}" }`);
    if (data.target_audience) fields.push(`{ key: "target_audience", value: "${data.target_audience}" }`);
    if (data.custom_css) fields.push(`{ key: "custom_css", value: "${data.custom_css}" }`);
    
    // Champ boolean
    if (typeof data.is_active === 'boolean') {
      fields.push(`{ key: "is_active", value: "${data.is_active}" }`);
    }
    
    // URL
    if (data.custom_video_url) fields.push(`{ key: "custom_video_url", value: "${data.custom_video_url}" }`);
    
    return fields.join(',\n          ');
  };

  const mutation = gql`
  mutation {
    metaobjectCreate(
      metaobject: {
        type: "adlign_landing_page"
        fields: [
          ${buildFieldsForMutation(landing_data)}
        ]
      }
    ) {
      metaobject {
        id
        handle
        fields {
          key
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
  `;

  try {
    console.log(`🚀 Création landing page: ${landing_data.handle} pour ${shop_domain}`);
    
    const data = await request(endpoint, mutation, {}, {
      "X-Shopify-Access-Token": access_token,
      "Content-Type": "application/json",
    });

    if (data.metaobjectCreate.userErrors.length > 0) {
      console.error('❌ Erreurs création landing:', data.metaobjectCreate.userErrors);
      return res.status(400).json({ 
        success: false, 
        errors: data.metaobjectCreate.userErrors 
      });
    }

    const metaobject = data.metaobjectCreate.metaobject;
    console.log(`✅ Landing page créée: ${metaobject.handle}`);

    res.json({ 
      success: true, 
      message: `Landing page "${landing_data.handle}" créée avec succès`,
      metaobject: metaobject 
    });

  } catch (error) {
    console.error('❌ Erreur création landing page:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la création de la landing page',
      message: error.message 
    });
  }
});

// Récupérer une landing page par handle
app.get('/adlign-landing/:handle', async (req, res) => {
  const { handle } = req.params;
  const { shop_domain } = req.query;

  if (!shop_domain) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain requis en query parameter' 
    });
  }

  const tokensPath = path.join(__dirname, 'shop_tokens.json');
  let shopTokens = {};
  if (fs.existsSync(tokensPath)) {
    shopTokens = JSON.parse(fs.readFileSync(tokensPath));
  }
  const access_token = shopTokens[shop_domain];

  if (!access_token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Token Shopify manquant pour ce shop' 
    });
  }

  const endpoint = `https://${shop_domain}/admin/api/2024-07/graphql.json`;

  const query = gql`
  query {
    metaobject(id: "gid://shopify/Metaobject/adlign_landing_page/${handle}") {
      id
      handle
      type
      fields {
        key
        value
      }
    }
  }
  `;

  try {
    console.log(`🔍 Récupération landing page: ${handle} pour ${shop_domain}`);
    
    const data = await request(endpoint, query, {}, {
      "X-Shopify-Access-Token": access_token,
      "Content-Type": "application/json",
    });

    if (!data.metaobject) {
      return res.status(404).json({ 
        success: false, 
        error: `Landing page "${handle}" non trouvée` 
      });
    }

    // Transformer les fields en objet plus lisible
    const landingData = {};
    data.metaobject.fields.forEach(field => {
      landingData[field.key] = field.value;
    });

    console.log(`✅ Landing page trouvée: ${handle}`);

    res.json({ 
      success: true, 
      landing: {
        id: data.metaobject.id,
        handle: data.metaobject.handle,
        type: data.metaobject.type,
        data: landingData
      }
    });

  } catch (error) {
    console.error('❌ Erreur récupération landing page:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération de la landing page',
      message: error.message 
    });
  }
});

// Lister toutes les landing pages d'une boutique
app.get('/adlign-landings/:shop_domain', async (req, res) => {
  const { shop_domain } = req.params;

  const tokensPath = path.join(__dirname, 'shop_tokens.json');
  let shopTokens = {};
  if (fs.existsSync(tokensPath)) {
    shopTokens = JSON.parse(fs.readFileSync(tokensPath));
  }
  const access_token = shopTokens[shop_domain];

  if (!access_token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Token Shopify manquant pour ce shop' 
    });
  }

  const endpoint = `https://${shop_domain}/admin/api/2024-07/graphql.json`;

  const query = gql`
  query {
    metaobjects(type: "adlign_landing_page", first: 50) {
      edges {
        node {
          id
          handle
          fields {
            key
            value
          }
        }
      }
    }
  }
  `;

  try {
    console.log(`📋 Liste des landing pages pour ${shop_domain}`);
    
    const data = await request(endpoint, query, {}, {
      "X-Shopify-Access-Token": access_token,
      "Content-Type": "application/json",
    });

    const landings = data.metaobjects.edges.map(edge => {
      const landingData = {};
      edge.node.fields.forEach(field => {
        landingData[field.key] = field.value;
      });
      
      return {
        id: edge.node.id,
        handle: edge.node.handle,
        data: landingData
      };
    });

    console.log(`✅ ${landings.length} landing pages trouvées`);

    res.json({ 
      success: true, 
      count: landings.length,
      landings: landings 
    });

  } catch (error) {
    console.error('❌ Erreur liste landing pages:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des landing pages',
      message: error.message 
    });
  }
});

// Route de test pour workflow complet : Landing Page + Mapping
app.post('/test-complete-workflow', express.json(), async (req, res) => {
  const { shop_domain, landing_handle } = req.body;
  
  if (!shop_domain || !landing_handle) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain et landing_handle requis' 
    });
  }

  try {
    console.log(`🧪 Test workflow complet: ${landing_handle} pour ${shop_domain}`);
    
    // 1. Récupérer la landing page
    const landingResponse = await fetch(`http://localhost:3000/adlign-landing/${landing_handle}?shop_domain=${shop_domain}`);
    const landingResult = await landingResponse.json();
    
    if (!landingResult.success) {
      return res.status(404).json({ 
        success: false, 
        error: 'Landing page non trouvée',
        details: landingResult 
      });
    }

    // 2. Récupérer le mapping associé
    const mapping_id = landingResult.landing.data.mapping_id;
    const mappingResponse = await fetch(`http://localhost:3000/mapping/${mapping_id}`);
    const mappingResult = await mappingResponse.json();
    
    if (!mappingResult.success) {
      return res.status(404).json({ 
        success: false, 
        error: 'Mapping non trouvé',
        details: mappingResult 
      });
    }

    // 3. Simuler le remplacement des éléments
    const replacements = {};
    const landingData = landingResult.landing.data;
    const mappingData = mappingResult.mapping;

    // Mapper le contenu personnalisé avec les sélecteurs CSS
    if (landingData.custom_title && mappingData.product_title) {
      replacements.product_title = {
        selector: mappingData.product_title.selector,
        original_content: "{{ product.title }}",
        new_content: landingData.custom_title,
        type: "text"
      };
    }

    if (landingData.custom_price_text && mappingData.product_price) {
      replacements.product_price = {
        selector: mappingData.product_price.selector,
        original_content: "{{ product.price | money }}",
        new_content: landingData.custom_price_text,
        type: "text"
      };
    }

    if (landingData.custom_cta_text && mappingData.add_to_cart) {
      replacements.add_to_cart = {
        selector: mappingData.add_to_cart.selector,
        original_content: "Ajouter au panier",
        new_content: landingData.custom_cta_text,
        type: "text"
      };
    }

    if (landingData.custom_description && mappingData.product_description) {
      replacements.product_description = {
        selector: mappingData.product_description.selector,
        original_content: "{{ product.description }}",
        new_content: landingData.custom_description,
        type: "text"
      };
    }

    // Générer le script JS pour le frontend
    const jsScript = generateLandingScript(replacements, landingData);

    console.log(`✅ Workflow testé: ${Object.keys(replacements).length} éléments à remplacer`);

    res.json({ 
      success: true, 
      message: `Workflow complet testé pour "${landing_handle}"`,
      landing: landingResult.landing,
      mapping: mappingData,
      replacements: replacements,
      elements_count: Object.keys(replacements).length,
      js_script: jsScript
    });

  } catch (error) {
    console.error('❌ Erreur test workflow complet:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du test du workflow complet',
      message: error.message 
    });
  }
});

// Fonction utilitaire pour générer le script JS d'injection
function generateLandingScript(replacements, landingData) {
  const scriptLines = [
    "// Script d'injection Adlign - Généré automatiquement",
    "console.log('🚀 Adlign Landing Page activée');",
    ""
  ];

  // Générer les remplacements
  Object.entries(replacements).forEach(([elementType, replacement]) => {
    scriptLines.push(`// Remplacement: ${elementType}`);
    scriptLines.push(`const ${elementType}Element = document.querySelector('${replacement.selector}');`);
    scriptLines.push(`if (${elementType}Element) {`);
    
    if (replacement.type === 'text') {
      scriptLines.push(`  ${elementType}Element.innerHTML = '${replacement.new_content}';`);
    } else if (replacement.type === 'image') {
      scriptLines.push(`  ${elementType}Element.src = '${replacement.new_content}';`);
    }
    
    scriptLines.push(`  console.log('✅ ${elementType} remplacé');`);
    scriptLines.push(`} else {`);
    scriptLines.push(`  console.warn('⚠️ Élément ${elementType} non trouvé: ${replacement.selector}');`);
    scriptLines.push(`}`);
    scriptLines.push("");
  });

  // Ajouter CSS personnalisé si présent
  if (landingData.custom_css) {
    scriptLines.push("// CSS personnalisé");
    scriptLines.push("const customStyle = document.createElement('style');");
    scriptLines.push(`customStyle.innerHTML = \`${landingData.custom_css}\`;`);
    scriptLines.push("document.head.appendChild(customStyle);");
    scriptLines.push("");
  }

  // Ajouter badges si présents
  if (landingData.custom_badges) {
    scriptLines.push("// Badges personnalisés");
    scriptLines.push(`const badges = '${landingData.custom_badges}'.split(',');`);
    scriptLines.push("badges.forEach(badge => {");
    scriptLines.push("  const badgeElement = document.createElement('span');");
    scriptLines.push("  badgeElement.className = 'adlign-badge';");
    scriptLines.push("  badgeElement.textContent = badge.trim();");
    scriptLines.push("  // Ajouter le badge quelque part sur la page");
    scriptLines.push("});");
    scriptLines.push("");
  }

  scriptLines.push("console.log('🎯 Landing page Adlign chargée avec succès');");

  return scriptLines.join('\n');
}

app.post('/create-landing', express.json(), async (req, res) => {
  const shop = 'adlign.myshopify.com'; // à rendre dynamique plus tard
  const tokensPath = path.join(__dirname, 'shop_tokens.json');
  let shopTokens = {};
  if (fs.existsSync(tokensPath)) {
    shopTokens = JSON.parse(fs.readFileSync(tokensPath));
  }
  const access_token = shopTokens[shop];

  if (!access_token) {
    return res.status(401).send('Token Shopify manquant pour ce shop');
  }

  const endpoint = `https://${shop}/admin/api/2024-07/graphql.json`;

  // Récupérer le body JSON envoyé (données landing)
  const {
    headline,
    hero_image_id,     // ID du fichier image Shopify (pour MVP, à uploader manuellement d'abord)
    description,
    cta_text,
    special_price,
    video_url,
    product_gid        // Shopify Product GID (ex: "gid://shopify/Product/1234567890")
  } = req.body;

  // Mutation pour créer une instance de metaobject "Landing Adlign"
  const mutation = gql`
    mutation CreateLandingAdlign($fields: [MetaobjectFieldInput!]!) {
      metaobjectCreate(
        metaobject: {
          type: "landing_adlign"
          fields: $fields
        }
      ) {
        metaobject {
          id
          handle
          type
          fields {
            key
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const fields = [
  headline && { key: "headline", value: headline },
  hero_image_id && { key: "hero_image", value: hero_image_id },
  description && { key: "description", value: description },
  cta_text && { key: "cta_text", value: cta_text },
  special_price && { key: "special_price", value: special_price.toString() },
  video_url && { key: "video_url", value: video_url },
  product_gid && { key: "product_ref", value: product_gid }
].filter(Boolean);

  try {
    const data = await request(
      endpoint,
      mutation,
      { fields },
      {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json",
      }
    );
    if (data.metaobjectCreate.userErrors.length > 0) {
      return res.status(400).json({ errors: data.metaobjectCreate.userErrors });
    }
    res.json({ status: "success", metaobject: data.metaobjectCreate.metaobject });
  } catch (error) {
  if (error.response && error.response.data) {
    console.error('Erreur Shopify GraphQL:', error.response.data);
    return res.status(500).json({ errors: error.response.data });
  }
  if (error.response && error.response.errors) {
    console.error('Erreur Shopify GraphQL:', error.response.errors);
    return res.status(500).json({ errors: error.response.errors });
  }
  console.error('Erreur création landing:', error.message);
  res.status(500).send('Erreur lors de la création de la landing');
}
});

app.get('/list-landings', async (req, res) => {
  const shop = 'adlign.myshopify.com'; // à rendre dynamique plus tard
  const tokensPath = path.join(__dirname, 'shop_tokens.json');
  let shopTokens = {};
  if (fs.existsSync(tokensPath)) {
    shopTokens = JSON.parse(fs.readFileSync(tokensPath));
  }
  const access_token = shopTokens[shop];
  if (!access_token) {
    return res.status(401).send('Token Shopify manquant pour ce shop');
  }

  const endpoint = `https://${shop}/admin/api/2024-07/graphql.json`;
  const query = gql`
    query {
      metaobjects(first: 30, type: "landing_adlign") {
        edges {
          node {
            id
            handle
            fields {
              key
              value
            }
            updatedAt
            createdAt
          }
        }
      }
    }
  `;

  try {
    const data = await request(
      endpoint,
      query,
      {},
      {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json",
      }
    );
    res.json({ status: 'success', landings: data.metaobjects.edges.map(edge => edge.node) });
  } catch (error) {
    if (error.response && error.response.data) {
      console.error('Erreur Shopify GraphQL:', error.response.data);
      return res.status(500).json({ errors: error.response.data });
    }
    console.error('Erreur listing landings:', error.message);
    res.status(500).send('Erreur lors du listing des landings');
  }
});

// ROUTE TEST MVP : Sert une landing dynamique JSON pour le frontend Shopify
app.get('/landing/:handle', async (req, res) => {
  const { handle } = req.params;
  // Pour MVP : hardcode la landing Adlign ici
  if (handle === 'landing-adlign-llebaq5f') {
    res.json({
      headline: "OFFRE EXCLUSIVE - ECHANTILLON GOURMAND",
      badges: ["NOUVEAU", "SAVON NATUREL"],
      review_count: "1450",
      review_stars: 4.8,
      hero_image: "https://cdn.shopify.com/s/files/1/xxxx/image.jpg",
      subheadline: "Profite d'un test sans engagement, livraison rapide",
      description: "Le savon idéal pour peaux sensibles, zéro parfum, zéro allergène. Fabriqué en France, utilisé par plus de 5000 clients satisfaits.",
      features: [
        "100% naturel",
        "Convient à toute la famille",
        "Sans allergène",
        "Zéro déchet"
      ],
      secondary_images: [
        "https://cdn.shopify.com/s/files/1/xxxx/image1.jpg",
        "https://cdn.shopify.com/s/files/1/xxxx/image2.jpg"
      ],
      blocks: [
        {
          type: "cta",
          text: "J'en profite tout de suite !",
          href: "#add-to-cart"
        }
      ],
      pack_pricing: [
        {
          title: "1 échantillon",
          price: "3,90€"
        },
        {
          title: "Pack Découverte (3x)",
          price: "9,90€"
        }
      ]
    });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// ===== MAPPING AUTO IA =====

// Route pour analyser la structure du thème Shopify et générer le mapping automatique
app.post('/analyze-theme', express.json(), async (req, res) => {
  const { shop_domain } = req.body;
  
  if (!shop_domain) {
    return res.status(400).json({ error: 'shop_domain requis' });
  }

  try {
    console.log(`🔍 Analyse de la structure du thème: ${shop_domain}`);
    
    // 1. Récupérer le token d'accès pour ce shop
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath));
    }
    
    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({ 
        error: 'Token Shopify manquant',
        message: `Aucun token trouvé pour ${shop_domain}. Installez l'app Adlign d'abord.`
      });
    }
    
    // 2. Analyser la structure du thème
    const themeStructure = await analyzeThemeStructure(shop_domain, accessToken);
    
    // 3. Analyser avec Claude AI pour améliorer le mapping
    const enhancedMapping = await enhanceMappingWithAI(themeStructure, shop_domain, accessToken);
    
    // 4. Sauvegarder le mapping
    const mappingId = saveMapping(shop_domain, `theme_${themeStructure.theme_name}`, enhancedMapping);
    
    res.json({
      success: true,
      mapping_id: mappingId,
      theme_info: {
        id: themeStructure.theme_id,
        name: themeStructure.theme_name,
        files_analyzed: themeStructure.files_analyzed.length
      },
      mapping: enhancedMapping,
      message: `Mapping généré avec ${Object.keys(enhancedMapping).length} éléments détectés`
    });
    
  } catch (error) {
    console.error('Erreur analyse thème:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour scan rapide + complet en arrière-plan
app.post('/analyze-theme-smart', express.json(), async (req, res) => {
  const { shop_domain } = req.body;
  
  if (!shop_domain) {
    return res.status(400).json({ error: 'shop_domain requis' });
  }

  try {
    console.log(`🚀 ANALYSE INTELLIGENTE du thème: ${shop_domain}`);
    
    // 1. Récupérer le token d'accès
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath));
    }
    
    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({ 
        error: 'Token Shopify manquant',
        message: `Aucun token trouvé pour ${shop_domain}. Installez l'app Adlign d'abord.`
      });
    }
    
    // 2. SCAN RAPIDE (15 fichiers les plus importants)
    console.log(`⚡ SCAN RAPIDE en cours...`);
    const themeStructure = await analyzeThemeStructure(shop_domain, accessToken);
    const enhancedMapping = await enhanceMappingWithAI(themeStructure, shop_domain, accessToken);
    const mappingId = saveMapping(shop_domain, `scan_rapide_${themeStructure.theme_name}`, enhancedMapping);
    
    // 3. Réponse immédiate avec le scan rapide
    const quickResponse = {
      success: true,
      mapping_id: mappingId,
      scan_type: 'rapide',
      theme_info: {
        id: themeStructure.theme_id,
        name: themeStructure.theme_name,
        files_analyzed: themeStructure.files_analyzed.length
      },
      mapping: enhancedMapping,
      message: `⚡ Scan rapide terminé: ${Object.keys(enhancedMapping).length} éléments détectés`,
      background_scan: {
        status: 'en_cours',
        message: 'Scan complet en cours en arrière-plan...'
      }
    };
    
    // 4. Lancer le scan complet en arrière-plan
    console.log(`🔄 Lancement du scan complet en arrière-plan...`);
    setTimeout(async () => {
      try {
        console.log(`🔍 SCAN COMPLET en arrière-plan: ${shop_domain}`);
        
        // Récupérer TOUS les fichiers
        const { theme, files } = await fetchThemeFiles(shop_domain, accessToken);
        const allFiles = files.map(f => f.key);
        
        const completeStructure = {
          theme_id: theme.id,
          theme_name: theme.name,
          files_analyzed: [],
          product_elements: {}
        };
        
        // Analyser tous les fichiers avec retry
        for (let i = 0; i < allFiles.length; i++) {
          const fileName = allFiles[i];
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount < maxRetries) {
            try {
              const content = await fetchLiquidFile(shop_domain, accessToken, theme.id, fileName);
              completeStructure.files_analyzed.push(fileName);
              
              const elements = analyzeLiquidContent(content, fileName);
              Object.assign(completeStructure.product_elements, elements);
              
              if (Object.keys(elements).length > 0) {
                console.log(`✅ [Background] ${fileName} analysé (${Object.keys(elements).length} éléments)`);
              }
              break;
              
            } catch (error) {
              retryCount++;
              if (error.message.includes('429') && retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 3000));
              } else {
                break;
              }
            }
          }
          
          // Pause anti-rate-limiting
          if (i % 3 === 0 && i > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        // Améliorer avec Claude AI
        const completeMapping = await enhanceMappingWithAI(completeStructure, shop_domain, accessToken);
        const completeMappingId = saveMapping(shop_domain, `scan_complet_${completeStructure.theme_name}`, completeMapping);
        
        console.log(`✅ SCAN COMPLET terminé: ${Object.keys(completeMapping).length} éléments sur ${completeStructure.files_analyzed.length} fichiers`);
        
        // Sauvegarder le statut du scan complet
        const scanStatus = {
          scan_complete: true,
          complete_mapping_id: completeMappingId,
          elements_detected: Object.keys(completeMapping).length,
          files_analyzed: completeStructure.files_analyzed.length,
          completed_at: new Date().toISOString()
        };
        
        fs.writeFileSync(`scan_status_${shop_domain}.json`, JSON.stringify(scanStatus, null, 2));
        
      } catch (error) {
        console.error('❌ Erreur scan complet en arrière-plan:', error);
      }
    }, 1000); // Démarrer après 1 seconde
    
    res.json(quickResponse);
    
  } catch (error) {
    console.error('Erreur analyse intelligente:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour vérifier le statut du scan complet
app.get('/scan-status/:shop_domain', (req, res) => {
  const { shop_domain } = req.params;
  
  try {
    const statusFile = `scan_status_${shop_domain}.json`;
    if (fs.existsSync(statusFile)) {
      const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      res.json({
        success: true,
        scan_complete: true,
        ...status
      });
    } else {
      res.json({
        success: true,
        scan_complete: false,
        message: 'Scan complet en cours...'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route pour scan complet (tous les fichiers)
app.post('/scan-complete-theme', express.json(), async (req, res) => {
  const { shop_domain } = req.body;
  
  if (!shop_domain) {
    return res.status(400).json({ error: 'shop_domain requis' });
  }

  try {
    console.log(`🔍 SCAN COMPLET du thème: ${shop_domain}`);
    
    // 1. Récupérer le token d'accès
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath));
    }
    
    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({ 
        error: 'Token Shopify manquant',
        message: `Aucun token trouvé pour ${shop_domain}. Installez l'app Adlign d'abord.`
      });
    }
    
    // 2. Récupérer TOUS les fichiers du thème
    const { theme, files } = await fetchThemeFiles(shop_domain, accessToken);
    
    console.log(`📁 Scan complet: ${files.length} fichiers totaux`);
    
    // 3. Analyser TOUS les fichiers (pas seulement product-related)
    const allFiles = files.map(f => f.key);
    const themeStructure = {
      theme_id: theme.id,
      theme_name: theme.name,
      files_analyzed: [],
      product_elements: {}
    };
    
    // 4. Analyser chaque fichier avec retry
    for (let i = 0; i < allFiles.length; i++) {
      const fileName = allFiles[i];
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const content = await fetchLiquidFile(shop_domain, accessToken, theme.id, fileName);
          themeStructure.files_analyzed.push(fileName);
          
          // Analyser le contenu pour détecter les éléments
          const elements = analyzeLiquidContent(content, fileName);
          Object.assign(themeStructure.product_elements, elements);
          
          if (Object.keys(elements).length > 0) {
            console.log(`✅ ${fileName} analysé (${Object.keys(elements).length} éléments détectés)`);
          }
          break;
          
        } catch (error) {
          retryCount++;
          if (error.message.includes('429') && retryCount < maxRetries) {
            console.warn(`⚠️ Rate limit (429) pour ${fileName}, retry ${retryCount}/${maxRetries} dans 3s...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            console.warn(`⚠️ Erreur analyse ${fileName}: ${error.message}`);
            break;
          }
        }
      }
      
      // Pause plus longue pour éviter le rate limiting
      if (i % 3 === 0 && i > 0) {
        console.log(`⏸️ Pause de 2s après ${i} fichiers analysés...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // 5. Améliorer avec Claude AI
    const enhancedMapping = await enhanceMappingWithAI(themeStructure, shop_domain, accessToken);
    
    // 6. Sauvegarder le mapping complet
    const mappingId = saveMapping(shop_domain, `scan_complet_${themeStructure.theme_name}`, enhancedMapping);
    
    res.json({
      success: true,
      mapping_id: mappingId,
      theme_info: {
        id: themeStructure.theme_id,
        name: themeStructure.theme_name,
        files_analyzed: themeStructure.files_analyzed.length,
        total_files: files.length
      },
      mapping: enhancedMapping,
      message: `Scan complet terminé: ${Object.keys(enhancedMapping).length} éléments détectés sur ${themeStructure.files_analyzed.length} fichiers analysés`
    });
    
  } catch (error) {
    console.error('Erreur scan complet:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour récupérer un mapping existant
app.get('/mapping/:mappingId', (req, res) => {
  const { mappingId } = req.params;
  
  try {
    const mapping = getMapping(mappingId);
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping non trouvé' });
    }
    
    res.json({ success: true, mapping });
  } catch (error) {
    console.error('Erreur récupération mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour lister tous les mappings d'un shop
app.get('/mappings/:shopDomain', (req, res) => {
  const { shopDomain } = req.params;
  
  try {
    const mappings = getAllMappings(shopDomain);
    res.json({ success: true, mappings });
  } catch (error) {
    console.error('Erreur listing mappings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour tester un mapping sur une page
app.post('/test-mapping', express.json(), async (req, res) => {
  const { mapping_id, test_content } = req.body;
  
  try {
    const mapping = getMapping(mapping_id);
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping non trouvé' });
    }
    
    // Générer le script JS de test
    const testScript = generateTestScript(mapping, test_content);
    
    res.json({
      success: true,
      test_script: testScript,
      message: 'Script de test généré'
    });
    
  } catch (error) {
    console.error('Erreur test mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour vérifier l'état de l'authentification Shopify
app.get('/auth-status', (req, res) => {
  const tokensPath = path.join(__dirname, 'shop_tokens.json');
  let shopTokens = {};
  
  if (fs.existsSync(tokensPath)) {
    shopTokens = JSON.parse(fs.readFileSync(tokensPath));
  }
  
  const shops = Object.keys(shopTokens);
  const status = {};
  
  shops.forEach(shop => {
    status[shop] = {
      has_token: !!shopTokens[shop],
      token_preview: shopTokens[shop] ? shopTokens[shop].substring(0, 10) + '...' : null
    };
  });
  
  res.json({
    success: true,
    shops: status,
    message: `Tokens trouvés pour ${shops.length} boutique(s)`
  });
});

// Route pour renouveler l'authentification Shopify
app.get('/renew-auth', (req, res) => {
  const shop = req.query.shop || 'adlign.myshopify.com';
  
  if (!shop) {
    return res.status(400).json({ error: 'Paramètre shop requis' });
  }
  
  const redirectUri = `${process.env.SHOPIFY_APP_URL || 'http://localhost:3000'}/auth/callback`;
  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_API_KEY || 'your_api_key'}` +
    `&scope=${process.env.SHOPIFY_SCOPES || 'read_products,write_products,read_themes,write_themes'}` +
    `&redirect_uri=${redirectUri}` +
    `&state=renew_auth_${Date.now()}` +
    `&grant_options[]=per-user`;

  res.json({
    success: true,
    message: 'URL de renouvellement générée',
    install_url: installUrl,
    instructions: 'Cliquez sur le lien install_url pour renouveler l\'authentification'
  });
});

// Route pour tester les permissions Shopify
app.get('/test-shopify-permissions', async (req, res) => {
  const shop = 'adlign.myshopify.com';
  const tokensPath = path.join(__dirname, 'shop_tokens.json');
  let shopTokens = {};
  
  if (fs.existsSync(tokensPath)) {
    shopTokens = JSON.parse(fs.readFileSync(tokensPath));
  }
  
  const accessToken = shopTokens[shop];
  if (!accessToken) {
    return res.status(401).json({ error: 'Token Shopify manquant' });
  }
  
  try {
    // Test 1: API Produits (devrait fonctionner)
    const productsResponse = await axios.get(`https://${shop}/admin/api/2024-07/products.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      }
    });
    
    // Test 2: API Thèmes (peut nécessiter des scopes spéciaux)
    let themesResponse;
    try {
      themesResponse = await axios.get(`https://${shop}/admin/api/2024-07/themes.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        }
      });
    } catch (error) {
      themesResponse = { error: error.response?.data || error.message };
    }
    
    res.json({
      success: true,
      tests: {
        products: {
          status: 'success',
          count: productsResponse.data.products?.length || 0
        },
        themes: themesResponse.error ? {
          status: 'error',
          error: themesResponse.error
        } : {
          status: 'success',
          count: themesResponse.data.themes?.length || 0
        }
      },
      message: 'Tests de permissions Shopify effectués'
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Erreur test permissions',
      message: error.message 
    });
  }
});

// Route pour tester la configuration Claude API
app.get('/test-claude', async (req, res) => {
  try {
    if (!process.env.CLAUDE_API_KEY) {
      return res.status(400).json({ 
        error: 'CLAUDE_API_KEY non configurée',
        message: 'Ajoutez CLAUDE_API_KEY dans votre fichier .env'
      });
    }
    
    const anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });
    
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 100,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: "Dis-moi juste 'Claude API fonctionne !' en français"
        }
      ]
    });
    
    res.json({
      success: true,
      message: 'Claude API configurée et fonctionnelle',
      response: message.content[0].text,
      model: "claude-3-5-sonnet-20241022"
    });
    
  } catch (error) {
    console.error('Erreur test Claude API:', error);
    res.status(500).json({ 
      error: 'Erreur Claude API',
      message: error.message,
      details: 'Vérifiez votre clé API et votre connexion internet'
    });
  }
});

// Route pour debug - lister les fichiers du thème
app.post('/debug-theme-files', express.json(), async (req, res) => {
  const { shop_domain } = req.body;
  
  if (!shop_domain) {
    return res.status(400).json({ error: 'shop_domain requis' });
  }

  try {
    console.log(`🔍 Debug fichiers thème: ${shop_domain}`);
    
    // Récupérer le token d'accès
    const tokens = JSON.parse(fs.readFileSync('shop_tokens.json', 'utf8'));
    const accessToken = tokens[shop_domain];
    
    if (!accessToken) {
      return res.status(401).json({ error: 'Token d\'accès non trouvé' });
    }
    
    // Récupérer les fichiers du thème
    const { theme, files } = await fetchThemeFiles(shop_domain, accessToken);
    
    // Filtrer les fichiers product-related
    const productFiles = files.filter(file => 
      file.key.includes('product') || 
      file.key.includes('templates') ||
      file.key.includes('sections')
    );
    
    res.json({
      success: true,
      theme: {
        id: theme.id,
        name: theme.name,
        total_files: files.length
      },
      product_files: productFiles.map(f => ({
        key: f.key,
        size: f.size
      })),
      all_files_sample: files.slice(0, 20).map(f => f.key)
    });
    
  } catch (error) {
    console.error('Erreur debug thème:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour tester l'analyse avec une boutique publique
app.post('/test-public-shop', express.json(), async (req, res) => {
  const { product_url } = req.body;
  
  if (!product_url) {
    return res.status(400).json({ error: 'product_url requis' });
  }

  try {
    console.log(`🧪 Test avec boutique publique: ${product_url}`);
    
    // Récupérer le HTML de la page produit
    const html = await fetchProductPageHTML(product_url);
    
    // Analyser avec Claude
    const mapping = await analyzePageWithAI(html, product_url);
    
    res.json({
      success: true,
      mapping: mapping,
      html_length: html.length,
      message: `Analyse réussie avec ${Object.keys(mapping).length} éléments détectés`
    });
    
  } catch (error) {
    console.error('Erreur test boutique publique:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== FONCTIONS UTILITAIRES MAPPING =====

// Récupérer les fichiers Liquid/HTML du thème via l'API Admin Shopify
async function fetchThemeFiles(shopDomain, accessToken) {
  try {
    console.log(`📁 Récupération des fichiers du thème pour ${shopDomain}`);
    
    // 1. Récupérer le thème actif
    const themesResponse = await axios.get(`https://${shopDomain}/admin/api/2024-07/themes.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      }
    });
    
    const activeTheme = themesResponse.data.themes.find(theme => theme.role === 'main');
    if (!activeTheme) {
      throw new Error('Aucun thème actif trouvé');
    }
    
    console.log(`✅ Thème actif: ${activeTheme.name} (ID: ${activeTheme.id})`);
    
    // 2. Récupérer tous les fichiers du thème
    const filesResponse = await axios.get(`https://${shopDomain}/admin/api/2024-07/themes/${activeTheme.id}/assets.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      }
    });
    
    const themeFiles = filesResponse.data.assets;
    console.log(`📄 ${themeFiles.length} fichiers trouvés dans le thème`);
    
    return {
      theme: activeTheme,
      files: themeFiles
    };
    
  } catch (error) {
    throw new Error(`Erreur récupération thème: ${error.message}`);
  }
}

// Récupérer le contenu d'un fichier Liquid spécifique
async function fetchLiquidFile(shopDomain, accessToken, themeId, fileName) {
  try {
    const response = await axios.get(`https://${shopDomain}/admin/api/2024-07/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(fileName)}`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      }
    });
    
    if (response.data.asset) {
      return response.data.asset.value;
    }
    
    throw new Error(`Fichier ${fileName} non trouvé`);
    
  } catch (error) {
    throw new Error(`Erreur récupération fichier ${fileName}: ${error.message}`);
  }
}

// Analyser la structure du thème pour détecter les éléments modifiables
async function analyzeThemeStructure(shopDomain, accessToken) {
  try {
    console.log(`🔍 Analyse de la structure du thème ${shopDomain}`);
    
    // Récupérer les fichiers du thème
    const { theme, files } = await fetchThemeFiles(shopDomain, accessToken);
    
    // Analyser TOUS les fichiers product-related (beaucoup plus complet)
    const allProductFiles = files.filter(file => 
      file.key.includes('product') || 
      file.key.includes('collection') ||
      file.key.includes('cart') ||
      file.key.includes('media') ||
      file.key.includes('gallery') ||
      file.key.includes('reviews') ||
      file.key.includes('badge') ||
      file.key.includes('variant') ||
      file.key.includes('price') ||
      file.key.includes('title') ||
      file.key.includes('description') ||
      file.key.includes('featured') ||
      file.key.includes('recommendations')
    );
    
    console.log(`🔍 ${allProductFiles.length} fichiers product-related trouvés`);
    
    // Analyser seulement les fichiers les plus importants (scan rapide)
    const importantFiles = allProductFiles.slice(0, 15).map(f => f.key);
    console.log(`🔍 Scan rapide: ${importantFiles.length} fichiers les plus importants`);
    
    const themeStructure = {
      theme_id: theme.id,
      theme_name: theme.name,
      files_analyzed: [],
      product_elements: {}
    };
    
    // Analyser chaque fichier important avec gestion des erreurs 429
    for (let i = 0; i < importantFiles.length; i++) {
      const fileName = importantFiles[i];
      const fileExists = files.find(file => file.key === fileName);
      
      if (fileExists) {
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            const content = await fetchLiquidFile(shopDomain, accessToken, theme.id, fileName);
            themeStructure.files_analyzed.push(fileName);
            
            // Analyser le contenu Liquid pour détecter les éléments
            const elements = analyzeLiquidContent(content, fileName);
            Object.assign(themeStructure.product_elements, elements);
            
            console.log(`✅ ${fileName} analysé (${Object.keys(elements).length} éléments détectés)`);
            break; // Succès, sortir de la boucle retry
            
          } catch (error) {
            retryCount++;
            if (error.message.includes('429') && retryCount < maxRetries) {
              console.warn(`⚠️ Rate limit (429) pour ${fileName}, retry ${retryCount}/${maxRetries} dans 2s...`);
              await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre 2s
            } else {
              console.warn(`⚠️ Erreur analyse ${fileName}: ${error.message}`);
              break; // Sortir de la boucle retry
            }
          }
        }
        
        // Pause entre les fichiers pour éviter le rate limiting
        if (i % 5 === 0 && i > 0) {
          console.log(`⏸️ Pause de 1s après ${i} fichiers analysés...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    return themeStructure;
    
  } catch (error) {
    throw new Error(`Erreur analyse structure thème: ${error.message}`);
  }
}

// Analyser le contenu Liquid pour détecter les éléments
function analyzeLiquidContent(content, fileName) {
  const elements = {};
  
      // Détecter les éléments basés sur les patterns Liquid/Shopify (ÉTENDU)
    const patterns = {
      // === CONTENU TEXTUEL ===
      product_title: [
        /{{ product\.title }}/g,
        /{{ product\.name }}/g,
        /<h1[^>]*class="[^"]*product[^"]*"[^>]*>/gi,
        /<h1[^>]*class="[^"]*title[^"]*"[^>]*>/gi,
        /<h2[^>]*class="[^"]*product[^"]*"[^>]*>/gi
      ],
      product_description: [
        /{{ product\.description }}/g,
        /{{ product\.body_html }}/g,
        /<div[^>]*class="[^"]*description[^"]*"[^>]*>/gi,
        /<p[^>]*class="[^"]*description[^"]*"[^>]*>/gi
      ],
      product_ingredients: [
        /{{ product\.metafields\.ingredients }}/g,
        /{{ product\.metafields\.custom\.ingredients }}/g,
        /ingredients[^}]*{{/gi
      ],
      product_specifications: [
        /{{ product\.metafields\.specifications }}/g,
        /{{ product\.metafields\.custom\.specs }}/g,
        /specifications[^}]*{{/gi,
        /<div[^>]*class="[^"]*specifications[^"]*"[^>]*>/gi,
        /<div[^>]*class="[^"]*specs[^"]*"[^>]*>/gi
      ],
      product_features: [
        /{{ product\.metafields\.features }}/g,
        /features[^}]*{{/gi,
        /<div[^>]*class="[^"]*features[^"]*"[^>]*>/gi
      ],
      product_benefits: [
        /{{ product\.metafields\.benefits }}/g,
        /benefits[^}]*{{/gi,
        /<div[^>]*class="[^"]*benefits[^"]*"[^>]*>/gi
      ],
      
      // === PRIX ET COMMERCIAL ===
      product_price: [
        /{{ product\.price }}/g,
        /{{ product\.price | money }}/g,
        /{{ current_variant\.price | money }}/g,
        /<span[^>]*class="[^"]*price[^"]*"[^>]*>/gi,
        /<div[^>]*class="[^"]*price[^"]*"[^>]*>/gi
      ],
      product_compare_price: [
        /{{ product\.compare_at_price }}/g,
        /{{ product\.compare_at_price | money }}/g,
        /{{ current_variant\.compare_at_price | money }}/g
      ],
      product_savings: [
        /{{ product\.compare_at_price | minus: product\.price }}/g,
        /savings[^}]*{{/gi
      ],
      
      // === IMAGES ET MÉDIA ===
      product_main_image: [
        /{{ product\.featured_image }}/g,
        /{{ product\.featured_image | img_url: 'large' }}/g,
        /{{ product\.featured_image | img_url: 'master' }}/g,
        /<img[^>]*class="[^"]*product[^"]*"[^>]*>/gi,
        /<img[^>]*class="[^"]*featured[^"]*"[^>]*>/gi
      ],
      product_gallery: [
        /{% for image in product\.images %}/g,
        /{% for media in product\.media %}/g,
        /{{ product\.images }}/g,
        /gallery[^}]*{{/gi
      ],
      product_video: [
        /{% for media in product\.media %}/g,
        /{{ media\.media_type }}/g,
        /video[^}]*{{/gi
      ],
      
      // === VARIANTS ET OPTIONS ===
      product_variants: [
        /{% for variant in product\.variants %}/g,
        /{{ product\.variants }}/g,
        /variant[^}]*{{/gi
      ],
      variant_selector: [
        /<select[^>]*data-variant[^>]*>/gi,
        /<select[^>]*name="[^"]*variant[^"]*"[^>]*>/gi,
        /single-option-selector/gi
      ],
      
      // === CTA ET FORMULAIRES ===
      add_to_cart: [
        /<button[^>]*class="[^"]*add-to-cart[^"]*"[^>]*>/gi,
        /<input[^>]*type="submit"[^>]*value="[^"]*cart[^"]*"[^>]*>/gi,
        /{{ 'products.product.add_to_cart' | t }}/g,
        /{% form 'product' %}/g
      ],
      buy_now: [
        /{{ 'products.product.buy_now' | t }}/g,
        /buy-now[^}]*{{/gi
      ],
      
      // === BADGES ET MARKETING ===
      product_badges: [
        /{% if product\.tags contains 'sale' %}/g,
        /{% if product\.tags contains 'new' %}/g,
        /{% if product\.tags contains 'featured' %}/g,
        /{% if product\.tags contains 'limited' %}/g,
        /{% if product\.tags contains 'eco' %}/g,
        /badge[^}]*{{/gi,
        /tag[^}]*{{/gi,
        /<span[^>]*class="[^"]*badge[^"]*"[^>]*>/gi,
        /<div[^>]*class="[^"]*badge[^"]*"[^>]*>/gi
      ],
      product_urgency: [
        /{{ product\.inventory_quantity }}/g,
        /{{ product\.inventory_management }}/g,
        /urgency[^}]*{{/gi,
        /stock[^}]*{{/gi,
        /<span[^>]*class="[^"]*urgency[^"]*"[^>]*>/gi,
        /<div[^>]*class="[^"]*stock[^"]*"[^>]*>/gi
      ],
      product_countdown: [
        /countdown[^}]*{{/gi,
        /timer[^}]*{{/gi,
        /<div[^>]*class="[^"]*countdown[^"]*"[^>]*>/gi
      ],
      
      // === AVIS ET RÉPUTATION ===
      product_reviews: [
        /{% render 'product-reviews' %}/g,
        /{{ product\.reviews }}/g,
        /shopify-product-reviews/gi,
        /reviews[^}]*{{/gi
      ],
      product_rating: [
        /{{ product\.rating }}/g,
        /{{ product\.rating_value }}/g,
        /rating[^}]*{{/gi
      ],
      
      // === INFORMATIONS SUPPLÉMENTAIRES ===
      product_sku: [
        /{{ product\.sku }}/g,
        /{{ current_variant\.sku }}/g
      ],
      product_vendor: [
        /{{ product\.vendor }}/g,
        /vendor[^}]*{{/gi
      ],
      product_type: [
        /{{ product\.type }}/g,
        /type[^}]*{{/gi
      ],
      
      // === RECOMMANDATIONS ===
      product_recommendations: [
        /{% render 'product-recommendations' %}/g,
        /{{ product\.recommendations }}/g,
        /recommendations[^}]*{{/gi
      ],
      
      // === NAVIGATION ET LIENS ===
      product_navigation: [
        /breadcrumb[^}]*{{/gi,
        /<nav[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>/gi,
        /<div[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>/gi
      ],
      product_related: [
        /related[^}]*{{/gi,
        /<div[^>]*class="[^"]*related[^"]*"[^>]*>/gi
      ],
      
      // === ÉLÉMENTS DE CONFIANCE ===
      product_trust_badges: [
        /trust[^}]*{{/gi,
        /guarantee[^}]*{{/gi,
        /<div[^>]*class="[^"]*trust[^"]*"[^>]*>/gi,
        /<div[^>]*class="[^"]*guarantee[^"]*"[^>]*>/gi
      ],
      product_shipping: [
        /shipping[^}]*{{/gi,
        /delivery[^}]*{{/gi,
        /<div[^>]*class="[^"]*shipping[^"]*"[^>]*>/gi
      ],
      
      // === ÉLÉMENTS DE CONVERSION ===
      product_upsell: [
        /upsell[^}]*{{/gi,
        /cross-sell[^}]*{{/gi,
        /<div[^>]*class="[^"]*upsell[^"]*"[^>]*>/gi
      ],
      product_discount: [
        /discount[^}]*{{/gi,
        /coupon[^}]*{{/gi,
        /<div[^>]*class="[^"]*discount[^"]*"[^>]*>/gi
      ]
    };
  
  // Analyser chaque pattern
  for (const [elementType, patternList] of Object.entries(patterns)) {
    for (const pattern of patternList) {
      if (pattern.test(content)) {
        // Extraire les vrais sélecteurs CSS du contenu
        const cssSelectors = extractCSSSelectors(content, elementType);
        
        elements[elementType] = {
          type: elementType,
          file: fileName,
          patterns: patternList.map(p => p.source),
          css_selectors: cssSelectors,
          description: `Élément ${elementType} détecté dans ${fileName}`
        };
        break;
      }
    }
  }
  
  return elements;
}

// Extraire les vrais sélecteurs CSS du contenu Liquid
function extractCSSSelectors(content, elementType) {
  const selectors = [];
  
  // Patterns pour extraire les classes CSS réelles (ÉTENDU)
  const cssPatterns = {
    product_title: [
      /<h1[^>]*class="([^"]*)"[^>]*>/gi,
      /<h2[^>]*class="([^"]*)"[^>]*>/gi,
      /<h3[^>]*class="([^"]*)"[^>]*>/gi,
      /<div[^>]*class="([^"]*)"[^>]*>/gi,
      /<span[^>]*class="([^"]*)"[^>]*>/gi
    ],
    product_price: [
      /<span[^>]*class="([^"]*)"[^>]*>/gi,
      /<div[^>]*class="([^"]*)"[^>]*>/gi,
      /<p[^>]*class="([^"]*)"[^>]*>/gi,
      /<strong[^>]*class="([^"]*)"[^>]*>/gi
    ],
    product_description: [
      /<div[^>]*class="([^"]*)"[^>]*>/gi,
      /<p[^>]*class="([^"]*)"[^>]*>/gi,
      /<section[^>]*class="([^"]*)"[^>]*>/gi
    ],
    add_to_cart: [
      /<button[^>]*class="([^"]*)"[^>]*>/gi,
      /<input[^>]*class="([^"]*)"[^>]*>/gi,
      /<a[^>]*class="([^"]*)"[^>]*>/gi
    ],
    product_image: [
      /<img[^>]*class="([^"]*)"[^>]*>/gi,
      /<div[^>]*class="([^"]*)"[^>]*>/gi,
      /<figure[^>]*class="([^"]*)"[^>]*>/gi
    ],
    product_badges: [
      /<span[^>]*class="([^"]*)"[^>]*>/gi,
      /<div[^>]*class="([^"]*)"[^>]*>/gi,
      /<p[^>]*class="([^"]*)"[^>]*>/gi
    ],
    product_reviews: [
      /<div[^>]*class="([^"]*)"[^>]*>/gi,
      /<section[^>]*class="([^"]*)"[^>]*>/gi,
      /<article[^>]*class="([^"]*)"[^>]*>/gi
    ],
    product_variants: [
      /<select[^>]*class="([^"]*)"[^>]*>/gi,
      /<div[^>]*class="([^"]*)"[^>]*>/gi,
      /<fieldset[^>]*class="([^"]*)"[^>]*>/gi
    ]
  };
  
  const patterns = cssPatterns[elementType] || [];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const classes = match[1].split(' ').filter(cls => cls.trim());
      selectors.push(...classes.map(cls => `.${cls}`));
    }
  }
  
  // Dédupliquer et filtrer les sélecteurs pertinents (ÉTENDU)
  const uniqueSelectors = [...new Set(selectors)];
  const relevantSelectors = uniqueSelectors.filter(selector => 
    selector.includes('product') || 
    selector.includes('title') || 
    selector.includes('price') || 
    selector.includes('description') ||
    selector.includes('cart') ||
    selector.includes('image') ||
    selector.includes('badge') ||
    selector.includes('review') ||
    selector.includes('variant') ||
    selector.includes('gallery') ||
    selector.includes('media') ||
    selector.includes('form') ||
    selector.includes('button') ||
    selector.includes('tag') ||
    selector.includes('sale') ||
    selector.includes('new') ||
    selector.includes('featured') ||
    selector.includes('urgent') ||
    selector.includes('stock') ||
    selector.includes('countdown') ||
    selector.includes('trust') ||
    selector.includes('guarantee') ||
    selector.includes('shipping') ||
    selector.includes('discount')
  );
  
  return relevantSelectors.slice(0, 5); // Limiter à 5 sélecteurs max
}

// Améliorer le mapping avec Claude AI
async function enhanceMappingWithAI(themeStructure, shopDomain, accessToken) {
  const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
  });
  
  try {
    console.log('🤖 Amélioration du mapping avec Claude AI...');
    
    // Préparer les données pour Claude
    const themeData = {
      theme_name: themeStructure.theme_name,
      files_analyzed: themeStructure.files_analyzed,
      elements_detected: Object.keys(themeStructure.product_elements)
    };
    
    // Préparer le contenu des fichiers pour Claude
    const fileContents = {};
    for (const fileName of themeStructure.files_analyzed) {
      try {
        const content = await fetchLiquidFile(shopDomain, accessToken, themeStructure.theme_id, fileName);
        fileContents[fileName] = content.substring(0, 2000); // Limiter la taille
      } catch (error) {
        console.warn(`⚠️ Impossible de récupérer ${fileName}: ${error.message}`);
      }
    }

    const prompt = `Tu es un expert en analyse de thèmes Shopify. Analyse le contenu réel des fichiers Liquid et génère un mapping précis des éléments modifiables.

THÈME: ${themeData.theme_name}
FICHIERS ANALYSÉS: ${themeData.files_analyzed.join(', ')}

CONTENU DES FICHIERS LIQUID:
${Object.entries(fileContents).map(([fileName, content]) => 
  `\n--- ${fileName} ---\n${content}\n---`
).join('\n')}

TÂCHE: Analyse le contenu Liquid ci-dessus et génère un mapping JSON précis des éléments de page produit.

RÈGLES STRICTES:
1. **N'INVENTE PAS** de sélecteurs CSS - utilise UNIQUEMENT ceux présents dans le code Liquid
2. **Extrais les vrais sélecteurs** des balises HTML dans le code Liquid
3. **Identifie les patterns Liquid** comme {{ product.title }}, {{ product.price | money }}
4. **Sois précis** - ne génère que des sélecteurs qui existent réellement

ÉLÉMENTS À DÉTECTER:
- product_title: Titre principal du produit
- product_price: Prix du produit  
- product_description: Description du produit
- product_image: Image principale du produit
- add_to_cart: Bouton d'ajout au panier
- product_reviews: Section avis/étoiles
- variant_selector: Sélecteurs de variantes
- product_badges: Badges/promotions
- product_gallery: Galerie d'images
- additional_info: Informations supplémentaires

FORMAT DE RÉPONSE JSON STRICT:
{
  "product_title": {
    "type": "text",
    "selector": "SÉLECTEUR_CSS_RÉEL_EXTRAIT_DU_CODE",
    "description": "Description précise",
    "liquid_files": ["fichier_où_trouvé.liquid"],
    "liquid_patterns": ["{{ product.title }}"]
  }
}

EXEMPLE D'EXTRACTION:
Si tu vois dans le code: <h1 class="product-title">{{ product.title }}</h1>
Alors le sélecteur doit être: ".product-title"

IMPORTANT: Ne génère que des sélecteurs CSS qui existent réellement dans le code Liquid fourni.`;

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    // Extraire le JSON de la réponse de Claude
    const responseText = message.content[0].text;
    console.log('📝 Réponse Claude:', responseText.substring(0, 200) + '...');
    
    // Essayer d'extraire le JSON de la réponse
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Format JSON non trouvé dans la réponse Claude');
    }
    
    const enhancedMapping = JSON.parse(jsonMatch[0]);
    
    // Fusionner avec les éléments détectés par l'analyse Liquid
    const finalMapping = { ...themeStructure.product_elements, ...enhancedMapping };
    
    console.log(`✅ Mapping amélioré avec ${Object.keys(finalMapping).length} éléments`);
    return finalMapping;
    
  } catch (error) {
    console.error('❌ Erreur Claude AI:', error);
    
    // Fallback vers le mapping basé sur l'analyse Liquid
    console.log('🔄 Fallback vers mapping Liquid...');
    return themeStructure.product_elements;
  }
}

// Analyser la page avec Claude API (ancienne méthode - gardée pour compatibilité)
async function analyzePageWithAI(html, productUrl) {
  const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
  });
  
  try {
    console.log('🤖 Analyse avec Claude API...');
    
    // Préparer le prompt pour Claude
    const prompt = `Tu es un expert en analyse de pages web Shopify. Analyse ce HTML de page produit et identifie tous les éléments modifiables.

URL de la page: ${productUrl}

Tâche: Détecte et mappe tous les éléments importants de cette page produit Shopify qui peuvent être personnalisés pour des campagnes marketing.

Éléments à détecter:
1. Titre principal du produit
2. Prix du produit
3. Description du produit
4. Image principale du produit
5. Bouton "Ajouter au panier" ou CTA principal
6. Section avis/étoiles
7. Sélecteur de variantes (taille, couleur, etc.)
8. Badges/promotions
9. Images secondaires/galerie
10. Informations supplémentaires (ingrédients, caractéristiques, etc.)

Pour chaque élément détecté, fournis:
- Un sélecteur CSS précis et robuste
- Le type d'élément (text, image, button, price, reviews, variants, badges, gallery)
- Une description claire
- La valeur actuelle extraite

Format de réponse JSON strict:
{
  "product_title": {
    "type": "text",
    "selector": "h1.product-title, h1.product__title, h1.title",
    "description": "Titre principal du produit",
    "current_value": "Nom du produit"
  },
  "product_price": {
    "type": "price", 
    "selector": ".price, .product__price, [data-price]",
    "description": "Prix du produit",
    "current_value": "19,90€"
  }
}

Règles importantes:
- Utilise des sélecteurs CSS robustes qui fonctionnent sur différents thèmes
- Inclus plusieurs sélecteurs alternatifs séparés par des virgules
- Extrais le texte réel des éléments (pas de HTML)
- Sois précis dans les descriptions
- Ne retourne QUE du JSON valide, pas de texte supplémentaire

HTML à analyser:
${html.substring(0, 15000)} // Limite pour éviter les tokens excessifs

Analyse ce HTML et retourne le mapping JSON.`;

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      temperature: 0.1, // Faible température pour des résultats cohérents
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    // Extraire le JSON de la réponse de Claude
    const responseText = message.content[0].text;
    console.log('📝 Réponse Claude:', responseText.substring(0, 200) + '...');
    
    // Essayer d'extraire le JSON de la réponse
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Format JSON non trouvé dans la réponse Claude');
    }
    
    const mapping = JSON.parse(jsonMatch[0]);
    
    // Validation et nettoyage du mapping
    const cleanedMapping = {};
    for (const [key, element] of Object.entries(mapping)) {
      if (element && typeof element === 'object' && element.selector) {
        cleanedMapping[key] = {
          type: element.type || 'text',
          selector: element.selector,
          description: element.description || key,
          current_value: element.current_value || ''
        };
      }
    }
    
    console.log(`✅ Mapping généré avec ${Object.keys(cleanedMapping).length} éléments`);
    return cleanedMapping;
    
  } catch (error) {
    console.error('❌ Erreur Claude API:', error);
    
    // Fallback vers l'analyse basée sur les patterns si Claude échoue
    console.log('🔄 Fallback vers analyse par patterns...');
    return analyzePageWithPatterns(html, productUrl);
  }
}

// Fonction de fallback basée sur les patterns (ancienne méthode)
function analyzePageWithPatterns(html, productUrl) {
  const mapping = {};
  
  // Extraire le titre du produit
  const titleMatch = html.match(/<h1[^>]*class="[^"]*product-title[^"]*"[^>]*>(.*?)<\/h1>/i) ||
                    html.match(/<h1[^>]*class="[^"]*product__title[^"]*"[^>]*>(.*?)<\/h1>/i) ||
                    html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/h1>/i);
  
  if (titleMatch) {
    mapping.product_title = {
      type: 'text',
      selector: 'h1.product-title, h1.product__title, h1.title',
      description: 'Titre principal du produit',
      current_value: titleMatch[1].replace(/<[^>]*>/g, '').trim()
    };
  }
  
  // Extraire le prix
  const priceMatch = html.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]*)<\/span>/i) ||
                    html.match(/<span[^>]*class="[^"]*product__price[^"]*"[^>]*>([^<]*)<\/span>/i);
  
  if (priceMatch) {
    mapping.product_price = {
      type: 'price',
      selector: '.price, .product__price',
      description: 'Prix du produit',
      current_value: priceMatch[1].trim()
    };
  }
  
  // Extraire la description
  const descMatch = html.match(/<div[^>]*class="[^"]*product-description[^"]*"[^>]*>(.*?)<\/div>/is) ||
                   html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/div>/is);
  
  if (descMatch) {
    mapping.product_description = {
      type: 'text',
      selector: '.product-description, .description',
      description: 'Description du produit',
      current_value: descMatch[1].replace(/<[^>]*>/g, '').trim().substring(0, 200) + '...'
    };
  }
  
  // Extraire l'image principale
  const imageMatch = html.match(/<img[^>]*class="[^"]*product-image[^"]*"[^>]*src="([^"]*)"/i) ||
                    html.match(/<img[^>]*class="[^"]*product__image[^"]*"[^>]*src="([^"]*)"/i);
  
  if (imageMatch) {
    mapping.product_image = {
      type: 'image',
      selector: '.product-image img, .product__image img',
      description: 'Image principale du produit',
      current_value: imageMatch[1]
    };
  }
  
  // Extraire le bouton CTA
  const ctaMatch = html.match(/<button[^>]*class="[^"]*add-to-cart[^"]*"[^>]*>(.*?)<\/button>/i) ||
                  html.match(/<button[^>]*class="[^"]*btn[^"]*"[^>]*>(.*?)<\/button>/i);
  
  if (ctaMatch) {
    mapping.add_to_cart_button = {
      type: 'button',
      selector: '.add-to-cart, .btn',
      description: 'Bouton Ajouter au panier',
      current_value: ctaMatch[1].replace(/<[^>]*>/g, '').trim()
    };
  }
  
  // Extraire les avis/étoiles
  const reviewMatch = html.match(/<div[^>]*class="[^"]*reviews[^"]*"[^>]*>(.*?)<\/div>/is) ||
                     html.match(/<div[^>]*class="[^"]*rating[^"]*"[^>]*>(.*?)<\/div>/is);
  
  if (reviewMatch) {
    mapping.product_reviews = {
      type: 'reviews',
      selector: '.reviews, .rating',
      description: 'Section avis et étoiles',
      current_value: 'Avis clients'
    };
  }
  
  // Extraire les variantes (taille, couleur, etc.)
  const variantMatch = html.match(/<select[^>]*class="[^"]*variant[^"]*"[^>]*>(.*?)<\/select>/is) ||
                      html.match(/<div[^>]*class="[^"]*product-options[^"]*"[^>]*>(.*?)<\/div>/is);
  
  if (variantMatch) {
    mapping.product_variants = {
      type: 'variants',
      selector: '.variant, .product-options',
      description: 'Sélecteur de variantes (taille, couleur)',
      current_value: 'Variantes disponibles'
    };
  }
  
  // Extraire les badges/promotions
  const badgeMatch = html.match(/<span[^>]*class="[^"]*badge[^"]*"[^>]*>(.*?)<\/span>/i) ||
                    html.match(/<div[^>]*class="[^"]*promo[^"]*"[^>]*>(.*?)<\/div>/i);
  
  if (badgeMatch) {
    mapping.product_badges = {
      type: 'badges',
      selector: '.badge, .promo',
      description: 'Badges et promotions',
      current_value: badgeMatch[1].replace(/<[^>]*>/g, '').trim()
    };
  }
  
  return mapping;
}

// Sauvegarder un mapping
function saveMapping(shopDomain, productUrl, mapping) {
  const mappingsPath = path.join(__dirname, 'mappings.json');
  let mappings = {};
  
  if (fs.existsSync(mappingsPath)) {
    mappings = JSON.parse(fs.readFileSync(mappingsPath));
  }
  
  if (!mappings[shopDomain]) {
    mappings[shopDomain] = {};
  }
  
  const mappingId = `mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  mappings[shopDomain][mappingId] = {
    id: mappingId,
    product_url: productUrl,
    mapping: mapping,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2));
  console.log(`✅ Mapping sauvegardé: ${mappingId} pour ${shopDomain}`);
  
  return mappingId;
}

// Récupérer un mapping
function getMapping(mappingId) {
  const mappingsPath = path.join(__dirname, 'mappings.json');
  
  if (!fs.existsSync(mappingsPath)) {
    return null;
  }
  
  const mappings = JSON.parse(fs.readFileSync(mappingsPath));
  
  for (const shopDomain in mappings) {
    if (mappings[shopDomain][mappingId]) {
      return mappings[shopDomain][mappingId];
    }
  }
  
  return null;
}

// Récupérer tous les mappings d'un shop
function getAllMappings(shopDomain) {
  const mappingsPath = path.join(__dirname, 'mappings.json');
  
  if (!fs.existsSync(mappingsPath)) {
    return [];
  }
  
  const mappings = JSON.parse(fs.readFileSync(mappingsPath));
  return mappings[shopDomain] ? Object.values(mappings[shopDomain]) : [];
}

// Générer un script de test pour un mapping
function generateTestScript(mapping, testContent) {
  const { mapping: elements } = mapping;
  
  let script = `
// Script de test pour le mapping: ${mapping.id}
// Page: ${mapping.product_url}

(function() {
  console.log('🧪 Test du mapping Adlign...');
  
  const testContent = ${JSON.stringify(testContent, null, 2)};
  
  // Fonction pour remplacer le contenu
  function replaceContent(selector, newContent, type) {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) {
      console.warn('⚠️ Sélecteur non trouvé:', selector);
      return false;
    }
    
    elements.forEach((element, index) => {
      switch(type) {
        case 'text':
          element.textContent = newContent;
          break;
        case 'image':
          element.src = newContent;
          break;
        case 'button':
          element.textContent = newContent;
          break;
        case 'price':
          element.textContent = newContent;
          break;
        default:
          element.innerHTML = newContent;
      }
      console.log('✅ Remplacé:', selector, '->', newContent);
    });
    
    return true;
  }
  
  // Application du mapping
  const results = {
    success: 0,
    failed: 0,
    details: []
  };
  
`;

  // Ajouter les remplacements pour chaque élément
  for (const [key, element] of Object.entries(elements)) {
    if (testContent[key]) {
      script += `
  // ${element.description}
  if (replaceContent('${element.selector}', '${testContent[key]}', '${element.type}')) {
    results.success++;
    results.details.push({ element: '${key}', status: 'success' });
  } else {
    results.failed++;
    results.details.push({ element: '${key}', status: 'failed', selector: '${element.selector}' });
  }
`;
    }
  }
  
  script += `
  console.log('📊 Résultats du test:', results);
  console.log('🎯 Mapping testé avec succès!');
})();
`;

  return script;
}

// ========================================
// 🚀 ENDPOINTS SAAS POUR LOVABLE
// ========================================

// Configuration CORS sécurisée
const allowedOrigins = [
  'http://localhost:5173',
  'https://lovable.dev',
  'https://adlign-creative-flow.vercel.app'
];

app.use('/api/saas', cors({
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS: Origin non autorisée'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24h
}));

// 1. Connexion Shopify pour le SaaS
app.post('/api/saas/connect-shopify', express.json(), async (req, res) => {
  const { shop_domain } = req.body;
  
  if (!shop_domain) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain requis' 
    });
  }

  try {
    // Générer l'URL OAuth pour le frontend
    const redirectUri = `${SHOPIFY_APP_URL}/auth/callback`;
    const oauthUrl = `https://${shop_domain}/admin/oauth/authorize` +
      `?client_id=${SHOPIFY_API_KEY}` +
      `&scope=${SHOPIFY_SCOPES}` +
      `&redirect_uri=${redirectUri}` +
      `&state=saas_${Date.now()}` +
      `&grant_options[]=per-user`;

    res.json({
      success: true,
      oauth_url: oauthUrl,
      message: 'URL OAuth générée pour le frontend'
    });
  } catch (error) {
    console.error('Erreur génération OAuth SaaS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la génération OAuth'
    });
  }
});

// 2. Lister les boutiques connectées
app.get('/api/saas/stores', async (req, res) => {
  try {
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath));
    }

    const stores = Object.keys(shopTokens).map(shop => ({
      domain: shop,
      connected: true,
      connected_at: new Date().toISOString(), // Approximation
      status: 'active'
    }));

    res.json({
      success: true,
      stores: stores,
      total: stores.length
    });
  } catch (error) {
    console.error('Erreur récupération stores:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des boutiques'
    });
  }
});

// 3. Créer une landing page via SaaS
app.post('/api/saas/landings', express.json(), async (req, res) => {
  const { shop_domain, landing_data } = req.body;
  
  if (!shop_domain || !landing_data) {
    return res.status(400).json({
      success: false,
      error: 'shop_domain et landing_data requis'
    });
  }

  try {
    // Utiliser la fonction existante de création de landing
    const landingWithMeta = {
      ...landing_data,
      id: `landing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      shop_domain: shop_domain,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const landingsPath = path.join(__dirname, 'local_landings.json');
    let allLandings = {};
    
    if (fs.existsSync(landingsPath)) {
      allLandings = JSON.parse(fs.readFileSync(landingsPath));
    }
    
    if (!allLandings[shop_domain]) {
      allLandings[shop_domain] = {};
    }
    
    allLandings[shop_domain][landing_data.handle] = landingWithMeta;
    fs.writeFileSync(landingsPath, JSON.stringify(allLandings, null, 2));

    res.json({
      success: true,
      message: `Landing page "${landing_data.handle}" créée via SaaS`,
      landing: landingWithMeta,
      storage_type: "local_json"
    });
  } catch (error) {
    console.error('Erreur création landing SaaS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de la landing page'
    });
  }
});

// 4. Récupérer une landing page
app.get('/api/saas/landings/:handle', async (req, res) => {
  const { handle } = req.params;
  const { shop_domain } = req.query;
  
  if (!shop_domain) {
    return res.status(400).json({
      success: false,
      error: 'shop_domain requis en query parameter'
    });
  }

  try {
    const landingsPath = path.join(__dirname, 'local_landings.json');
    
    if (!fs.existsSync(landingsPath)) {
      return res.status(404).json({
        success: false,
        error: 'Aucune landing page trouvée'
      });
    }

    const allLandings = JSON.parse(fs.readFileSync(landingsPath));
    const shopLandings = allLandings[shop_domain] || {};
    const landing = shopLandings[handle];

    if (!landing) {
      return res.status(404).json({
        success: false,
        error: `Landing page "${handle}" non trouvée`
      });
    }

    res.json({
      success: true,
      landing: landing
    });
  } catch (error) {
    console.error('Erreur récupération landing SaaS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la landing page'
    });
  }
});

// 5. Lister toutes les landings d'un shop
app.get('/api/saas/landings', async (req, res) => {
  const { shop_domain } = req.query;
  
  if (!shop_domain) {
    return res.status(400).json({
      success: false,
      error: 'shop_domain requis en query parameter'
    });
  }

  try {
    const landingsPath = path.join(__dirname, 'local_landings.json');
    
    if (!fs.existsSync(landingsPath)) {
      return res.json({
        success: true,
        landings: [],
        total: 0
      });
    }

    const allLandings = JSON.parse(fs.readFileSync(landingsPath));
    const shopLandings = allLandings[shop_domain] || {};
    const landings = Object.values(shopLandings);

    res.json({
      success: true,
      landings: landings,
      total: landings.length
    });
  } catch (error) {
    console.error('Erreur récupération landings SaaS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des landing pages'
    });
  }
});

// 6. Mettre à jour une landing page
app.put('/api/saas/landings/:handle', express.json(), async (req, res) => {
  const { handle } = req.params;
  const { shop_domain, landing_data } = req.body;
  
  if (!shop_domain || !landing_data) {
    return res.status(400).json({
      success: false,
      error: 'shop_domain et landing_data requis'
    });
  }

  try {
    const landingsPath = path.join(__dirname, 'local_landings.json');
    
    if (!fs.existsSync(landingsPath)) {
      return res.status(404).json({
        success: false,
        error: 'Aucune landing page trouvée'
      });
    }

    const allLandings = JSON.parse(fs.readFileSync(landingsPath));
    const shopLandings = allLandings[shop_domain] || {};
    
    if (!shopLandings[handle]) {
      return res.status(404).json({
        success: false,
        error: `Landing page "${handle}" non trouvée`
      });
    }

    // Mettre à jour la landing
    const updatedLanding = {
      ...shopLandings[handle],
      ...landing_data,
      updated_at: new Date().toISOString()
    };

    allLandings[shop_domain][handle] = updatedLanding;
    fs.writeFileSync(landingsPath, JSON.stringify(allLandings, null, 2));

    res.json({
      success: true,
      message: `Landing page "${handle}" mise à jour`,
      landing: updatedLanding
    });
  } catch (error) {
    console.error('Erreur mise à jour landing SaaS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour de la landing page'
    });
  }
});

// 7. Supprimer une landing page
app.delete('/api/saas/landings/:handle', async (req, res) => {
  const { handle } = req.params;
  const { shop_domain } = req.query;
  
  if (!shop_domain) {
    return res.status(400).json({
      success: false,
      error: 'shop_domain requis en query parameter'
    });
  }

  try {
    const landingsPath = path.join(__dirname, 'local_landings.json');
    
    if (!fs.existsSync(landingsPath)) {
      return res.status(404).json({
        success: false,
        error: 'Aucune landing page trouvée'
      });
    }

    const allLandings = JSON.parse(fs.readFileSync(landingsPath));
    const shopLandings = allLandings[shop_domain] || {};
    
    if (!shopLandings[handle]) {
      return res.status(404).json({
        success: false,
        error: `Landing page "${handle}" non trouvée`
      });
    }

    // Supprimer la landing
    delete allLandings[shop_domain][handle];
    fs.writeFileSync(landingsPath, JSON.stringify(allLandings, null, 2));

    res.json({
      success: true,
      message: `Landing page "${handle}" supprimée`
    });
  } catch (error) {
    console.error('Erreur suppression landing SaaS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression de la landing page'
    });
  }
});

// 8. Analyser un thème via SaaS
app.post('/api/saas/analyze-theme', express.json(), async (req, res) => {
  const { shop_domain } = req.body;
  
  if (!shop_domain) {
    return res.status(400).json({
      success: false,
      error: 'shop_domain requis'
    });
  }

  try {
    // Vérifier que le shop est connecté
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée. Connectez d\'abord la boutique Shopify.'
      });
    }

    // Utiliser la fonction existante d'analyse
    const mapping = await analyzeThemeStructure(shop_domain, accessToken);
    
    if (!mapping || !mapping.mapping || Object.keys(mapping.mapping).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucun élément détecté dans le thème'
      });
    }

    res.json({
      success: true,
      message: 'Analyse du thème terminée',
      mapping: mapping,
      elements_count: Object.keys(mapping.mapping).length
    });
  } catch (error) {
    console.error('Erreur analyse thème SaaS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'analyse du thème'
    });
  }
});

// 9. Métriques et analytics
app.get('/api/saas/analytics', async (req, res) => {
  const { shop_domain } = req.query;
  
  try {
    // Compter les landings
    const landingsPath = path.join(__dirname, 'local_landings.json');
    let landingsCount = 0;
    
    if (fs.existsSync(landingsPath)) {
      const allLandings = JSON.parse(fs.readFileSync(landingsPath));
      if (shop_domain) {
        landingsCount = Object.keys(allLandings[shop_domain] || {}).length;
      } else {
        landingsCount = Object.values(allLandings).reduce((total, shop) => total + Object.keys(shop).length, 0);
      }
    }

    // Compter les mappings
    const mappingsPath = path.join(__dirname, 'mappings.json');
    let mappingsCount = 0;
    
    if (fs.existsSync(mappingsPath)) {
      const allMappings = JSON.parse(fs.readFileSync(mappingsPath));
      if (shop_domain) {
        mappingsCount = Object.keys(allMappings[shop_domain] || {}).length;
      } else {
        mappingsCount = Object.values(allMappings).reduce((total, shop) => total + Object.keys(shop).length, 0);
      }
    }

    // Compter les boutiques connectées
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopsCount = 0;
    
    if (fs.existsSync(tokensPath)) {
      const shopTokens = JSON.parse(fs.readFileSync(tokensPath));
      shopsCount = Object.keys(shopTokens).length;
    }

    res.json({
      success: true,
      analytics: {
        total_shops: shopsCount,
        total_landings: landingsCount,
        total_mappings: mappingsCount,
        shop_domain: shop_domain || 'all'
      }
    });
  } catch (error) {
    console.error('Erreur récupération analytics SaaS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des métriques'
    });
  }
});

// 9. Créer un produit de test
app.post('/api/saas/create-test-product', express.json(), async (req, res) => {
  const { shop_domain } = req.body;
  
  if (!shop_domain) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain requis' 
    });
  }

  try {
    // 1. Vérifier que le shop est connecté
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée. Connectez d\'abord la boutique Shopify.'
      });
    }

    // 2. Créer un produit de test
    const productData = {
      product: {
        title: "Produit Test Adlign",
        body_html: "<p>Description du produit de test pour Adlign. Ce produit sert à tester les fonctionnalités de personnalisation.</p>",
        vendor: "Adlign Test",
        product_type: "Test",
        status: "active",
        variants: [
          {
            option1: "Default Title",
            price: "19.99",
            compare_at_price: "29.99",
            inventory_quantity: 100,
            inventory_management: "shopify"
          }
        ],
        options: [
          {
            name: "Title",
            values: ["Default Title"]
          }
        ],
        images: [
          {
            alt: "Produit Test Adlign",
            src: "https://via.placeholder.com/600x600/10B981/FFFFFF?text=Adlign+Test"
          }
        ]
      }
    };

    const productResponse = await axios.post(
      `https://${shop_domain}/admin/api/2024-07/products.json`,
      productData,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    const createdProduct = productResponse.data.product;

    res.json({
      success: true,
      message: 'Produit de test créé avec succès',
      product: {
        id: createdProduct.id,
        title: createdProduct.title,
        handle: createdProduct.handle,
        admin_url: `https://${shop_domain}/admin/products/${createdProduct.id}`,
        public_url: `https://${shop_domain}/products/${createdProduct.handle}`
      }
    });

  } catch (error) {
    console.error('Erreur création produit test:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création du produit de test',
      details: error.response?.data || error.message
    });
  }
});

// 10. Personnalisation de produit avec metafields
app.post('/api/saas/personalize-product', express.json(), async (req, res) => {
  const { shop_domain, product_id, landing_handle, mapping_id, mappingData, landingData } = req.body;
  
  if (!shop_domain || !product_id || !landing_handle) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain, product_id et landing_handle requis' 
    });
  }

  // Si mappingData est fourni directement, utiliser celui-ci, sinon chercher par mapping_id
  let finalMappingData;
  if (mappingData) {
    finalMappingData = mappingData;
  } else if (mapping_id) {
    // Logique existante pour chercher le mapping par ID
    const mappings = loadMappings();
    const mapping = mappings.find(m => m.id === mapping_id);
    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: `Mapping "${mapping_id}" non trouvé`
      });
    }
    finalMappingData = mapping.mapping;
  } else {
    return res.status(400).json({ 
      success: false, 
      error: 'mapping_id ou mappingData requis' 
    });
  }

  try {
    // 1. Vérifier que le shop est connecté
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée. Connectez d\'abord la boutique Shopify.'
      });
    }

    // 2. Les données de mapping et landing sont maintenant passées directement
    // Plus besoin de récupérer depuis les fichiers locaux

    // 3. Récupérer le produit original
    const productResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/products/${product_id}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      }
    );

    const product = productResponse.data.product;

    // 4. Créer les metaobjects selon le mapping (version simplifiée)
    const metaobjectFields = [];
    const mappingData = finalMappingData;
    const finalLandingData = landingData;

    // Pour l'instant, créons seulement les champs de base qui existent dans notre définition
    const basicFields = [
      {
        key: "custom_title",
        value: finalLandingData.custom_title || product.title
      },
      {
        key: "custom_description", 
        value: finalLandingData.custom_description || product.body_html
      },
      {
        key: "custom_price_text",
        value: finalLandingData.custom_price_text || `$${product.variants[0].price}`
      },
      {
        key: "custom_cta_text",
        value: finalLandingData.custom_cta_text || 'Add to Cart'
      },
      {
        key: "custom_vendor",
        value: finalLandingData.custom_vendor || product.vendor
      },
      {
        key: "is_active",
        value: "true"
      }
    ];

    metaobjectFields.push(...basicFields);

        // 5. Créer le metafield settings avec mapping complet
    const adlignSettings = {
      landing_handle: landing_handle,
      mapping_id: mapping_id || "direct_mapping",
      campaign_name: finalLandingData.campaign_name || "Campaign",
      mapping: mappingData,
      content: Object.fromEntries(metaobjectFields.map(field => [field.key, field.value])),
      is_active: true,
      created_at: new Date().toISOString()
    };

    // Créer les métadonnées du produit avec settings global (nouveau namespace: adlign_data)
    const metadata = {
      metafields: [
        {
          namespace: "adlign_data",
          key: "settings",
          value: JSON.stringify(adlignSettings),
          type: "json"
        },
        {
          namespace: "adlign_data",
          key: "landing_handle",
          value: landing_handle,
          type: "single_line_text_field"
        },
        {
          namespace: "adlign_data",
          key: "mapping_id",
          value: mapping_id || "direct_mapping",
          type: "single_line_text_field"
        },
                  {
            namespace: "adlign_data",
            key: "campaign_name",
            value: finalLandingData.campaign_name || "Campaign",
            type: "single_line_text_field"
          },
        ...metaobjectFields.map(field => ({
          namespace: "adlign_data",
          key: field.key,
          value: field.value,
          type: "single_line_text_field"
        }))
      ]
    };

    // 7. Créer les métadonnées via l'API Shopify
    console.log('📦 Données métadonnées à créer:', JSON.stringify(metadata, null, 2));
    
    // Créer chaque métadonnée individuellement
    const createdMetafields = [];
    for (const metafield of metadata.metafields) {
      const metafieldResponse = await axios.post(
        `https://${shop_domain}/admin/api/2024-07/products/${product_id}/metafields.json`,
        { metafield },
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );
      createdMetafields.push(metafieldResponse.data.metafield);
    }

    // 8. Générer l'URL de la page personnalisée
    const personalizedPageUrl = `https://${shop_domain}/products/${product.handle}?adlign_variant=${landing_handle}`;

    // 8. Assigner le template Adlign au produit (temporairement)
    try {
      const updateProductResponse = await axios.put(
        `https://${shop_domain}/admin/api/2024-07/products/${product_id}.json`,
        {
          product: {
            id: product_id,
            template_suffix: "adlign"
          }
        },
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('✅ Template Adlign assigné au produit (produit utilise maintenant product-adlign.json)');
    } catch (templateError) {
      console.log('⚠️ Impossible d\'assigner le template Adlign:', templateError.message);
      console.log('💡 Assurez-vous d\'avoir exécuté /api/saas/install-adlign-clean d\'abord');
    }

    res.json({
      success: true,
      message: `Produit personnalisé avec métadonnées pour "${landing_handle}"`,
      data: {
        product_id: product_id,
        product_handle: product.handle,
        landing_handle: landing_handle,
        mapping_id: mapping_id,
        metafields_created: createdMetafields.length,
        personalized_page_url: personalizedPageUrl,
        metafields: createdMetafields.map(mf => ({ key: mf.key, value: mf.value })),
        mapping_elements: Object.keys(mappingData).length,
        template_assigned: "adlign",
        adlign_settings: adlignSettings
      }
    });

  } catch (error) {
    console.error('Erreur personnalisation produit:', error.response?.data || error.message);
    console.error('📋 Détails complets de l\'erreur:', JSON.stringify(error.response?.data, null, 2));
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la personnalisation du produit',
      details: error.response?.data || error.message
    });
  }
});

// 11. Injection du snippet Adlign dans le template produit principal
app.post('/api/saas/inject-adlign-snippet', express.json(), async (req, res) => {
  const { shop_domain } = req.body;
  
  if (!shop_domain) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain requis' 
    });
  }

  try {
    // 1. Vérifier que le shop est connecté
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée. Connectez d\'abord la boutique Shopify.'
      });
    }

    // 2. Lister les thèmes et trouver le thème principal
    const themesResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/themes.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );

    const themes = themesResponse.data.themes;
    const targetTheme = themes.find(theme => theme.role === 'main');

    if (!targetTheme) {
      return res.status(404).json({ success: false, error: 'Thème principal non trouvé' });
    }

    const targetThemeId = targetTheme.id;

    // 3. Installer le snippet et la section
    const snippetContent = fs.readFileSync(path.join(__dirname, 'adlign-injection.liquid'), 'utf8');
    const sectionContent = fs.readFileSync(path.join(__dirname, 'adlign-mapping-section.liquid'), 'utf8');
    
    await axios.put(
      `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json`,
      {
        asset: {
          key: 'snippets/adlign-injection.liquid',
          value: snippetContent
        }
      },
      { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
    );

    await axios.put(
      `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json`,
      {
        asset: {
          key: 'sections/adlign-mapping-section.liquid',
          value: sectionContent
        }
      },
      { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
    );

    // 4. Lire le template product.json principal
    let productTemplate;
    try {
      const templateResponse = await axios.get(
        `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json?asset[key]=templates/product.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      productTemplate = JSON.parse(templateResponse.data.asset.value);
    } catch (error) {
      return res.status(400).json({ success: false, error: 'Template produit non valide ou inexistant' });
    }

    // 5. Créer une section spéciale Adlign 
    let sectionAdded = false;
    
    // Vérifier si la section adlign n'existe pas déjà
    const adlignSectionExists = productTemplate.sections.adlign_injection;
    
    if (!adlignSectionExists) {
      // Ajouter une section spéciale pour Adlign
      productTemplate.sections.adlign_injection = {
        type: 'adlign-mapping-section',
        settings: {
          debug: false
        }
      };

      // L'ajouter à l'ordre des sections (à la fin)
      if (productTemplate.order) {
        productTemplate.order.push('adlign_injection');
      } else {
        productTemplate.order = ['main', 'adlign_injection'];
      }

      // 6. Sauvegarder le template modifié
      await axios.put(
        `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json`,
        {
          asset: {
            key: 'templates/product.json',
            value: JSON.stringify(productTemplate, null, 2)
          }
        },
        { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
      );

      sectionAdded = true;
      console.log('✅ Section Adlign ajoutée au template produit principal');
    } else {
      console.log('✅ Section Adlign déjà présente dans le template');
    }

    res.json({
      success: true,
      message: 'Snippet Adlign injecté dans le template produit principal avec succès',
      data: {
        theme_id: targetThemeId,
        snippet_installed: true,
        section_added: sectionAdded,
        template_modified: sectionAdded
      }
    });

  } catch (error) {
    console.error('Erreur injection snippet:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'injection du snippet Adlign',
      details: error.response?.data || error.message
    });
  }
});

// 12. Supprimer un produit (nettoyage)
app.delete('/api/saas/delete-product/:product_id', async (req, res) => {
  const { product_id } = req.params;
  const { shop_domain } = req.query;
  
  if (!shop_domain) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain requis en query parameter' 
    });
  }

  try {
    // 1. Vérifier que le shop est connecté
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée. Connectez d\'abord la boutique Shopify.'
      });
    }

    // 2. Supprimer le produit
    await axios.delete(
      `https://${shop_domain}/admin/api/2024-07/products/${product_id}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      }
    );

    console.log(`✅ Produit ${product_id} supprimé avec succès`);

    res.json({
      success: true,
      message: `Produit ${product_id} supprimé avec succès`,
      product_id: product_id
    });

  } catch (error) {
    console.error('Erreur suppression produit:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du produit',
      details: error.response?.data || error.message
    });
  }
});

// 13. Nettoyer et restaurer le template produit original
app.post('/api/saas/restore-original-template', express.json(), async (req, res) => {
  const { shop_domain } = req.body;
  
  if (!shop_domain) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain requis' 
    });
  }

  try {
    // 1. Vérifier que le shop est connecté
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée. Connectez d\'abord la boutique Shopify.'
      });
    }

    // 2. Lister les thèmes et trouver le thème principal
    const themesResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/themes.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );

    const themes = themesResponse.data.themes;
    const targetTheme = themes.find(theme => theme.role === 'main');

    if (!targetTheme) {
      return res.status(404).json({ success: false, error: 'Thème principal non trouvé' });
    }

    const targetThemeId = targetTheme.id;

    // 3. Lire le template product.json principal
    let productTemplate;
    try {
      const templateResponse = await axios.get(
        `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json?asset[key]=templates/product.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      productTemplate = JSON.parse(templateResponse.data.asset.value);
    } catch (error) {
      return res.status(400).json({ success: false, error: 'Template produit non valide ou inexistant' });
    }

    // 4. Supprimer la section Adlign si elle existe
    let sectionRemoved = false;
    
    if (productTemplate.sections.adlign_injection) {
      delete productTemplate.sections.adlign_injection;
      
      // La retirer de l'ordre des sections
      const index = productTemplate.order.indexOf('adlign_injection');
      if (index > -1) {
        productTemplate.order.splice(index, 1);
      }

      // 5. Sauvegarder le template restauré
      await axios.put(
        `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json`,
        {
          asset: {
            key: 'templates/product.json',
            value: JSON.stringify(productTemplate, null, 2)
          }
        },
        { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
      );

      sectionRemoved = true;
      console.log('✅ Section Adlign supprimée du template produit principal');
    } else {
      console.log('✅ Aucune section Adlign trouvée dans le template');
    }

    res.json({
      success: true,
      message: 'Template produit restauré à son état original',
      data: {
        theme_id: targetThemeId,
        section_removed: sectionRemoved,
        template_restored: true
      }
    });

  } catch (error) {
    console.error('Erreur restauration template:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la restauration du template',
      details: error.response?.data || error.message
    });
  }
});

// 14. Lister tous les produits de la boutique
app.get('/api/saas/products/:shop_domain', async (req, res) => {
  const { shop_domain } = req.params;
  
  try {
    // 1. Vérifier que le shop est connecté
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée. Connectez d\'abord la boutique Shopify.'
      });
    }

    // 2. Récupérer tous les produits
    const productsResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/products.json?fields=id,title,handle,status,vendor,product_type`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      }
    );

    const products = productsResponse.data.products;

    res.json({
      success: true,
      shop_domain: shop_domain,
      products_count: products.length,
      products: products.map(product => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        vendor: product.vendor,
        product_type: product.product_type,
        admin_url: `https://${shop_domain}/admin/products/${product.id}`,
        public_url: `https://${shop_domain}/products/${product.handle}`
      }))
    });

  } catch (error) {
    console.error('Erreur récupération produits:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des produits',
      details: error.response?.data || error.message
    });
  }
});

// 15. Injection intelligente du snippet Adlign (via template principal)
app.post('/api/saas/setup-smart-personalization', express.json(), async (req, res) => {
  const { shop_domain } = req.body;
  
  if (!shop_domain) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain requis' 
    });
  }

  try {
    // 1. Vérifier que le shop est connecté
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée. Connectez d\'abord la boutique Shopify.'
      });
    }

    // 2. Lister les thèmes et trouver le thème principal
    const themesResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/themes.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );

    const themes = themesResponse.data.themes;
    const targetTheme = themes.find(theme => theme.role === 'main');

    if (!targetTheme) {
      return res.status(404).json({ success: false, error: 'Thème principal non trouvé' });
    }

    const targetThemeId = targetTheme.id;

    // 3. Installer le snippet smart
    const smartSnippetContent = fs.readFileSync(path.join(__dirname, 'adlign-smart-injection.liquid'), 'utf8');
    
    await axios.put(
      `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json`,
      {
        asset: {
          key: 'snippets/adlign-smart-injection.liquid',
          value: smartSnippetContent
        }
      },
      { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
    );

    // 4. Lire le template product.json principal
    let productTemplate;
    try {
      const templateResponse = await axios.get(
        `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json?asset[key]=templates/product.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      productTemplate = JSON.parse(templateResponse.data.asset.value);
    } catch (error) {
      return res.status(400).json({ success: false, error: 'Template produit non valide ou inexistant' });
    }

    // 5. Créer une section minimaliste pour le snippet smart
    let sectionAdded = false;
    
    // Vérifier si la section adlign_smart n'existe pas déjà
    const smartSectionExists = productTemplate.sections.adlign_smart;
    
    if (!smartSectionExists) {
      // Créer une section inline pour le snippet
      productTemplate.sections.adlign_smart = {
        type: 'custom-liquid',
        custom_css: [],
        settings: {
          custom_liquid: '{% render \'adlign-smart-injection\' %}'
        }
      };

      // L'ajouter à l'ordre des sections (à la fin pour ne pas perturber le design)
      if (productTemplate.order) {
        productTemplate.order.push('adlign_smart');
      } else {
        productTemplate.order = ['main', 'adlign_smart'];
      }

      // 6. Sauvegarder le template modifié
      await axios.put(
        `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json`,
        {
          asset: {
            key: 'templates/product.json',
            value: JSON.stringify(productTemplate, null, 2)
          }
        },
        { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
      );

      sectionAdded = true;
      console.log('✅ Section Adlign Smart ajoutée au template produit principal');
    } else {
      console.log('✅ Section Adlign Smart déjà présente dans le template');
    }

    res.json({
      success: true,
      message: 'Personnalisation intelligente Adlign configurée avec succès',
      data: {
        theme_id: targetThemeId,
        smart_snippet_installed: true,
        section_added: sectionAdded,
        template_modified: sectionAdded,
        setup_complete: true
      }
    });

  } catch (error) {
    console.error('Erreur setup personnalisation intelligente:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la configuration de la personnalisation intelligente',
      details: error.response?.data || error.message
    });
  }
});

// 16. Restaurer complètement le template produit original (supprimer toutes les sections Adlign)
app.post('/api/saas/restore-clean-template', express.json(), async (req, res) => {
  const { shop_domain } = req.body;
  
  if (!shop_domain) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain requis' 
    });
  }

  try {
    // 1. Vérifier que le shop est connecté
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée. Connectez d\'abord la boutique Shopify.'
      });
    }

    // 2. Lister les thèmes et trouver le thème principal
    const themesResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/themes.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );

    const themes = themesResponse.data.themes;
    const targetTheme = themes.find(theme => theme.role === 'main');

    if (!targetTheme) {
      return res.status(404).json({ success: false, error: 'Thème principal non trouvé' });
    }

    const targetThemeId = targetTheme.id;

    // 3. Lire le template product.json principal
    let productTemplate;
    try {
      const templateResponse = await axios.get(
        `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json?asset[key]=templates/product.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      productTemplate = JSON.parse(templateResponse.data.asset.value);
    } catch (error) {
      return res.status(400).json({ success: false, error: 'Template produit non valide ou inexistant' });
    }

    // 4. Supprimer toutes les sections Adlign
    let sectionsRemoved = [];
    const adlignSections = ['adlign_injection', 'adlign_smart', 'adlign_mapping'];
    
    adlignSections.forEach(sectionName => {
      if (productTemplate.sections[sectionName]) {
        delete productTemplate.sections[sectionName];
        sectionsRemoved.push(sectionName);
        
        // La retirer de l'ordre des sections
        const index = productTemplate.order.indexOf(sectionName);
        if (index > -1) {
          productTemplate.order.splice(index, 1);
        }
      }
    });

    // 5. Sauvegarder le template restauré seulement si des modifications ont été faites
    if (sectionsRemoved.length > 0) {
      await axios.put(
        `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json`,
        {
          asset: {
            key: 'templates/product.json',
            value: JSON.stringify(productTemplate, null, 2)
          }
        },
        { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
      );

      console.log(`✅ Sections Adlign supprimées: ${sectionsRemoved.join(', ')}`);
    }

    res.json({
      success: true,
      message: 'Template produit complètement restauré à son état original',
      data: {
        theme_id: targetThemeId,
        sections_removed: sectionsRemoved,
        template_restored: sectionsRemoved.length > 0,
        current_sections: Object.keys(productTemplate.sections),
        sections_order: productTemplate.order
      }
    });

  } catch (error) {
    console.error('Erreur restauration complète template:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la restauration complète du template',
      details: error.response?.data || error.message
    });
  }
});

// 17. Installation propre d'Adlign : duplication automatique du template produit
app.post('/api/saas/install-adlign-clean', express.json(), async (req, res) => {
  const { shop_domain } = req.body;
  
  if (!shop_domain) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain requis' 
    });
  }

  try {
    // 1. Vérifier que le shop est connecté
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée. Connectez d\'abord la boutique Shopify.'
      });
    }

    // 2. Lister les thèmes et trouver le thème principal
    const themesResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/themes.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );

    const themes = themesResponse.data.themes;
    const targetTheme = themes.find(theme => theme.role === 'main');

    if (!targetTheme) {
      return res.status(404).json({ success: false, error: 'Thème principal non trouvé' });
    }

    const targetThemeId = targetTheme.id;

    // 3. Lire le template product.json original (pour duplication)
    let originalProductTemplate;
    try {
      const templateResponse = await axios.get(
        `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json?asset[key]=templates/product.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      originalProductTemplate = JSON.parse(templateResponse.data.asset.value);
    } catch (error) {
      return res.status(400).json({ success: false, error: 'Template produit original non trouvé' });
    }

    // 4. Créer une copie avec injection Adlign
    const adlignTemplate = JSON.parse(JSON.stringify(originalProductTemplate)); // Deep clone

    // 5. Ajouter la section Adlign à la copie
    adlignTemplate.sections.adlign_smart = {
      type: 'custom-liquid',
      custom_css: [],
      settings: {
        custom_liquid: '{% render \'adlign-smart-injection\' %}'
      }
    };

    // L'ajouter à l'ordre des sections (à la fin pour ne pas perturber)
    if (adlignTemplate.order) {
      adlignTemplate.order.push('adlign_smart');
    } else {
      adlignTemplate.order = [...(originalProductTemplate.order || ['main']), 'adlign_smart'];
    }

    // 6. Installer le snippet Adlign
    const smartSnippetContent = fs.readFileSync(path.join(__dirname, 'adlign-smart-injection.liquid'), 'utf8');
    
    await axios.put(
      `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json`,
      {
        asset: {
          key: 'snippets/adlign-smart-injection.liquid',
          value: smartSnippetContent
        }
      },
      { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
    );

    // 7. Créer le template Adlign (copie avec injection)
    await axios.put(
      `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json`,
      {
        asset: {
          key: 'templates/product.adlign.json',
          value: JSON.stringify(adlignTemplate, null, 2)
        }
      },
      { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
    );

    console.log('✅ Installation Adlign propre terminée :');
    console.log('   - Template original préservé');
    console.log('   - Template Adlign créé (product-adlign.json)');
    console.log('   - Snippet installé');

    res.json({
      success: true,
      message: 'Adlign installé proprement sans modification du thème principal',
      data: {
        theme_id: targetThemeId,
        original_template_preserved: true,
        adlign_template_created: 'templates/product.adlign.json',
        snippet_installed: 'snippets/adlign-smart-injection.liquid',
        installation_clean: true
      }
    });

  } catch (error) {
    console.error('Erreur installation Adlign propre:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'installation propre d\'Adlign',
      details: error.response?.data || error.message
    });
  }
});

// 18. Restaurer le template original du produit (retirer Adlign)
app.post('/api/saas/restore-product-template', express.json(), async (req, res) => {
  const { shop_domain, product_id } = req.body;
  
  if (!shop_domain || !product_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'shop_domain et product_id requis' 
    });
  }

  try {
    // 1. Vérifier que le shop est connecté
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée. Connectez d\'abord la boutique Shopify.'
      });
    }

    // 2. Restaurer le template original (supprimer le suffix)
    const updateProductResponse = await axios.put(
      `https://${shop_domain}/admin/api/2024-07/products/${product_id}.json`,
      {
        product: {
          id: product_id,
          template_suffix: null // Retour au template par défaut
        }
      },
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Template original restauré pour le produit');

    res.json({
      success: true,
      message: 'Template original restauré avec succès',
      data: {
        product_id: product_id,
        template_restored: true,
        now_using: 'templates/product.json (original)'
      }
    });

  } catch (error) {
    console.error('Erreur restauration template produit:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la restauration du template produit',
      details: error.response?.data || error.message
    });
  }
});

// 19. Diagnostic Adlign - Vérifier la configuration d'un produit
app.get('/api/saas/diagnose-product/:shop_domain/:product_id', async (req, res) => {
  const { shop_domain, product_id } = req.params;
  
  try {
    // 1. Vérifier que le shop est connecté
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée. Connectez d\'abord la boutique Shopify.'
      });
    }

    // 2. Récupérer le produit et ses metafields
    const productResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/products/${product_id}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      }
    );

    const product = productResponse.data.product;

    // 3. Récupérer les metafields Adlign
    const metafieldsResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/products/${product_id}/metafields.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      }
    );

    const metafields = metafieldsResponse.data.metafields;
    const adlignMetafields = metafields.filter(mf => mf.namespace === 'adlign_data');
    const settingsMetafield = adlignMetafields.find(mf => mf.key === 'settings');

    // 4. Vérifier l'existence des templates
    const themesResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/themes.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );

    const themes = themesResponse.data.themes;
    const targetTheme = themes.find(theme => theme.role === 'main');
    const targetThemeId = targetTheme.id;

    // Vérifier les templates
    let originalTemplate = null;
    let adlignTemplate = null;
    let snippet = null;

    try {
      const originalResponse = await axios.get(
        `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json?asset[key]=templates/product.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      originalTemplate = { exists: true, size: originalResponse.data.asset.value.length };
    } catch (e) {
      originalTemplate = { exists: false };
    }

    try {
      const adlignResponse = await axios.get(
        `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json?asset[key]=templates/product.adlign.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      adlignTemplate = { exists: true, size: adlignResponse.data.asset.value.length };
    } catch (e) {
      adlignTemplate = { exists: false };
    }

    try {
      const snippetResponse = await axios.get(
        `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json?asset[key]=snippets/adlign-smart-injection.liquid`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      snippet = { exists: true, size: snippetResponse.data.asset.value.length };
    } catch (e) {
      snippet = { exists: false };
    }

    // 5. Diagnostic complet
    const diagnostic = {
      product: {
        id: product.id,
        handle: product.handle,
        title: product.title,
        template_suffix: product.template_suffix,
        current_template: product.template_suffix ? `product.${product.template_suffix}.json` : 'product.json'
      },
      metafields: {
        total_adlign_metafields: adlignMetafields.length,
        has_settings: !!settingsMetafield,
        settings_content: settingsMetafield ? JSON.parse(settingsMetafield.value) : null,
        all_adlign_keys: adlignMetafields.map(mf => mf.key)
      },
      templates: {
        original_template: originalTemplate,
        adlign_template: adlignTemplate,
        snippet: snippet
      },
      urls: {
        normal: `https://${shop_domain}/products/${product.handle}`,
        adlign: `https://${shop_domain}/products/${product.handle}${settingsMetafield ? '?adlign_variant=' + JSON.parse(settingsMetafield.value).landing_handle : '?adlign_variant=test'}`
      },
      status: {
        ready_for_personalization: !!(settingsMetafield && adlignTemplate.exists && snippet.exists),
        using_adlign_template: product.template_suffix === 'adlign',
        issues: []
      }
    };

    // Identifier les problèmes
    if (!settingsMetafield) diagnostic.status.issues.push('Aucun metafield settings trouvé');
    if (!adlignTemplate.exists) diagnostic.status.issues.push('Template product.adlign.json manquant');
    if (!snippet.exists) diagnostic.status.issues.push('Snippet adlign-smart-injection.liquid manquant');
    if (product.template_suffix !== 'adlign') diagnostic.status.issues.push('Produit n\'utilise pas le template Adlign');

    res.json({
      success: true,
      diagnostic: diagnostic
    });

  } catch (error) {
    console.error('Erreur diagnostic:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du diagnostic',
      details: error.response?.data || error.message
    });
  }
});

// 20. Récupérer un mapping spécifique
app.get('/api/saas/mapping/:mapping_id', async (req, res) => {
  const { mapping_id } = req.params;
  
  try {
    const mapping = getMapping(mapping_id);
    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: `Mapping "${mapping_id}" non trouvé`
      });
    }

    res.json({
      success: true,
      mapping: mapping.mapping,
      metadata: {
        shop_domain: mapping.shop_domain,
        product_url: mapping.product_url,
        created_at: mapping.created_at
      }
    });

  } catch (error) {
    console.error('Erreur récupération mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du mapping',
      details: error.message
    });
  }
});

// 12. Récupérer les métadonnées d'un produit
app.post('/api/saas/product-metafields', express.json(), async (req, res) => {
  const { shop_domain, product_id } = req.body;
  
  if (!shop_domain || !product_id) {
    return res.status(400).json({
      success: false,
      error: 'shop_domain et product_id requis'
    });
  }

  try {
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée'
      });
    }

    // Récupérer les métadonnées du produit
    const metafieldsResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/products/${product_id}/metafields.json?namespace=adlign`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      }
    );

    res.json({
      success: true,
      metafields: metafieldsResponse.data.metafields || []
    });

  } catch (error) {
    console.error('Erreur récupération métadonnées produit:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des métadonnées',
      details: error.response?.data || error.message
    });
  }
});

// 13. Créer des métadonnées de test pour un produit
app.post('/create-test-metafield', express.json(), async (req, res) => {
  const { shop_domain, product_handle, test_settings } = req.body;
  
  if (!shop_domain || !product_handle || !test_settings) {
    return res.status(400).json({
      success: false,
      error: 'shop_domain, product_handle et test_settings requis'
    });
  }

  try {
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée'
      });
    }

    // 1. Trouver le produit par handle
    const productResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/products.json?handle=${product_handle}&limit=1`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      }
    );

    if (!productResponse.data.products || productResponse.data.products.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Produit non trouvé avec le handle: ${product_handle}`
      });
    }

    const productId = productResponse.data.products[0].id;

    // 2. Créer ou mettre à jour le métachamp
    const metafieldData = {
      metafield: {
        namespace: 'adlign_data',
        key: 'settings',
        value: JSON.stringify(test_settings),
        type: 'json'
      }
    };

    const metafieldResponse = await axios.post(
      `https://${shop_domain}/admin/api/2024-07/products/${productId}/metafields.json`,
      metafieldData,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
      }
    );

    console.log(`✅ Métachamp créé pour produit ${productId} (${product_handle})`);

    res.json({
      success: true,
      product_id: productId,
      product_handle,
      metafield: metafieldResponse.data.metafield,
      message: 'Métachamp de test créé avec succès'
    });

  } catch (error) {
    console.error('Erreur création métachamp test:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création du métachamp de test',
      details: error.response?.data || error.message
    });
  }
});

// 14. Ajouter le script Adlign au thème
app.post('/inject-adlign-script', express.json(), async (req, res) => {
  const { shop_domain } = req.body;
  
  if (!shop_domain) {
    return res.status(400).json({
      success: false,
      error: 'shop_domain requis'
    });
  }

  try {
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée'
      });
    }

    // 1. Récupérer le thème principal
    const themesResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/themes.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      }
    );

    const mainTheme = themesResponse.data.themes.find(theme => theme.role === 'main');
    if (!mainTheme) {
      return res.status(404).json({
        success: false,
        error: 'Thème principal non trouvé'
      });
    }

    // 2. Lire la section Adlign optimisée
    const sectionPath = path.join(__dirname, 'adlign-smart-injection.liquid');
    const adlignSection = fs.readFileSync(sectionPath, 'utf8');

    // 3. Créer la section Adlign
    const sectionAsset = {
      asset: {
        key: 'sections/adlign-injection.liquid',
        value: adlignSection
      }
    };

    await axios.put(
      `https://${shop_domain}/admin/api/2024-07/themes/${mainTheme.id}/assets.json`,
      sectionAsset,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
      }
    );

    // 4. Modifier le template produit pour inclure le snippet
    let productTemplate;
    try {
      const templateResponse = await axios.get(
        `https://${shop_domain}/admin/api/2024-07/themes/${mainTheme.id}/assets.json?asset[key]=templates/product.liquid`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
          },
        }
      );
      productTemplate = templateResponse.data.asset.value;
    } catch (error) {
      // Si pas de template .liquid, essayer .json
      const templateResponse = await axios.get(
        `https://${shop_domain}/admin/api/2024-07/themes/${mainTheme.id}/assets.json?asset[key]=templates/product.json`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
          },
        }
      );
      
      // Pour les thèmes JSON, on ajoute une section
      const productData = JSON.parse(templateResponse.data.asset.value);
      if (!productData.sections) productData.sections = {};
      
      productData.sections.adlign_injection = {
        type: 'adlign-injection',
        settings: {}
      };
      
      if (!productData.order) productData.order = [];
      if (!productData.order.includes('adlign_injection')) {
        productData.order.push('adlign_injection');
      }

      const updatedTemplate = {
        asset: {
          key: 'templates/product.json',
          value: JSON.stringify(productData, null, 2)
        }
      };

      await axios.put(
        `https://${shop_domain}/admin/api/2024-07/themes/${mainTheme.id}/assets.json`,
        updatedTemplate,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          },
        }
      );

      console.log(`✅ Script Adlign ajouté au thème ${mainTheme.name} (JSON template)`);

      return res.json({
        success: true,
        theme_id: mainTheme.id,
        theme_name: mainTheme.name,
        message: 'Script Adlign injecté avec succès dans le template JSON',
        template_type: 'json'
      });
    }

    // Si template .liquid, ajouter le render du snippet
    if (!productTemplate.includes('{% render \'adlign-injection\' %}')) {
      // Ajouter le snippet à la fin du template
      productTemplate += '\n\n{% comment %}Adlign Injection{% endcomment %}\n{% render \'adlign-injection\' %}';
      
      const updatedTemplate = {
        asset: {
          key: 'templates/product.liquid',
          value: productTemplate
        }
      };

      await axios.put(
        `https://${shop_domain}/admin/api/2024-07/themes/${mainTheme.id}/assets.json`,
        updatedTemplate,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          },
        }
      );
    }

    console.log(`✅ Script Adlign ajouté au thème ${mainTheme.name}`);

    res.json({
      success: true,
      theme_id: mainTheme.id,
      theme_name: mainTheme.name,
      message: 'Script Adlign injecté avec succès',
      template_type: 'liquid'
    });

  } catch (error) {
    console.error('Erreur injection script Adlign:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'injection du script Adlign',
      details: error.response?.data || error.message
    });
  }
});

// 15. Endpoint de test - afficher les logs Adlign
app.get('/test-adlign-logs/:shop/:productHandle', (req, res) => {
  const { shop, productHandle } = req.params;
  
  res.send(`
    <html>
    <head>
      <title>Test Adlign - ${productHandle}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .log { margin: 5px 0; padding: 10px; border-radius: 4px; }
        .success { background: #d4edda; color: #155724; }
        .warning { background: #fff3cd; color: #856404; }
        .error { background: #f8d7da; color: #721c24; }
        .info { background: #d1ecf1; color: #0c5460; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow: auto; }
      </style>
    </head>
    <body>
      <h1>Test Adlign - ${productHandle}</h1>
      <p><strong>Boutique:</strong> ${shop}</p>
      <p><strong>Page produit:</strong> <a href="https://${shop}/products/${productHandle}" target="_blank">Ouvrir la page</a></p>
      
      <h2>Instructions:</h2>
      <ol>
        <li>Ouvrez la page produit dans un nouvel onglet</li>
        <li>Ouvrez les outils de développement (F12)</li>
        <li>Allez dans l'onglet Console</li>
        <li>Rechargez la page</li>
        <li>Recherchez les logs commençant par "[Adlign]"</li>
      </ol>
      
      <h2>Logs attendus:</h2>
      <div class="log info">🚀 [Adlign] Script chargé - Version Production</div>
      <div class="log info">📊 [Adlign] État: {hasSettings: true, isActive: true, ...}</div>
      <div class="log success">✅ [Adlign] Configuration valide trouvée</div>
      <div class="log info">🔄 [Adlign] Initialisation du mapping...</div>
      <div class="log info">🎯 [Adlign] Application du mapping...</div>
      <div class="log success">✅ [Adlign] [élément] mis à jour avec succès</div>
      
      <h2>Tester avec paramètres URL:</h2>
      <p><a href="https://${shop}/products/${productHandle}?adlign_test=1" target="_blank">
        ${shop}/products/${productHandle}?adlign_test=1
      </a></p>
      
      <script>
        console.log('🔧 [Test Adlign] Page de test chargée');
        console.log('💡 [Test Adlign] Ouvrez la page produit pour voir les logs Adlign');
      </script>
    </body>
    </html>
  `);
});

// 16. Test des métadonnées
// === ENDPOINT AJOUT SECTION AU TEMPLATE PRINCIPAL ===
app.post('/api/saas/add-section-to-main-template', express.json(), async (req, res) => {
  try {
    const { shop_domain, theme_id } = req.body;

    if (!shop_domain) {
      return res.status(400).json({ success: false, error: 'shop_domain requis' });
    }

    // 1. Récupérer le token d'accès
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    try {
      if (fs.existsSync(tokensPath)) {
        shopTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
      }
    } catch (error) {
      console.error('Erreur lecture tokens:', error);
    }
    
    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({ success: false, error: 'Token non trouvé pour cette boutique' });
    }

    // 2. Obtenir l'ID du thème principal si non fourni
    let targetThemeId = theme_id;
    if (!targetThemeId) {
      const themesResponse = await axios.get(
        `https://${shop_domain}/admin/api/2024-07/themes.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      const mainTheme = themesResponse.data.themes.find(t => t.role === 'main');
      targetThemeId = mainTheme?.id;
    }

    if (!targetThemeId) {
      return res.status(404).json({ success: false, error: 'Thème principal non trouvé' });
    }

    // 3. Récupérer le template produit principal
    const templateResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json?asset[key]=templates/product.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );

    let productTemplate;
    try {
      productTemplate = JSON.parse(templateResponse.data.asset.value);
    } catch (error) {
      return res.status(400).json({ success: false, error: 'Template produit non valide ou inexistant' });
    }

    // 4. Retirer la section Adlign si elle existe (elle ne doit pas être dans le template principal)
    if (productTemplate.sections.adlign_mapping) {
      delete productTemplate.sections.adlign_mapping;
      
      // La retirer de l'ordre des sections
      const index = productTemplate.order.indexOf('adlign_mapping');
      if (index > -1) {
        productTemplate.order.splice(index, 1);
      }

      // 5. Sauvegarder le template modifié
      await axios.put(
        `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json`,
        {
          asset: {
            key: 'templates/product.json',
            value: JSON.stringify(productTemplate, null, 2)
          }
        },
        { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
      );

      console.log('✅ Section Adlign retirée du template produit principal');
    }

    res.json({
      success: true,
      message: 'Section Adlign retirée du template produit principal avec succès',
      data: {
        theme_id: targetThemeId,
        template_updated: 'templates/product.json',
        section_removed: !!productTemplate.sections.adlign_mapping,
        sections_order: productTemplate.order
      }
    });

  } catch (error) {
    console.error('Erreur ajout section au template:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'ajout de la section au template',
      details: error.response?.data || error.message
    });
  }
});

// === ENDPOINT INSTALLATION FICHIERS THÈME ===
app.post('/api/saas/install-theme-files', express.json(), async (req, res) => {
  try {
    const { shop_domain, theme_id } = req.body;

    if (!shop_domain) {
      return res.status(400).json({ success: false, error: 'shop_domain requis' });
    }

    // 1. Récupérer le token d'accès
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    try {
      if (fs.existsSync(tokensPath)) {
        shopTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
      }
    } catch (error) {
      console.error('Erreur lecture tokens:', error);
    }
    
    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({ success: false, error: 'Token non trouvé pour cette boutique' });
    }

    // 2. Obtenir l'ID du thème principal si non fourni
    let targetThemeId = theme_id;
    if (!targetThemeId) {
      const themesResponse = await axios.get(
        `https://${shop_domain}/admin/api/2024-07/themes.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      const mainTheme = themesResponse.data.themes.find(t => t.role === 'main');
      targetThemeId = mainTheme?.id;
    }

    if (!targetThemeId) {
      return res.status(404).json({ success: false, error: 'Thème principal non trouvé' });
    }

    // 3. Lire les fichiers à installer
    
    const sectionContent = fs.readFileSync(path.join(__dirname, 'adlign-mapping-section.liquid'), 'utf8');
    const templateContent = fs.readFileSync(path.join(__dirname, 'product.adlign.json'), 'utf8');
    const snippetContent = fs.readFileSync(path.join(__dirname, 'adlign-injection.liquid'), 'utf8');

    // 4. Créer la section adlign-mapping-section.liquid
    const sectionResponse = await axios.put(
      `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json`,
      {
        asset: {
          key: 'sections/adlign-mapping-section.liquid',
          value: sectionContent
        }
      },
      { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
    );

    // 5. Créer le template product.adlign.json
    const templateResponse = await axios.put(
      `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json`,
      {
        asset: {
          key: 'templates/product.adlign.json',
          value: templateContent
        }
      },
      { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
    );

    // 6. Créer le snippet adlign-injection.liquid
    const snippetResponse = await axios.put(
      `https://${shop_domain}/admin/api/2024-07/themes/${targetThemeId}/assets.json`,
      {
        asset: {
          key: 'snippets/adlign-injection.liquid',
          value: snippetContent
        }
      },
      { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
    );

    console.log('✅ Fichiers thème Adlign installés avec succès');

    res.json({
      success: true,
      message: 'Fichiers thème Adlign installés avec succès',
      data: {
        theme_id: targetThemeId,
        files_installed: [
          'sections/adlign-mapping-section.liquid',
          'templates/product.adlign.json',
          'snippets/adlign-injection.liquid'
        ],
        section_size: sectionContent.length,
        template_size: templateContent.length,
        snippet_size: snippetContent.length
      }
    });

  } catch (error) {
    console.error('Erreur installation fichiers thème:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'installation des fichiers thème',
      details: error.response?.data || error.message
    });
  }
});

// === ENDPOINT TEST METAFIELDS ===
app.get('/api/saas/test-metafields/:shop_domain', async (req, res) => {
  const { shop_domain } = req.params;
  
  try {
    const tokensPath = path.join(__dirname, 'shop_tokens.json');
    let shopTokens = {};
    
    if (fs.existsSync(tokensPath)) {
      shopTokens = JSON.parse(fs.readFileSync(tokensPath));
    }

    const accessToken = shopTokens[shop_domain];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Boutique non connectée'
      });
    }

    // Test 1: Vérifier les métadonnées existantes
    const metafieldsResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/metafields.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      }
    );

    // Test 2: Vérifier les métadonnées d'un produit spécifique
    const productMetafieldsResponse = await axios.get(
      `https://${shop_domain}/admin/api/2024-07/products/15096939610438/metafields.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      }
    );

    res.json({
      success: true,
      metafields: metafieldsResponse.data,
      product_metafields: productMetafieldsResponse.data
    });

  } catch (error) {
    console.error('Erreur test métadonnées:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du test des métadonnées',
      details: error.response?.data || error.message
    });
  }
});

// 12. Test complet du workflow SaaS
app.post('/api/saas/test-workflow', express.json(), async (req, res) => {
  const { shop_domain, landing_handle } = req.body;
  
  if (!shop_domain || !landing_handle) {
    return res.status(400).json({
      success: false,
      error: 'shop_domain et landing_handle requis'
    });
  }

  try {
    // Récupérer la landing
    const landingsPath = path.join(__dirname, 'local_landings.json');
    let landing = null;
    
    if (fs.existsSync(landingsPath)) {
      const allLandings = JSON.parse(fs.readFileSync(landingsPath));
      landing = allLandings[shop_domain]?.[landing_handle];
    }

    if (!landing) {
      return res.status(404).json({
        success: false,
        error: `Landing page "${landing_handle}" non trouvée`
      });
    }

    // Récupérer le mapping
    const mapping = getMapping(landing.mapping_id);
    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: `Mapping "${landing.mapping_id}" non trouvé`
      });
    }

    // Générer les remplacements
    const replacements = {};
    const landingData = landing;
    const mappingData = mapping.mapping;

    // Mapper le contenu personnalisé aux sélecteurs
    if (landingData.custom_title && mappingData.product_title) {
      replacements[mappingData.product_title.selector] = {
        content: landingData.custom_title,
        type: 'text'
      };
    }
    if (landingData.custom_description && mappingData.product_description) {
      replacements[mappingData.product_description.selector] = {
        content: landingData.custom_description,
        type: 'text'
      };
    }
    if (landingData.custom_price_text && mappingData.product_price) {
      replacements[mappingData.product_price.selector] = {
        content: landingData.custom_price_text,
        type: 'text'
      };
    }
    if (landingData.custom_cta_text && mappingData.add_to_cart_button) {
      replacements[mappingData.add_to_cart_button.selector] = {
        content: landingData.custom_cta_text,
        type: 'text'
      };
    }
    if (landingData.custom_main_image && mappingData.product_main_image) {
      replacements[mappingData.product_main_image.selector] = {
        content: landingData.custom_main_image,
        type: 'image'
      };
    }

    // Générer le script JS
    const jsScript = generateLandingScript(replacements, landingData);

    res.json({
      success: true,
      message: `Workflow SaaS testé pour "${landing_handle}"`,
      landing: landing,
      mapping: mappingData,
      replacements: replacements,
      elements_count: Object.keys(replacements).length,
      js_script: jsScript
    });
  } catch (error) {
    console.error('Erreur test workflow SaaS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du test du workflow'
    });
  }
});

// ===========================================
// 🚀 API EXTERNE SIMPLE POUR ADLIGN
// ===========================================

// Endpoint pour récupérer la config d'une campagne
app.get('/api/campaign/:variant', (req, res) => {
  const { variant } = req.params;
  const { product_id } = req.query;
  
  console.log(`📡 [API Campaign] Demande pour variant: ${variant}, produit: ${product_id}`);
  
  // Configurations de campagnes (hardcodées pour le POC)
  const campaigns = {
    'test': {
      success: true,
      campaign_name: 'Test Campaign',
      changes: {
        title: '🔥 SAVON PREMIUM EXCLUSIF - OFFRE LIMITÉE',
        price: '14,90€ <strike style="color:#999;">29,90€</strike> <span style="color:#e74c3c;">-50%</span>',
        cta: '🚀 COMMANDER MAINTENANT',
        description: '<p><strong>Offre exclusive !</strong> Ce savon artisanal aux noix de coco est fabriqué selon des méthodes traditionnelles.</p>'
      },
      selectors: {
        title: 'h1',
        price: '.price',
        cta: 'button[type="submit"]',
        description: '.product__description'
      }
    },
    'promo': {
      success: true,
      campaign_name: 'Black Friday',
      changes: {
        title: '🖤 BLACK FRIDAY - 70% DE RÉDUCTION',
        price: '8,90€ <strike>29,90€</strike> 🔥',
        cta: '⚡ PROFITER DE L\'OFFRE',
        description: '<p>🔥 <strong>BLACK FRIDAY EXCEPTIONNEL</strong> - Plus que 24h pour profiter de cette offre unique !</p>'
      },
      selectors: {
        title: 'h1',
        price: '.price',
        cta: 'button[type="submit"]',
        description: '.product__description'
      }
    },
    'vip': {
      success: true,
      campaign_name: 'VIP Exclusive',
      changes: {
        title: '👑 ACCÈS VIP - PRODUIT EXCLUSIF',
        price: '24,90€ <span style="color:#gold;">★ PREMIUM ★</span>',
        cta: '👑 ACCÈS VIP',
        description: '<p>✨ <strong>Accès exclusif VIP</strong> - Produit disponible uniquement pour nos membres privilégiés.</p>'
      },
      selectors: {
        title: 'h1',
        price: '.price',
        cta: 'button[type="submit"]',
        description: '.product__description'
      }
    }
  };
  
  const campaign = campaigns[variant];
  
  if (!campaign) {
    return res.status(404).json({
      success: false,
      error: `Campagne '${variant}' non trouvée`,
      available_campaigns: Object.keys(campaigns)
    });
  }
  
  // Ajouter des logs pour debug
  campaign.debug = {
    timestamp: new Date().toISOString(),
    variant: variant,
    product_id: product_id
  };
  
  console.log(`✅ [API Campaign] Config envoyée pour ${variant}`);
  res.json(campaign);
});

// Endpoint pour lister toutes les campagnes disponibles
app.get('/api/campaigns', (req, res) => {
  res.json({
    success: true,
    available_campaigns: ['test', 'promo', 'vip'],
    usage: 'GET /api/campaign/{variant}?product_id={id}',
    examples: [
      '/api/campaign/test?product_id=15096939610438',
      '/api/campaign/promo?product_id=15096939610438',
      '/api/campaign/vip?product_id=15096939610438'
    ]
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Serveur backend lancé sur http://localhost:${PORT}`);
  console.log(`🎯 Endpoints SaaS disponibles sur /api/saas/`);
  console.log(`✨ Endpoints Campaign disponibles sur /api/campaign/`);
});
