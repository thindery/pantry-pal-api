import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
});

async function cleanupStripeProducts() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('❌ No Stripe secret key configured (STRIPE_SECRET_KEY)');
    return;
  }

  try {
    // List all products
    console.log('Fetching Stripe products...');
    const products = await stripe.products.list({ limit: 100 });
    
    console.log(`Found ${products.data.length} total products`);
    
    // Group by name to find duplicates
    const productsByName: Record<string, Stripe.Product[]> = {};
    
    for (const product of products.data) {
      if (!productsByName[product.name]) {
        productsByName[product.name] = [];
      }
      productsByName[product.name].push(product);
    }
    
    // Find duplicates
    const duplicates: { name: string; products: Stripe.Product[] }[] = [];
    
    for (const [name, productList] of Object.entries(productsByName)) {
      if (productList.length > 1) {
        duplicates.push({ name, products: productList });
      }
    }
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate products found');
      return;
    }
    
    console.log(`\n⚠️ Found ${duplicates.length} product(s) with duplicates:\n`);
    
    let archivedCount = 0;
    let pricesArchivedCount = 0;
    
    for (const { name, products } of duplicates) {
      console.log(`${name}: ${products.length} instances`);
      
      // Keep the oldest one (created first), archive the rest
      const sorted = products.sort((a, b) => 
        new Date(a.created).getTime() - new Date(b.created).getTime()
      );
      
      const [keep, ...toArchive] = sorted;
      console.log(`  Keeping: ${keep.id} (created ${new Date(keep.created * 1000).toISOString()})`);
      
      for (const product of toArchive) {
        console.log(`\n  Processing: ${product.id} (created ${new Date(product.created * 1000).toISOString()})`);
        
        try {
          // Step 1: Get all prices for this product
          const prices = await stripe.prices.list({ product: product.id, limit: 100 });
          
          // Step 2: Archive all prices first
          for (const price of prices.data) {
            if (price.active) {
              await stripe.prices.update(price.id, { active: false });
              console.log(`    ✅ Archived price: ${price.id}`);
              pricesArchivedCount++;
            }
          }
          
          // Step 3: Archive the product (Stripe doesn't allow deleting products with prices)
          await stripe.products.update(product.id, { active: false });
          console.log(`    ✅ Archived product: ${product.id}`);
          archivedCount++;
        } catch (err: any) {
          console.error(`    ❌ Failed to archive ${product.id}: ${err.message}`);
        }
      }
    }
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`   - Archived ${archivedCount} duplicate product(s)`);
    console.log(`   - Archived ${pricesArchivedCount} price(s)`);
    console.log(`\nNote: Stripe doesn't allow deleting products with prices, so they were archived instead.`);
    
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  cleanupStripeProducts();
}