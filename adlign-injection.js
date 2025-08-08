/**
 * Adlign - Script d'injection pour pages produits Shopify
 * Utilise le mapping auto IA pour personnaliser dynamiquement le contenu
 */

(function() {
  'use strict';
  
  // Configuration Adlign
  const ADLIGN_CONFIG = {
    backendUrl: 'http://localhost:3000', // À changer en production
    debug: true
  };
  
  // Détecter si on est sur une landing Adlign
  function detectAdlignLanding() {
    const urlParams = new URLSearchParams(window.location.search);
    const landingParam = urlParams.get('landing');
    const mappingParam = urlParams.get('mapping');
    
    return {
      isLanding: !!landingParam,
      landingHandle: landingParam,
      mappingId: mappingParam
    };
  }
  
  // Masquer le contenu Shopify natif
  function hideNativeContent() {
    const selectorsToHide = [
      '.product-title',
      '.product__title', 
      '.title',
      '.price',
      '.product__price',
      '.product-description',
      '.description',
      '.add-to-cart',
      '.btn',
      '.reviews',
      '.rating'
    ];
    
    selectorsToHide.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.style.display = 'none';
      });
    });
    
    if (ADLIGN_CONFIG.debug) {
      console.log('🎭 Contenu Shopify natif masqué');
    }
  }
  
  // Récupérer le mapping depuis le backend
  async function fetchMapping(mappingId) {
    try {
      const response = await fetch(`${ADLIGN_CONFIG.backendUrl}/mapping/${mappingId}`);
      const data = await response.json();
      
      if (data.success) {
        return data.mapping;
      } else {
        throw new Error('Mapping non trouvé');
      }
    } catch (error) {
      console.error('❌ Erreur récupération mapping:', error);
      return null;
    }
  }
  
  // Récupérer le contenu de la landing depuis le backend
  async function fetchLandingContent(landingHandle) {
    try {
      const response = await fetch(`${ADLIGN_CONFIG.backendUrl}/landing/${landingHandle}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data;
    } catch (error) {
      console.error('❌ Erreur récupération landing:', error);
      return null;
    }
  }
  
  // Appliquer le mapping avec le contenu personnalisé
  function applyMapping(mapping, content) {
    const { mapping: elements } = mapping;
    const results = {
      success: 0,
      failed: 0,
      details: []
    };
    
    // Fonction pour remplacer le contenu
    function replaceContent(selector, newContent, type) {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
        if (ADLIGN_CONFIG.debug) {
          console.warn('⚠️ Sélecteur non trouvé:', selector);
        }
        return false;
      }
      
      elements.forEach((element, index) => {
        try {
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
            case 'badges':
              element.innerHTML = newContent;
              break;
            case 'reviews':
              element.innerHTML = newContent;
              break;
            default:
              element.innerHTML = newContent;
          }
          
          if (ADLIGN_CONFIG.debug) {
            console.log('✅ Remplacé:', selector, '->', newContent);
          }
        } catch (error) {
          console.error('❌ Erreur remplacement:', selector, error);
        }
      });
      
      return true;
    }
    
    // Mapper le contenu de la landing vers les éléments détectés
    const contentMapping = {
      product_title: content.headline,
      product_price: content.pack_pricing?.[0]?.price || content.special_price,
      product_description: content.description,
      add_to_cart_button: content.blocks?.[0]?.text || 'Ajouter au panier',
      product_badges: content.badges?.join(' • '),
      product_reviews: `${content.review_stars} ⭐ (${content.review_count} avis)`,
      product_image: content.hero_image
    };
    
    // Appliquer les remplacements
    for (const [key, element] of Object.entries(elements)) {
      const newContent = contentMapping[key];
      
      if (newContent) {
        if (replaceContent(element.selector, newContent, element.type)) {
          results.success++;
          results.details.push({ element: key, status: 'success' });
        } else {
          results.failed++;
          results.details.push({ element: key, status: 'failed', selector: element.selector });
        }
      }
    }
    
    if (ADLIGN_CONFIG.debug) {
      console.log('📊 Résultats du mapping:', results);
    }
    
    return results;
  }
  
  // Ajouter des éléments personnalisés si nécessaire
  function addCustomElements(content) {
    // Ajouter un badge de promotion si pas déjà présent
    if (content.badges && content.badges.length > 0) {
      const badgeContainer = document.createElement('div');
      badgeContainer.className = 'adlign-badge-container';
      badgeContainer.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1000;
        background: linear-gradient(45deg, #ff6b6b, #ee5a24);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-weight: bold;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      badgeContainer.textContent = content.badges[0];
      
      const productContainer = document.querySelector('.product-single, .product__media, .product-image');
      if (productContainer) {
        productContainer.style.position = 'relative';
        productContainer.appendChild(badgeContainer);
      }
    }
    
    // Ajouter un compteur d'urgence si configuré
    if (content.urgency_counter) {
      const urgencyDiv = document.createElement('div');
      urgencyDiv.className = 'adlign-urgency-counter';
      urgencyDiv.style.cssText = `
        background: #ff4757;
        color: white;
        padding: 15px;
        text-align: center;
        font-weight: bold;
        margin: 20px 0;
        border-radius: 8px;
        animation: pulse 2s infinite;
      `;
      urgencyDiv.innerHTML = `
        <div>⏰ OFFRE LIMITÉE</div>
        <div style="font-size: 24px;">${content.urgency_counter}</div>
      `;
      
      const addToCartButton = document.querySelector('.add-to-cart, .btn');
      if (addToCartButton) {
        addToCartButton.parentNode.insertBefore(urgencyDiv, addToCartButton);
      }
    }
  }
  
  // Fonction principale d'initialisation
  async function initAdlign() {
    const landingInfo = detectAdlignLanding();
    
    if (!landingInfo.isLanding) {
      if (ADLIGN_CONFIG.debug) {
        console.log('🚫 Pas de landing Adlign détectée');
      }
      return;
    }
    
    if (ADLIGN_CONFIG.debug) {
      console.log('🎯 Landing Adlign détectée:', landingInfo);
    }
    
    // Masquer le contenu natif
    hideNativeContent();
    
    // Récupérer le mapping et le contenu
    let mapping = null;
    let content = null;
    
    if (landingInfo.mappingId) {
      // Utiliser le mapping auto IA
      mapping = await fetchMapping(landingInfo.mappingId);
      content = await fetchLandingContent(landingInfo.landingHandle);
    } else {
      // Fallback vers le système MVP
      content = await fetchLandingContent(landingInfo.landingHandle);
    }
    
    if (!content) {
      console.error('❌ Impossible de récupérer le contenu de la landing');
      return;
    }
    
    // Appliquer le mapping si disponible
    if (mapping) {
      const results = applyMapping(mapping, content);
      if (ADLIGN_CONFIG.debug) {
        console.log('🎨 Mapping appliqué:', results);
      }
    } else {
      // Fallback vers le système MVP (hardcodé)
      if (ADLIGN_CONFIG.debug) {
        console.log('🔄 Utilisation du système MVP (mapping hardcodé)');
      }
    }
    
    // Ajouter des éléments personnalisés
    addCustomElements(content);
    
    if (ADLIGN_CONFIG.debug) {
      console.log('✅ Landing Adlign initialisée avec succès!');
    }
  }
  
  // Attendre que le DOM soit chargé
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdlign);
  } else {
    initAdlign();
  }
  
  // CSS pour les animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    
    .adlign-badge-container {
      animation: pulse 2s infinite;
    }
  `;
  document.head.appendChild(style);
  
})();
