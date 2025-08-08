// ===== SCRIPT D'INJECTION ADLIGN POUR SHOPIFY =====
// À injecter dans templates/product.liquid ou product.json

console.log('🔍 Adlign Script chargé');

// Configuration
const ADLIGN_API_URL = 'http://localhost:3000';
const SHOP_DOMAIN = 'adlign.myshopify.com';

// Détecter les paramètres URL
const urlParams = new URLSearchParams(window.location.search);
const landingHandle = urlParams.get('landing');
const mappingId = urlParams.get('mapping');

if (landingHandle) {
  console.log(`🚀 Landing page détectée: ${landingHandle}`);
  
  // Créer le conteneur Adlign
  const adlignContainer = document.createElement('div');
  adlignContainer.id = 'adlign-landing-container';
  adlignContainer.style.cssText = `
    position: relative;
    z-index: 1000;
    background: #fff;
    min-height: 100vh;
    padding: 20px;
  `;
  
  // Masquer le contenu original
  const originalContent = document.querySelector('main') || document.querySelector('.main') || document.body;
  if (originalContent) {
    originalContent.style.display = 'none';
    console.log('✅ Contenu original masqué');
  }
  
  // Injecter le conteneur Adlign
  document.body.appendChild(adlignContainer);
  
  // Charger la landing page
  loadAdlignLanding(landingHandle);
} else {
  console.log('ℹ️ Pas de landing page détectée, affichage normal');
}

async function loadAdlignLanding(handle) {
  try {
    console.log(`📥 Chargement landing: ${handle}`);
    
    // Afficher un loader
    adlignContainer.innerHTML = `
      <div style="text-align: center; padding: 50px;">
        <h2>🚀 Chargement de votre offre exclusive...</h2>
        <div style="margin: 20px 0;">
          <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto;"></div>
        </div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    
    // Récupérer la landing page
    const response = await fetch(`${ADLIGN_API_URL}/local-landing/${handle}?shop_domain=${SHOP_DOMAIN}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Landing page non trouvée');
    }
    
    const landingData = result.landing;
    console.log('✅ Landing page chargée:', landingData);
    
    // Récupérer le mapping
    const mappingResponse = await fetch(`${ADLIGN_API_URL}/mapping/${landingData.mapping_id}`);
    const mappingResult = await mappingResponse.json();
    
    if (!mappingResult.success) {
      throw new Error('Mapping non trouvé');
    }
    
    const mapping = mappingResult.mapping.mapping;
    console.log('✅ Mapping chargé:', Object.keys(mapping));
    
    // Générer la page personnalisée
    generateLandingPage(landingData, mapping);
    
  } catch (error) {
    console.error('❌ Erreur chargement landing:', error);
    adlignContainer.innerHTML = `
      <div style="text-align: center; padding: 50px; color: red;">
        <h2>❌ Erreur de chargement</h2>
        <p>${error.message}</p>
        <button onclick="location.reload()" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px;">
          🔄 Réessayer
        </button>
      </div>
    `;
  }
}

function generateLandingPage(landingData, mapping) {
  console.log('🎨 Génération de la landing page...');
  
  // Template de landing page
  const landingHTML = `
    <div class="adlign-landing" style="max-width: 1200px; margin: 0 auto; font-family: Arial, sans-serif;">
      
      <!-- Header avec badges -->
      <div class="adlign-badges" style="text-align: center; margin-bottom: 20px;">
        ${landingData.custom_badges ? 
          landingData.custom_badges.split(',').map(badge => 
            `<span style="background: #e74c3c; color: white; padding: 5px 15px; margin: 5px; border-radius: 20px; font-size: 12px; font-weight: bold;">${badge.trim()}</span>`
          ).join('') : ''
        }
      </div>
      
      <!-- Titre principal -->
      <h1 style="text-align: center; font-size: 2.5em; color: #2c3e50; margin-bottom: 20px;">
        ${landingData.custom_title || 'Offre Spéciale'}
      </h1>
      
      <!-- Message d'urgence -->
      ${landingData.custom_urgency_text ? 
        `<div style="background: #f39c12; color: white; text-align: center; padding: 15px; margin-bottom: 20px; border-radius: 10px; font-weight: bold;">
          ${landingData.custom_urgency_text}
        </div>` : ''
      }
      
      <!-- Container produit -->
      <div style="display: flex; flex-wrap: wrap; gap: 40px; align-items: center;">
        
        <!-- Galerie produit (simulée) -->
        <div style="flex: 1; min-width: 300px;">
          <div id="adlign-gallery" style="background: #ecf0f1; height: 400px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2em; color: #7f8c8d;">
            📸 Galerie Produit
            <br><small>Sera remplacée par le mapping IA</small>
          </div>
        </div>
        
        <!-- Informations produit -->
        <div style="flex: 1; min-width: 300px;">
          
          <!-- Prix -->
          <div id="adlign-price" style="font-size: 2em; color: #e74c3c; font-weight: bold; margin-bottom: 20px;">
            ${landingData.custom_price_text || 'Prix spécial'}
          </div>
          
          <!-- Description -->
          <div style="margin-bottom: 30px; line-height: 1.6; color: #2c3e50;">
            ${landingData.custom_description || 'Description du produit personnalisée'}
          </div>
          
          <!-- Sélecteur de variantes (simulé) -->
          <div id="adlign-variants" style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 10px; font-weight: bold;">Choisir une option :</label>
            <select style="width: 100%; padding: 10px; border: 2px solid #bdc3c7; border-radius: 5px;">
              <option>Option 1</option>
              <option>Option 2</option>
              <option>Option 3</option>
            </select>
          </div>
          
          <!-- Bouton CTA -->
          <button id="adlign-cta" style="
            width: 100%; 
            padding: 20px; 
            background: #27ae60; 
            color: white; 
            border: none; 
            border-radius: 10px; 
            font-size: 1.3em; 
            font-weight: bold; 
            cursor: pointer;
            transition: all 0.3s;
          " onmouseover="this.style.background='#2ecc71'" onmouseout="this.style.background='#27ae60'">
            ${landingData.custom_cta_text || '🛒 Ajouter au Panier'}
          </button>
          
          <!-- Informations de livraison -->
          ${landingData.custom_shipping_text ? 
            `<div style="margin-top: 20px; padding: 15px; background: #d5f4e6; border-radius: 5px; color: #27ae60;">
              <strong>📦 ${landingData.custom_shipping_text}</strong>
            </div>` : ''
          }
          
        </div>
      </div>
      
      <!-- Section debug -->
      <div style="margin-top: 50px; padding: 20px; background: #f8f9fa; border-radius: 10px; border-left: 4px solid #3498db;">
        <h3>🔧 Debug Adlign</h3>
        <div style="font-family: monospace; font-size: 12px;">
          <div><strong>Landing Handle:</strong> ${landingData.handle}</div>
          <div><strong>Mapping ID:</strong> ${landingData.mapping_id}</div>
          <div><strong>Campagne:</strong> ${landingData.campaign_name || 'Non définie'}</div>
          <div><strong>Éléments mappés:</strong> ${Object.keys(mapping).join(', ')}</div>
          <div><strong>Stockage:</strong> Local JSON</div>
        </div>
      </div>
      
    </div>
  `;
  
  // Injecter le HTML
  adlignContainer.innerHTML = landingHTML;
  
  // Appliquer les remplacements basés sur le mapping
  applyMappingReplacements(landingData, mapping);
  
  console.log('✅ Landing page générée avec succès');
}

function applyMappingReplacements(landingData, mapping) {
  console.log('🔧 Application des remplacements de mapping...');
  
  // Simuler les remplacements (en attendant la vraie intégration)
  Object.entries(mapping).forEach(([elementType, elementData]) => {
    console.log(`🎯 Mapping ${elementType}:`, elementData.selector);
    
    // Essayer de trouver l'élément dans la page originale (cachée)
    const originalElement = document.querySelector(elementData.selector);
    if (originalElement) {
      console.log(`✅ Élément trouvé pour ${elementType}:`, originalElement);
      // Ici on pourrait copier/modifier l'élément original
    } else {
      console.warn(`⚠️ Élément non trouvé pour ${elementType}: ${elementData.selector}`);
    }
  });
  
  // Ajouter des événements
  const ctaButton = document.getElementById('adlign-cta');
  if (ctaButton) {
    ctaButton.addEventListener('click', () => {
      alert('🚀 Adlign CTA cliqué ! \n\nIntégration réussie avec le mapping IA.');
      console.log('🎯 Conversion Adlign:', landingData.handle);
    });
  }
}

// Styles CSS pour l'animation
const adlignStyles = document.createElement('style');
adlignStyles.innerHTML = `
  .adlign-landing * {
    box-sizing: border-box;
  }
  
  .adlign-badges span {
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  
  #adlign-cta:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(39, 174, 96, 0.3);
  }
  
  @media (max-width: 768px) {
    .adlign-landing h1 {
      font-size: 1.8em !important;
    }
    
    .adlign-landing > div > div {
      flex-direction: column !important;
    }
  }
`;
document.head.appendChild(adlignStyles);

console.log('🎯 Script d\'injection Adlign initialisé');
