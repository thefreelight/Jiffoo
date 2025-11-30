/**
 * Backfill TenantDomain table from existing Tenant.domain and Tenant.subdomain
 * 
 * This script migrates existing domain configurations to the new TenantDomain model.
 * Run with: npx ts-node prisma/scripts/backfill-tenant-domains.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillTenantDomains() {
  console.log('🚀 Starting TenantDomain backfill...');

  // Get all tenants with domain or subdomain configured
  const tenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { domain: { not: null } },
        { subdomain: { not: null } }
      ]
    },
    select: {
      id: true,
      companyName: true,
      domain: true,
      subdomain: true
    }
  });

  console.log(`📊 Found ${tenants.length} tenants with domain configurations`);

  let created = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    console.log(`\n📦 Processing tenant ${tenant.id}: ${tenant.companyName}`);

    // Process custom domain (frontend)
    if (tenant.domain) {
      try {
        const existing = await prisma.tenantDomain.findFirst({
          where: {
            tenantId: tenant.id,
            host: tenant.domain,
            appType: 'frontend'
          }
        });

        if (!existing) {
          await prisma.tenantDomain.create({
            data: {
              tenantId: tenant.id,
              host: tenant.domain,
              appType: 'frontend',
              isCustom: true,
              isPrimary: true
            }
          });
          console.log(`  ✅ Created frontend domain: ${tenant.domain}`);
          created++;
        } else {
          console.log(`  ⏭️ Skipped existing frontend domain: ${tenant.domain}`);
          skipped++;
        }
      } catch (error) {
        console.error(`  ❌ Error creating domain ${tenant.domain}:`, error);
      }
    }

    // Process subdomain (platform subdomain - optional)
    // Note: Subdomain format is like "demo" and needs to be combined with platform domain
    // This is optional based on whether you want to use subdomains
    if (tenant.subdomain) {
      const platformDomain = process.env.PLATFORM_MAIN_DOMAIN || 'jiffoo.com';
      const subdomainHost = `${tenant.subdomain}.${platformDomain}`;

      try {
        const existing = await prisma.tenantDomain.findFirst({
          where: {
            tenantId: tenant.id,
            host: subdomainHost,
            appType: 'frontend'
          }
        });

        if (!existing) {
          await prisma.tenantDomain.create({
            data: {
              tenantId: tenant.id,
              host: subdomainHost,
              appType: 'frontend',
              isCustom: false, // Platform subdomain, not custom
              isPrimary: !tenant.domain // Primary only if no custom domain
            }
          });
          console.log(`  ✅ Created subdomain: ${subdomainHost}`);
          created++;
        } else {
          console.log(`  ⏭️ Skipped existing subdomain: ${subdomainHost}`);
          skipped++;
        }
      } catch (error) {
        console.error(`  ❌ Error creating subdomain ${subdomainHost}:`, error);
      }
    }
  }

  console.log('\n📊 Backfill Summary:');
  console.log(`  Created: ${created}`);
  console.log(`  Skipped: ${skipped}`);
  console.log('✅ Backfill completed!');
}

backfillTenantDomains()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

