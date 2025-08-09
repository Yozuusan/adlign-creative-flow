/**
 * Adlign Shopify Injection Script
 * Remplace dynamiquement le contenu des pages produits selon les métadonnées
 */

(function() {
  'use strict';

  // Configuration
  const ADLIGN_CONFIG = {
    namespace: 'adlign_data',
    debug: true,
    animationDuration: 300,
    fallbackSelectors: {
      product_title: ['h1', '.product-title', '.product__title', '[data-product-title]'],
      product_description: ['.product-description', '.product__description', '[data-product-description]'],
      product_price: ['.product-price', '.price', '.product__price', '[data-product-price]'],
      add_to_cart_button: ['.add-to-cart', '.product-form__submit', '[data-add-to-cart]'],
      product_vendor: ['.product-vendor', '.vendor', '[data-product-vendor]']
    }
  };

  // Utilitaires
  const AdlignUtils = {
    log: function(message, data = null) {
      if (ADLIGN_CONFIG.debug) {
        console.log(`[Adlign] ${message}`, data || '');
      }
    },

    error: function(message, error = null) {
      console.error(`[Adlign Error] ${message}`, error || '');
    },

    getUrlParameter: function(name) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(name);
    },

    findElement: function(selectors) {
      if (typeof selectors === 'string') {
        return document.querySelector(selectors);
      }
      
      if (Array.isArray(selectors)) {
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) return element;
        }
      }
      
      return null;
    },

    animateElement: function(element, newContent, type = 'text') {
      if (!element) return false;

      return new Promise((resolve) => {
        // Fade out
        element.style.transition = `opacity ${ADLIGN_CONFIG.animationDuration}ms ease-out`;
        element.style.opacity = '0';

        setTimeout(() => {
          // Replace content
          if (type === 'text') {
            element.textContent = newContent;
          } else if (type === 'html') {
            element.innerHTML = newContent;
          } else if (type === 'image') {
            element.src = newContent;
            element.alt = newContent.split('/').pop().replace(/\.[^/.]+$/, '');
          } else if (type === 'attribute') {
            element.setAttribute('data-original-value', element.textContent);
            element.textContent = newContent;
          }

          // Fade in
          element.style.opacity = '1';
          
          setTimeout(() => {
            element.style.transition = '';
            resolve(true);
          }, ADLIGN_CONFIG.animationDuration);
        }, ADLIGN_CONFIG.animationDuration);
      });
    }
  };

  // Gestionnaire des métadonnées Shopify
  const AdlignMetafields = {
    async getProductMetafields(productId) {
      try {
        // Récupérer les métadonnées via l'API Shopify Storefront
        const response = await fetch(`/admin/api/2024-07/products/${productId}/metafields.json?namespace=${ADLIGN_CONFIG.namespace}`, {
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.metafields || [];
      } catch (error) {
        AdlignUtils.error('Erreur lors de la récupération des métadonnées:', error);
        return [];
      }
    },

    async getMetafieldsFromGraphQL() {
      try {
        // Alternative: utiliser GraphQL pour récupérer les métadonnées
        const query = `
          query getProductMetafields($handle: String!) {
            product(handle: $handle) {
              id
              metafields(namespace: "${ADLIGN_CONFIG.namespace}", first: 50) {
                edges {
                  node {
                    id
                    key
                    value
                    type
                  }
                }
              }
            }
          }
        `;

        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: {
              handle: window.location.pathname.split('/products/')[1]?.split('?')[0]
            }
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data?.product?.metafields?.edges?.map(edge => edge.node) || [];
      } catch (error) {
        AdlignUtils.error('Erreur GraphQL lors de la récupération des métadonnées:', error);
        return [];
      }
    }
  };

  // Gestionnaire du mapping et remplacement
  const AdlignContentReplacer = {
    async replaceContent(metafields, mapping) {
      AdlignUtils.log('Début du remplacement de contenu', { metafields, mapping });

      const replacements = [];
      const metafieldsMap = {};

      // Créer un map des métadonnées
      metafields.forEach(metafield => {
        metafieldsMap[metafield.key] = metafield.value;
      });

      // Vérifier si la landing est active
      if (metafieldsMap.is_active !== 'true') {
        AdlignUtils.log('Landing page non active, arrêt du remplacement');
        return false;
      }

      // Appliquer les remplacements selon le mapping
      for (const [elementType, elementData] of Object.entries(mapping)) {
        const customValue = metafieldsMap[`custom_${elementType}`];
        
        if (customValue && elementData.selector) {
          const element = AdlignUtils.findElement(elementData.selector);
          
          if (element) {
            replacements.push(
              AdlignUtils.animateElement(element, customValue, elementData.type || 'text')
            );
            AdlignUtils.log(`Remplacement ${elementType}:`, { selector: elementData.selector, value: customValue });
          } else {
            // Essayer les sélecteurs de fallback
            const fallbackSelectors = ADLIGN_CONFIG.fallbackSelectors[elementType];
            if (fallbackSelectors) {
              const fallbackElement = AdlignUtils.findElement(fallbackSelectors);
              if (fallbackElement) {
                replacements.push(
                  AdlignUtils.animateElement(fallbackElement, customValue, elementData.type || 'text')
                );
                AdlignUtils.log(`Remplacement ${elementType} (fallback):`, { selectors: fallbackSelectors, value: customValue });
              }
            }
          }
        }
      }

      // Attendre que tous les remplacements soient terminés
      await Promise.all(replacements);
      
      AdlignUtils.log('Remplacement de contenu terminé', { totalReplacements: replacements.length });
      return true;
    }
  };

  // Gestionnaire principal
  const AdlignManager = {
    async init() {
      AdlignUtils.log('Initialisation d\'Adlign Injection Script');

      // Vérifier les paramètres URL
      const landingHandle = AdlignUtils.getUrlParameter('landing');
      const mappingId = AdlignUtils.getUrlParameter('mapping');

      if (!landingHandle || !mappingId) {
        AdlignUtils.log('Paramètres de landing manquants, arrêt du script');
        return;
      }

      AdlignUtils.log('Paramètres détectés:', { landingHandle, mappingId });

      try {
        // Récupérer le mapping depuis le backend
        const mappingResponse = await fetch(`/api/saas/mapping/${mappingId}`);
        if (!mappingResponse.ok) {
          throw new Error(`Erreur lors de la récupération du mapping: ${mappingResponse.status}`);
        }

        const mappingData = await mappingResponse.json();
        if (!mappingData.success) {
          throw new Error(`Mapping non trouvé: ${mappingId}`);
        }

        const mapping = mappingData.mapping;

        // Récupérer les métadonnées du produit
        const productId = this.extractProductId();
        if (!productId) {
          throw new Error('Impossible d\'extraire l\'ID du produit');
        }

        const metafields = await AdlignMetafields.getMetafieldsFromGraphQL();
        if (metafields.length === 0) {
          AdlignUtils.error('Aucune métadonnée trouvée pour ce produit');
          return;
        }

        // Appliquer les remplacements
        const success = await AdlignContentReplacer.replaceContent(metafields, mapping);
        
        if (success) {
          AdlignUtils.log('✅ Remplacement de contenu réussi');
          this.addSuccessIndicator();
        } else {
          AdlignUtils.error('❌ Échec du remplacement de contenu');
        }

      } catch (error) {
        AdlignUtils.error('Erreur lors de l\'initialisation:', error);
      }
    },

    extractProductId() {
      // Extraire l'ID du produit depuis la page
      const productIdElement = document.querySelector('[data-product-id]');
      if (productIdElement) {
        return productIdElement.getAttribute('data-product-id');
      }

      // Fallback: essayer d'extraire depuis l'URL ou d'autres éléments
      const urlMatch = window.location.pathname.match(/\/products\/(\d+)/);
      if (urlMatch) {
        return urlMatch[1];
      }

      return null;
    },

    addSuccessIndicator() {
      // Ajouter un indicateur visuel que le script a fonctionné
      const indicator = document.createElement('div');
      indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #4CAF50;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      indicator.textContent = '🎯 Adlign Active';
      document.body.appendChild(indicator);

      // Afficher puis masquer l'indicateur
      setTimeout(() => indicator.style.opacity = '1', 100);
      setTimeout(() => {
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 300);
      }, 3000);
    }
  };

  // Initialisation automatique quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AdlignManager.init());
  } else {
    AdlignManager.init();
  }

  // Exposer l'API pour un usage externe
  window.Adlign = {
    init: AdlignManager.init.bind(AdlignManager),
    utils: AdlignUtils,
    config: ADLIGN_CONFIG
  };

})();
