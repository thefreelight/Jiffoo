import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const require = createRequire('/app/apps/api/package.json');
const { Client } = require('pg');
assert.equal(new URL(process.env.DATABASE_URL).pathname, '/jiffoo_core_test');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const mode = process.argv[2];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function objectClient() {
  const { S3Client } = require('@aws-sdk/client-s3');
  return new S3Client({ endpoint: process.env.UPLOAD_S3_ENDPOINT, region: process.env.UPLOAD_S3_REGION, forcePathStyle: true,
    credentials: { accessKeyId: process.env.UPLOAD_S3_ACCESS_KEY_ID, secretAccessKey: process.env.UPLOAD_S3_SECRET_ACCESS_KEY }, requestChecksumCalculation:'WHEN_REQUIRED', responseChecksumValidation:'WHEN_REQUIRED' });
}
async function pluginArchive(version, sqls) {
  const { issuePublisherCertificate, signPackage, CERT_PATH, SIGNATURE_PATH } = require('shared/plugin-signing');
  const keys = JSON.parse(readFileSync('/app/deploy/compose/update-fixture-keys.json','utf8'));
  const manifest = { schemaVersion:1,slug:'update-probe',name:'Update probe',version,description:'Update acceptance fixture',category:'integration',runtimeType:'internal-fastify',hostProtocol:'internal-fastify-v1',entryModule:'index.js',permissions:[],contracts:[],
    database:{apiVersion:1,migrations:sqls.map((sql,index)=>({id:'step-'+(index+1),order:index+1,path:'migrations/00'+(index+1)+'.sql',sha256:digest(sql)}))} };
  const files = [{path:'manifest.json',content:Buffer.from(JSON.stringify(manifest))},{path:'index.js',content:Buffer.from('module.exports = { register() {} };')}];
  sqls.forEach((sql,index)=>files.push({path:'migrations/00'+(index+1)+'.sql',content:Buffer.from(sql)}));
  files.push({path:CERT_PATH,content:Buffer.from(JSON.stringify(issuePublisherCertificate('update-publisher','Update publisher',keys.publisher.publicKey,keys.root.privateKey)))});
  files.sort((a,b)=>Buffer.compare(Buffer.from(a.path),Buffer.from(b.path)));
  files.push({path:SIGNATURE_PATH,content:Buffer.from(JSON.stringify(signPackage(files.map(file=>({path:file.path,sha256:digest(file.content)})),keys.publisher.privateKey)))});
  const zip = require('archiver')('zip'),chunks=[];
  const done=new Promise((resolve,reject)=>{zip.on('data',chunk=>chunks.push(chunk));zip.once('end',resolve);zip.once('error',reject);});
  for(const file of files)zip.append(file.content,{name:file.path});
  await zip.finalize();await done;return Buffer.concat(chunks);
}
try {
  await client.connect();
  if (mode === 'managed') {
    const result = {};
    for (const [table, filter] of [
      ['plugin_installs', "WHERE source='builtin'"], ['plugin_installations', "WHERE \"pluginSlug\" IN (SELECT slug FROM public.plugin_installs WHERE source='builtin')"],
      ['plugin_event_subscriptions', "WHERE \"pluginSlug\" IN (SELECT slug FROM public.plugin_installs WHERE source='builtin')"], ['plugin_package_blobs', "WHERE \"pluginSlug\" IN (SELECT slug FROM public.plugin_installs WHERE source='builtin')"],
      ['themes', "WHERE source='builtin'"], ['theme_configurations', ''], ['theme_config_revisions', ''], ['theme_package_blobs', ''], ['theme_active', ''],
    ]) {
      const rows = (await client.query(`SELECT row_to_json(t)::text AS row FROM public."${table}" t ${filter}`)).rows.map(row => row.row).sort();
      result[table] = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    }
    result.registry = (await client.query('SELECT "pluginRegistryVersion" FROM public.system_settings WHERE id=$1', ['system'])).rows[0].pluginRegistryVersion;
    result.pluginVersion = (await client.query('SELECT version FROM public.plugin_installs WHERE slug=$1', ['free-shipping'])).rows[0].version;
    result.themeVersion = (await client.query('SELECT version FROM public.themes WHERE slug=$1', ['default-shop'])).rows[0].version;
    console.info('UPDATE_MANAGED ' + JSON.stringify(result));
  } else if (mode === 'configure') {
    const password = process.argv[3];
    const login = await fetch('http://api-1:3001/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'update-owner@example.test', password, surface: 'admin' }) });
    assert.equal(login.status, 200);
    const token = (await login.json()).data.access_token;
    const response = await fetch('http://api-1:3001/api/v1/extensions/themes/default-shop/config', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ expectedRevision: 0, values: {} }) });
    assert.equal(response.status, 200, await response.text());
    const sqls=['CREATE TABLE records (id integer PRIMARY KEY,value text NOT NULL); INSERT INTO records VALUES (1,\'before-update\');',"UPDATE records SET value='after-update' WHERE id=1;"];
    const bytes=await pluginArchive('1.0.0',sqls.slice(0,1));
    const form=fields=>{const form=new FormData();for(const [key,value]of Object.entries(fields))form.set(key,value);form.set('file',new Blob([bytes],{type:'application/zip'}),'probe.zip');return form;};
    const upload=async(route,fields)=>{const result=await fetch('http://api-1:3001/api/v1/extensions/plugin/'+route,{method:'POST',headers:{authorization:'Bearer '+token},body:form(fields)});assert.ok(result.ok,await result.clone().text());return(await result.json()).data;};
    const preview=await upload('preview',{}), operation=await upload('install',{previewToken:preview.previewToken,confirmMigrations:'true'});
    const deadline=Date.now()+60000;
    for(;;){const result=await fetch('http://api-1:3001/api/v1/extensions/plugin/operations/'+operation.operationId+'?wait=true',{headers:{authorization:'Bearer '+token}});assert.equal(result.status,200);const state=(await result.json()).data;if(state.terminal){assert.equal(state.phase,'SUCCESS');break;}assert.ok(Date.now()<deadline);}
    const objects=objectClient();try {const {PutObjectCommand}=require('@aws-sdk/client-s3');await objects.send(new PutObjectCommand({Bucket:process.env.UPLOAD_S3_BUCKET,Key:'b16c2-proof.txt',Body:'before-update-object'}));}finally{objects.destroy();}
    const actor=(await client.query('SELECT id FROM public.users WHERE email=$1',['update-owner@example.test'])).rows[0].id;
    console.info('UPDATE_FIXTURE '+JSON.stringify({actor,package:(await pluginArchive('1.1.0',sqls)).toString('base64')}));
  } else if (mode === 'migration-proof') {
    const namespace=(await client.query('SELECT id,"schemaName" FROM public.plugin_namespaces WHERE slug=$1',['update-probe'])).rows[0];assert.match(namespace.schemaName,/^plugin_[a-z0-9_]+$/);
    const result={coreHistory:(await client.query('SELECT id,migration_name,checksum FROM public._prisma_migrations ORDER BY migration_name')).rows,pluginLedger:(await client.query('SELECT "order",sha256,"migrationId" FROM public.plugin_migration_successes WHERE "namespaceId"=$1 ORDER BY "order"',[namespace.id])).rows,
      pluginRows:(await client.query('SELECT * FROM "'+namespace.schemaName+'".records ORDER BY id')).rows,
      coreExists:(await client.query("SELECT to_regclass('public.b16c2_update_probe') IS NOT NULL AS present")).rows[0].present,
      owner:(await client.query('SELECT id,email FROM public.users WHERE email=$1',['update-owner@example.test'])).rows};
    if(result.coreExists)result.coreRows=(await client.query('SELECT * FROM public.b16c2_update_probe ORDER BY id')).rows;
    const objects=objectClient();try{const {GetObjectCommand}=require('@aws-sdk/client-s3');const object=await objects.send(new GetObjectCommand({Bucket:process.env.UPLOAD_S3_BUCKET,Key:'b16c2-proof.txt'}));result.objectHash=digest(Buffer.from(await object.Body.transformToByteArray()));}finally{objects.destroy();}
    console.info('UPDATE_PROOF '+JSON.stringify(result));
  } else if (mode === 'corrupt') {
    const kind=process.argv[3];
    if(kind==='core-checksum')await client.query("UPDATE public._prisma_migrations SET checksum=repeat('f',64) WHERE migration_name=$1",[JSON.parse(process.argv[4]).name]);
    else if(kind==='core-prefix')await client.query('UPDATE public._prisma_migrations SET migration_name=$1 WHERE migration_name=$2',['99999999999999_extra',JSON.parse(process.argv[4]).name]);
    else if(kind==='core-reset'){const data=JSON.parse(process.argv[4]);await client.query('UPDATE public._prisma_migrations SET migration_name=$1,checksum=$2 WHERE id=$3',[data.name,data.checksum,data.id]);}
    else if(kind==='plugin-ledger')await client.query("UPDATE public.plugin_migration_successes SET sha256=repeat('f',64) WHERE \"namespaceId\"=(SELECT id FROM public.plugin_namespaces WHERE slug='update-probe')");
    else if(kind==='plugin-reset')await client.query('UPDATE public.plugin_migration_successes SET sha256=$1 WHERE "namespaceId"=(SELECT id FROM public.plugin_namespaces WHERE slug=\'update-probe\')',[process.argv[4]]);
    else throw new Error('Unknown corruption fixture');
  } else if (mode === 'mutate-object') {
    const objects=objectClient();try{const {PutObjectCommand}=require('@aws-sdk/client-s3');await objects.send(new PutObjectCommand({Bucket:process.env.UPLOAD_S3_BUCKET,Key:'b16c2-proof.txt',Body:'after-update-object'}));}finally{objects.destroy();}
  } else throw new Error('Unknown update fixture mode');
} finally { await client.end(); }
