import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '../..');
const require = createRequire(`${root}/apps/api/package.json`);
const { Client } = require('pg');
const { validateDatabaseUrl } = createRequire(import.meta.url)('../lane-config.cjs');
const batch = 'coreadmin-20261104-v1';
const url = process.env.DATABASE_URL_TEST;
validateDatabaseUrl(url);
assert.equal(new URL(url).pathname, '/jiffoo_core_test');
const mode = process.argv[2] || '--dry-run';
assert.ok(['--dry-run', '--apply', '--cleanup-dry-run'].includes(mode));
const output = process.argv[3];
assert.ok(output, 'An explicit JSON output path is required');
const tables = ['categories', 'users', 'products', 'product_variants', 'orders', 'order_items', 'order_status_history', 'notifications', 'admin_staff_audit_logs'];
const client = new Client({ connectionString: url, password: process.env.PGPASSWORD });
await client.connect();
try {
  assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'jiffoo_core_test');
  assert.equal((await client.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()')).rows[0].n, 0, 'Other database connections exist');
  const directory = `${root}/apps/api/prisma/migrations`;
  const names = readdirSync(directory, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => x.name).sort();
  const history = (await client.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name')).rows;
  assert.equal(history.length, names.length, 'STOP: migration count drift');
  names.forEach((name, i) => {
    assert.equal(history[i].migration_name, name);
    assert.ok(history[i].finished_at && !history[i].rolled_back_at);
    assert.equal(history[i].checksum, createHash('sha256').update(readFileSync(`${directory}/${name}/migration.sql`)).digest('hex'));
  });
  const diff = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-url', url, '--to-schema-datamodel', 'prisma/schema', '--exit-code'], { cwd: `${root}/apps/api`, encoding: 'utf8', windowsHide: true });
  assert.equal(diff.status, 0, `STOP: schema drift or check failure: ${diff.stdout} ${diff.stderr}`);
  const counts = async () => {
    const result = {};
    for (const table of tables) result[table] = (await client.query(`SELECT count(*)::int AS total,count(*) FILTER (WHERE id LIKE $1)::int AS batch FROM "${table}"`, [`${batch}-%`])).rows[0];
    return result;
  };
  const report = { batch, mode, database: 'jiffoo_core_test', startedAt: new Date().toISOString(), before: await counts(), targets: { products: 100000, variants: 200000, orders: 100000, customers: 20000, staff: 30, categories: 200, notifications: 20000, audit: 20000 }, limitations: ['Staff are inactive and cannot log in', 'Notifications are SENT fixtures only', 'Orders cover unpaid pending and cancelled states only', 'No shipping addresses, payment records or provider effects are generated'], cleanupSql: tables.toReversed().map(table => `DELETE FROM "${table}" WHERE id LIKE '${batch}-%';`) };
  if (mode === '--apply') {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query('SELECT pg_advisory_xact_lock(834727419)');
    const insert = async sql => client.query(sql.replaceAll('@B@', batch));
    await insert(`INSERT INTO categories(id,name,slug,level,"sortOrder","updatedAt") SELECT '@B@-c-'||n,'@B@ '||CASE WHEN n=200 THEN 'Empty' ELSE 'Category '||n END,'@B@-c-'||n,1,n,now() FROM generate_series(1,200)n ON CONFLICT DO NOTHING`);
    await insert(`INSERT INTO users(id,email,username,password,role,"isActive","emailVerified","updatedAt") SELECT '@B@-u-'||n,'@B@-'||n||'@example.invalid','@B@ Customer '||n,'!synthetic-no-login','USER',n%7<>0,true,now() FROM generate_series(1,20000)n ON CONFLICT DO NOTHING`);
    await insert(`INSERT INTO users(id,email,username,password,role,"isActive","updatedAt") SELECT '@B@-s-'||n,'@B@-staff-'||n||'@example.invalid','@B@ Staff '||n,'!synthetic-no-login','ADMIN',false,now() FROM generate_series(1,30)n ON CONFLICT DO NOTHING`);
    await insert(`INSERT INTO products(id,name,"spuCode",slug,description,"isActive","categoryId","createdAt","updatedAt") SELECT '@B@-p-'||n,'@B@ '||CASE WHEN n<=100 THEN 'ordinary' ELSE 'large' END||' Product '||n||CASE WHEN n%1000=0 THEN repeat(' Long field',25) ELSE '' END,'@B@-SPU-'||n,'@B@-p-'||n,'Synthetic catalog fixture',n%5<>0,'@B@-c-'||CASE WHEN n<=100 THEN 1 ELSE 2+(n%198) END,timestamp '2026-01-01'+n*interval '1 minute',now() FROM generate_series(1,100000)n ON CONFLICT DO NOTHING`);
    await insert(`INSERT INTO product_variants(id,"productId",name,"salePrice",stock,"skuCode","sortOrder","updatedAt") SELECT '@B@-v-'||n,'@B@-p-'||((n+1)/2),'Variant '||CASE WHEN n%2=0 THEN 'B' ELSE 'A' END,10+(n%100),CASE WHEN n%13=0 THEN 0 ELSE 100 END,'@B@-SKU-'||n,n%2,now() FROM generate_series(1,200000)n ON CONFLICT DO NOTHING`);
    await insert(`INSERT INTO orders(id,order_number,"userId",status,"paymentStatus","subtotalAmount","totalAmount","customerEmail","cancelReason","cancelledAt","createdAt","updatedAt") SELECT '@B@-o-'||n,'@B@-ORDER-'||n,'@B@-u-'||(1+n%20000),CASE WHEN n%3=0 THEN 'CANCELLED' ELSE 'PENDING' END::"OrderStatus",'PENDING',10+((n*2-1)%100),10+((n*2-1)%100),'@B@-'||(1+n%20000)||'@example.invalid',CASE WHEN n%3=0 THEN 'Synthetic cancellation' END,CASE WHEN n%3=0 THEN timestamp '2026-06-01' END,timestamp '2026-01-01'+n*interval '1 minute',now() FROM generate_series(1,100000)n ON CONFLICT DO NOTHING`);
    await insert(`INSERT INTO order_items(id,"orderId","productId","variantId",quantity,"unitPrice","lineTotal","catalogSnapshot") SELECT '@B@-i-'||n,'@B@-o-'||n,p.id,v.id,1,v."salePrice",v."salePrice",jsonb_build_object('source','order-time','productId',p.id,'variantId',v.id,'productName',p.name,'variantName',v.name,'skuCode',v."skuCode",'variantAttributes',null,'productType','physical','productTypeData',null,'productImages','[]'::jsonb,'productTranslations','{}'::jsonb) FROM generate_series(1,100000)n JOIN products p ON p.id='@B@-p-'||n JOIN product_variants v ON v.id='@B@-v-'||(n*2-1) ON CONFLICT DO NOTHING`);
    await insert(`INSERT INTO order_status_history(id,"orderId","toStatus","toPaymentStatus",reason,"actorType") SELECT '@B@-h-'||n,id,status,"paymentStatus",'Synthetic initial state','SYSTEM' FROM orders, LATERAL (SELECT substring(id from '@B@-o-([0-9]+)') AS n)q WHERE id LIKE '@B@-o-%' ON CONFLICT DO NOTHING`);
    await insert(`INSERT INTO notifications(id,type,channel,"recipientUserId","toAddress",locale,subject,html,text,status,"sentAt","updatedAt") SELECT '@B@-n-'||n,'synthetic','email','@B@-u-'||n,'@B@-'||n||'@example.invalid','en','@B@ Notification '||n,'<p>Synthetic fixture</p>','Synthetic fixture','SENT',now(),now() FROM generate_series(1,20000)n ON CONFLICT DO NOTHING`);
    await insert(`INSERT INTO admin_staff_audit_logs(id,"staffUserId","staffEmail",action,metadata) SELECT '@B@-a-'||n,'@B@-s-'||(1+n%30),'@B@-staff-'||(1+n%30)||'@example.invalid','STAFF_UPDATED',jsonb_build_object('syntheticBatch','@B@') FROM generate_series(1,20000)n ON CONFLICT DO NOTHING`);
    report.integrity = (await client.query(`SELECT count(*)::int AS mismatched_orders FROM orders o LEFT JOIN (SELECT "orderId",sum("lineTotal") AS total FROM order_items GROUP BY "orderId")i ON i."orderId"=o.id WHERE o.id LIKE $1 AND (i.total IS NULL OR i.total<>o."totalAmount")`, [`${batch}-%`])).rows[0];
    assert.equal(report.integrity.mismatched_orders, 0);
    const expected = [200, 20030, 100000, 200000, 100000, 100000, 100000, 20000, 20000];
    const actual = await counts();
    tables.forEach((table, index) => assert.equal(actual[table].batch, expected[index], `Unexpected batch count: ${table}`));
    report.integrity.relationships = (await client.query(`SELECT (SELECT count(*)::int FROM (SELECT p.id FROM products p LEFT JOIN product_variants v ON v."productId"=p.id WHERE p.id LIKE $1 GROUP BY p.id HAVING count(v.id)<>2)q) AS invalid_products,(SELECT count(*)::int FROM (SELECT o.id FROM orders o LEFT JOIN order_items i ON i."orderId"=o.id WHERE o.id LIKE $1 GROUP BY o.id HAVING count(i.id)<>1)q) AS invalid_orders`, [`${batch}-%`])).rows[0];
    assert.equal(report.integrity.relationships.invalid_products, 0);
    assert.equal(report.integrity.relationships.invalid_orders, 0);
    await client.query('COMMIT');
  }
  report.cleanupPlan = { executable: false, mode: 'dry-run only', expectedDatabase: 'jiffoo_core_test', batch, requiredGuards: ['Validate local URL with lane-config and current_database() exact match', 'Refuse active services and other database connections', 'Check all incoming foreign keys for non-batch references including cascade and SET NULL relations', 'Abort on external references; never delete or modify non-batch data', 'Execute reviewed batch-only deletion in one transaction with row-count assertions'], deletionOrder: tables.toReversed() };
  delete report.cleanupSql;
  report.after = await counts();
  report.finishedAt = new Date().toISOString();
  writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
finally { await client.end(); }
