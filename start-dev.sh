#!/bin/bash

echo "🚀 Démarrage d'Adlign Backend avec Claude AI..."

# Vérifier si .env existe
if [ ! -f .env ]; then
    echo "⚠️  Fichier .env non trouvé"
    echo "📝 Créez un fichier .env avec la configuration suivante:"
    echo ""
    echo "# Shopify Configuration"
    echo "SHOPIFY_API_KEY=your_shopify_api_key"
    echo "SHOPIFY_API_SECRET=your_shopify_api_secret"
    echo "SHOPIFY_SCOPES=read_products,write_products,read_metaobjects,write_metaobjects,read_themes,write_themes"
    echo "SHOPIFY_APP_URL=https://your-app.com"
    echo ""
    echo "# Claude AI Configuration"
    echo "CLAUDE_API_KEY=your_claude_api_key_here"
    echo ""
    echo "# Backend Configuration"
    echo "PORT=3000"
    echo "NODE_ENV=development"
    echo ""
    echo "🔑 Obtenez votre clé Claude API sur: https://console.anthropic.com/"
    exit 1
fi

# Vérifier si CLAUDE_API_KEY est configurée
if ! grep -q "CLAUDE_API_KEY" .env; then
    echo "⚠️  CLAUDE_API_KEY non configurée dans .env"
    echo "🔑 Ajoutez votre clé Claude API pour utiliser l'analyse IA"
fi

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
fi

# Démarrer le serveur
echo "🎯 Démarrage du serveur sur http://localhost:3000"
echo "🧪 Testez l'API avec: curl http://localhost:3000/test-claude"
echo "📚 Documentation: MAPPING_AI_README.md"
echo ""

node index.js
