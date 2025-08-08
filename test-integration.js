/**
 * Test d'intégration Adlign
 * Vérifie que tous les composants fonctionnent correctement
 */

const axios = require('axios');

const TEST_CONFIG = {
  backendUrl: 'http://localhost:3000',
  testServerUrl: 'http://localhost:3001',
  shopDomain: 'adlign.myshopify.com',
  productId: '15096939610438',
  landingHandle: 'black-friday-2024',
  mappingId: 'mapping_1754625541045_ubaly9sic'
};

class AdlignIntegrationTest {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  log(message, status = 'INFO') {
    const timestamp = new Date().toISOString();
    const emoji = {
      'INFO': 'ℹ️',
      'SUCCESS': '✅',
      'ERROR': '❌',
      'WARNING': '⚠️'
    }[status] || 'ℹ️';
    
    console.log(`${emoji} [${timestamp}] ${message}`);
    this.results.push({ message, status, timestamp });
  }

  async testBackendHealth() {
    this.log('Test de santé du backend...');
    try {
      const response = await axios.get(`${TEST_CONFIG.backendUrl}/`);
      if (response.status === 200) {
        this.log('Backend accessible', 'SUCCESS');
        return true;
      }
    } catch (error) {
      this.log(`Backend inaccessible: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testTestServerHealth() {
    this.log('Test de santé du serveur de test...');
    try {
      const response = await axios.get(`${TEST_CONFIG.testServerUrl}/`);
      if (response.status === 200) {
        this.log('Serveur de test accessible', 'SUCCESS');
        return true;
      }
    } catch (error) {
      this.log(`Serveur de test inaccessible: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testMappingAPI() {
    this.log('Test de l\'API de mapping...');
    try {
      const response = await axios.get(`${TEST_CONFIG.testServerUrl}/api/saas/mapping/${TEST_CONFIG.mappingId}`);
      if (response.data.success && response.data.mapping) {
        this.log(`Mapping récupéré avec ${Object.keys(response.data.mapping).length} éléments`, 'SUCCESS');
        return true;
      }
    } catch (error) {
      this.log(`Erreur API mapping: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testGraphQLAPI() {
    this.log('Test de l\'API GraphQL...');
    try {
      const query = `
        query getProductMetafields($handle: String!) {
          product(handle: $handle) {
            id
            metafields(namespace: "adlign", first: 50) {
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

      const response = await axios.post(`${TEST_CONFIG.testServerUrl}/api/graphql`, {
        query,
        variables: { handle: 'test-product' }
      });

      if (response.data.data?.product?.metafields?.edges) {
        const metafieldsCount = response.data.data.product.metafields.edges.length;
        this.log(`Métadonnées récupérées: ${metafieldsCount} champs`, 'SUCCESS');
        return true;
      }
    } catch (error) {
      this.log(`Erreur API GraphQL: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testProductMetafieldsAPI() {
    this.log('Test de l\'API métadonnées produit...');
    try {
      const response = await axios.post(`${TEST_CONFIG.backendUrl}/api/saas/product-metafields`, {
        shop_domain: TEST_CONFIG.shopDomain,
        product_id: TEST_CONFIG.productId
      });

      if (response.data.success && response.data.metafields) {
        this.log(`Métadonnées produit récupérées: ${response.data.metafields.length} champs`, 'SUCCESS');
        return true;
      }
    } catch (error) {
      this.log(`Erreur API métadonnées produit: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testDuplicationAPI() {
    this.log('Test de l\'API de duplication...');
    try {
      const response = await axios.post(`${TEST_CONFIG.backendUrl}/api/saas/duplicate-product-page`, {
        shop_domain: TEST_CONFIG.shopDomain,
        product_id: TEST_CONFIG.productId,
        landing_handle: TEST_CONFIG.landingHandle,
        mapping_id: TEST_CONFIG.mappingId
      });

      if (response.data.success) {
        this.log(`Duplication réussie: ${response.data.data.metafields_created} métadonnées créées`, 'SUCCESS');
        return true;
      }
    } catch (error) {
      this.log(`Erreur API duplication: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testPageAccessibility() {
    this.log('Test d\'accessibilité des pages...');
    const pages = [
      `${TEST_CONFIG.testServerUrl}/`,
      `${TEST_CONFIG.testServerUrl}/test-product-page.html`,
      `${TEST_CONFIG.testServerUrl}/test-product-page.html?landing=${TEST_CONFIG.landingHandle}&mapping=${TEST_CONFIG.mappingId}`
    ];

    for (const page of pages) {
      try {
        const response = await axios.get(page);
        if (response.status === 200) {
          this.log(`Page accessible: ${page.split('/').pop()}`, 'SUCCESS');
        }
      } catch (error) {
        this.log(`Page inaccessible: ${page.split('/').pop()} - ${error.message}`, 'ERROR');
      }
    }
  }

  generateReport() {
    const duration = Date.now() - this.startTime;
    const successCount = this.results.filter(r => r.status === 'SUCCESS').length;
    const errorCount = this.results.filter(r => r.status === 'ERROR').length;
    const totalTests = this.results.length;

    console.log('\n' + '='.repeat(60));
    console.log('🎯 RAPPORT DE TEST ADLIGN');
    console.log('='.repeat(60));
    console.log(`⏱️  Durée totale: ${duration}ms`);
    console.log(`📊 Tests réussis: ${successCount}/${totalTests}`);
    console.log(`❌ Tests échoués: ${errorCount}/${totalTests}`);
    console.log(`📈 Taux de succès: ${((successCount / totalTests) * 100).toFixed(1)}%`);

    if (errorCount === 0) {
      console.log('\n🎉 TOUS LES TESTS SONT PASSÉS !');
      console.log('✅ L\'intégration Adlign est prête pour la production');
    } else {
      console.log('\n⚠️  CERTAINS TESTS ONT ÉCHOUÉ');
      console.log('🔧 Vérifiez les erreurs ci-dessus');
    }

    console.log('\n📋 Détail des tests:');
    this.results.forEach((result, index) => {
      const status = result.status === 'SUCCESS' ? '✅' : result.status === 'ERROR' ? '❌' : 'ℹ️';
      console.log(`${index + 1}. ${status} ${result.message}`);
    });

    console.log('\n🔗 URLs de test:');
    console.log(`📄 Page d'accueil: ${TEST_CONFIG.testServerUrl}/`);
    console.log(`🧪 Page produit normale: ${TEST_CONFIG.testServerUrl}/test-product-page.html`);
    console.log(`🎯 Page avec Adlign: ${TEST_CONFIG.testServerUrl}/test-product-page.html?landing=${TEST_CONFIG.landingHandle}&mapping=${TEST_CONFIG.mappingId}`);
    
    console.log('\n' + '='.repeat(60));
  }

  async runAllTests() {
    console.log('🚀 Démarrage des tests d\'intégration Adlign...\n');

    await this.testBackendHealth();
    await this.testTestServerHealth();
    await this.testMappingAPI();
    await this.testGraphQLAPI();
    await this.testProductMetafieldsAPI();
    await this.testDuplicationAPI();
    await this.testPageAccessibility();

    this.generateReport();
  }
}

// Exécuter les tests
if (require.main === module) {
  const test = new AdlignIntegrationTest();
  test.runAllTests().catch(console.error);
}

module.exports = AdlignIntegrationTest;
