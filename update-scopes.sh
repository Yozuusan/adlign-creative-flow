#!/bin/bash

# 🚀 Script de mise à jour des scopes Shopify pour Adlign
# Usage: ./update-scopes.sh

echo "🔮 Mise à jour des scopes Shopify - Vision Long Terme Adlign"
echo "=========================================================="

# Configuration des scopes complets
COMPLETE_SCOPES="read_products,write_products,read_metaobjects,write_metaobjects,read_themes,write_themes,write_metaobject_definitions,read_theme_assets,write_theme_assets,read_analytics,read_reports,read_orders,write_orders,read_cart,write_cart,read_customers,write_customers,read_customer_tags,write_customer_tags,read_collections,write_collections,read_product_tags,write_product_tags,read_apps,write_apps,read_app_extensions,write_app_extensions,read_redirects,write_redirects,read_pages,write_pages,read_blog_posts,write_blog_posts,read_discounts,write_discounts,read_price_rules,write_price_rules,read_users,write_users,read_roles,write_roles"

# Scopes actuels (minimum requis)
CURRENT_SCOPES="read_products,write_products,read_metaobjects,write_metaobjects,read_themes,write_themes,write_metaobject_definitions"

echo ""
echo "📋 Scopes actuels (minimum requis) :"
echo "$CURRENT_SCOPES"
echo ""
echo "🚀 Scopes complets (vision long terme) :"
echo "$COMPLETE_SCOPES"
echo ""

# Vérifier si le fichier .env existe
if [ ! -f .env ]; then
    echo "❌ Fichier .env non trouvé"
    echo "📝 Créez le fichier .env avec la configuration suivante :"
    echo ""
    echo "SHOPIFY_API_KEY=votre-api-key"
    echo "SHOPIFY_API_SECRET=votre-api-secret"
    echo "SHOPIFY_SCOPES=$COMPLETE_SCOPES"
    echo "CLAUDE_API_KEY=votre-clé-claude"
    echo ""
    exit 1
fi

# Mettre à jour le fichier .env
echo "🔄 Mise à jour du fichier .env..."
if grep -q "SHOPIFY_SCOPES" .env; then
    # Remplacer la ligne existante
    sed -i '' "s/SHOPIFY_SCOPES=.*/SHOPIFY_SCOPES=$COMPLETE_SCOPES/" .env
    echo "✅ Scopes mis à jour dans .env"
else
    # Ajouter la ligne si elle n'existe pas
    echo "SHOPIFY_SCOPES=$COMPLETE_SCOPES" >> .env
    echo "✅ Scopes ajoutés dans .env"
fi

echo ""
echo "🎯 Étapes suivantes :"
echo "1. Mettez à jour les scopes dans votre app Shopify Partner"
echo "2. Réinstallez l'app sur votre boutique test"
echo "3. Testez les nouvelles fonctionnalités"
echo ""
echo "📚 Documentation :"
echo "- Scopes détaillés : SHOPIFY_SCOPES_COMPLETE.md"
echo "- Installation : INSTALLATION.md"
echo ""

# Afficher les scopes par catégorie
echo "📊 Répartition des scopes par catégorie :"
echo ""

echo "🛍️ Produits et Metaobjects :"
echo "  - read_products, write_products"
echo "  - read_metaobjects, write_metaobjects"
echo "  - write_metaobject_definitions"
echo ""

echo "🎨 Thèmes et Assets :"
echo "  - read_themes, write_themes"
echo "  - read_theme_assets, write_theme_assets"
echo ""

echo "📊 Analytics et Performance :"
echo "  - read_analytics, read_reports"
echo ""

echo "🛒 Commandes et Panier :"
echo "  - read_orders, write_orders"
echo "  - read_cart, write_cart"
echo ""

echo "👥 Clients et Segmentation :"
echo "  - read_customers, write_customers"
echo "  - read_customer_tags, write_customer_tags"
echo ""

echo "🏷️ Collections et Organisation :"
echo "  - read_collections, write_collections"
echo "  - read_product_tags, write_product_tags"
echo ""

echo "📱 Apps et Extensions :"
echo "  - read_apps, write_apps"
echo "  - read_app_extensions, write_app_extensions"
echo ""

echo "🔗 URLs et Redirections :"
echo "  - read_redirects, write_redirects"
echo ""

echo "📝 Contenu Marketing :"
echo "  - read_pages, write_pages"
echo "  - read_blog_posts, write_blog_posts"
echo ""

echo "🎯 Promotions et Discounts :"
echo "  - read_discounts, write_discounts"
echo "  - read_price_rules, write_price_rules"
echo ""

echo "🔐 Gestion des Permissions :"
echo "  - read_users, write_users"
echo "  - read_roles, write_roles"
echo ""

echo ""
echo "✅ Configuration terminée !"
echo "🚀 Prêt pour le développement long terme d'Adlign"
