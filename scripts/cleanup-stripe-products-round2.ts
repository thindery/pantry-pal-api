import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
});

async function getAllProducts(): Promise<Stripe.Product[]> {
  const allProducts: Stripe.Product[] = [];
  let hasMore = true;
  let startingAfter: string | undefined = undefined;

  console.log('Fetching ALL Stripe products with auto-pagination...');

  while (hasMore) {
    const params: Stripe.ProductListParams = { 
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {})
    };
    
    const response = await stripe.products.list(params);
    allProducts.push(...response.data);
    
    hasMore = response.has_more;
    if (hasMore && response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
    
    console.log(`  Fetched ${response.data.length} products (total: ${allProducts.length})`);
  }

  return allProducts;
}

async function cleanupStripeProducts() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('❌ No Stripe secret key configured (STRIPE_SECRET_KEY)');
    return;
  }

  try {
    // Get ALL products with auto-pagination
    const allProducts = await getAllProducts();
    console.log(`\n📊 Found ${allProducts.length} total products\n`);

    // Filter for products with "PantryPal" in the name (any form)
    const pantryPalProducts = allProducts.filter(p => 
      p.name.toLowerCase().includes('pantrypal') ||
      p.name.toLowerCase().includes('pantry') ||
      p.name.toLowerCase().includes('meal') // might have renamed ones
    );

    console.log(`🍽️ Products containing "Pantry", "PantryPal", or "Meal" in name: ${pantryPalProducts.length}\n`);

    // Sort by creation date (newest first)
    const sortedProducts = pantryPalProducts.sort((a, b) => 
      (b.created as number) - (a.created as number)
    );

    console.log('Product list (sorted by newest first):');
    sortedProducts.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} (${p.id}) - ${p.active ? 'ACTIVE' : 'archived'} - Created: ${new Date(p.created * 1000).toISOString()}`);
    });

    if (sortedProducts.length <= 2) {
      console.log('\n✅ Only found 2 or fewer relevant products. Nothing to archive.');
      console.log(`Final count: ${sortedProducts.filter(p => p.active).length} active`);
      return;
    }

    // Keep the 2 newest active products, archive the rest
    const [keep1, keep2, ...toArchive] = sortedProducts;
    
    console.log(`\n📝 Action Plan:`);
    console.log(`  KEEP (1): ${keep1.name} (${keep1.id}) - Created ${new Date(keep1.created * 1000).toISOString()}`);
    if (keep2) {
      console.log(`  KEEP (2): ${keep2.name} (${keep2.id}) - Created ${new Date(keep2.created * 1000).toISOString()}`);
    }
    console.log(`  ARCHIVE: ${toArchive.length} products\n`);

    let archivedCount = 0;
    let pricesArchivedCount = 0;
    let errors: string[] = [];

    for (const product of toArchive) {
      // Skip already archived products
      if (!product.active) {
        console.log(`  ⏭️  ${product.id} already archived, skipping`);
        continue;
      }

      console.log(`  🗂️  Archiving: ${product.name} (${product.id})...`);
      
      try {
        // Step 1: Get all prices for this product
        const prices = await stripe.prices.list({ product: product.id, limit: 100 });
        
        // Step 2: Archive all active prices first
        for (const price of prices.data) {
          if (price.active) {
            await stripe.prices.update(price.id, { active: false });
            console.log(`      ✅ Archived price: ${price.id}`);
            pricesArchivedCount++;
          }
        }
        
        // Step 3: Archive the product
        await stripe.products.update(product.id, { active: false });
        console.log(`      ✅ Archived product: ${product.id}`);
        archivedCount++;
      } catch (err: any) {
        console.error(`      ❌ Failed to archive ${product.id}: ${err.message}`);
        errors.push(`${product.id}: ${err.message}`);
      }
    }

    // Final report
    console.log(`\n📋 CLEANUP REPORT`);
    console.log(`================`);
    console.log(`  Total products found:         ${allProducts.length}`);
    console.log(`  PantryPal-related products:    ${pantryPalProducts.length}`);
    console.log(`  Products KEPT (active):        2`);
    console.log(`  Products ARCHIVED:             ${archivedCount}`);
    console.log(`  Prices archived:               ${pricesArchivedCount}`);
    console.log(`  Already archived (skipped):    ${toArchive.length - archivedCount}`);
    console.log(`  Errors:                        ${errors.length}`);
    
    if (errors.length > 0) {
      console.log(`\n  Errors encountered:`);
      errors.forEach(e => console.log(`    - ${e}`));
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`\n💡 REMINDER: Check Stripe Dashboard to verify only 2 products remain active.`);
    console.log(`   Expected final active count: 2`);
    
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  cleanupStripeProducts();
}
