const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { Module } = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const { mkdtempSync, writeFileSync, readFileSync: readBytes, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
const file = path.resolve(__dirname, '../src/private-key-material.ts');
const loaded = new Module(file);
loaded.filename = file;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { containsPrivateKeyMaterial: detects } = loaded.exports;
const bytes = text => Buffer.from(text);

test('rejects generated PKCS8, RSA, EC and encrypted PEM material', () => {
  const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey;
  const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
  for (const [key, type] of [[rsa, 'pkcs8'], [rsa, 'pkcs1'], [ec, 'sec1']]) {
    const pem = key.export({ format: 'pem', type }).toString();
    assert.equal(detects(bytes(pem)), true);
    assert.equal(detects(bytes(JSON.stringify({ privateKey: pem }))), true);
    assert.equal(detects(bytes(pem.replace(/\n/g, '\r\n'))), true);
  }
  for (const type of ['pkcs8', 'pkcs1']) {
    assert.equal(detects(bytes(rsa.export({ format: 'pem', type, cipher: 'aes-256-cbc', passphrase: 'local-fixture-only' }))), true);
  }
});

test('rejects a complete OpenSSH block and keeps the format constants usable', () => {
  const body = Buffer.alloc(64, 7).toString('base64');
  assert.equal(detects(bytes(`-----BEGIN OPENSSH PRIVATE KEY-----\n${body}\n-----END OPENSSH PRIVATE KEY-----`)), true);
  assert.equal(detects(bytes("const header = '-----BEGIN PRIVATE KEY-----';\nconst footer = '-----END PRIVATE KEY-----';\nreturn pem.slice(header.length, -footer.length);")), false);
  assert.equal(detects(bytes('-----BEGIN PRIVATE KEY-----')), false);
  assert.equal(detects(bytes('-----END PRIVATE KEY-----')), false);
  assert.equal(detects(bytes('-----BEGIN PRIVATE KEY-----\nBASE64_PRIVATE_KEY\n-----END PRIVATE KEY-----')), false);
});

test('does not reject public key material or ordinary package bytes', () => {
  const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey;
  assert.equal(detects(bytes(key.export({ format: 'pem', type: 'spki' }))), false);
  assert.equal(detects(bytes('module.exports = { register(ctx) {} };')), false);
});

test('built CLI packs parser constants and rejects raw or escaped private material', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sdk-pem-material-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const cli = path.resolve(__dirname, '../dist/cli.js');
  const output = path.join(directory, 'result.zip');
  writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, slug: 'pem-check', name: 'PEM Check', version: '0.0.1', category: 'integration', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'index.js', permissions: [] }));
  const execute = () => spawnSync(process.execPath, [cli, 'pack', '--input', directory, '--output', output], { encoding: 'utf8', windowsHide: true });
  writeFileSync(path.join(directory, 'index.js'), "const header='-----BEGIN PRIVATE KEY-----';const footer='-----END PRIVATE KEY-----';module.exports={register(ctx){}};");
  assert.equal(execute().status, 0);
  rmSync(output);
  const pem = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  writeFileSync(path.join(directory, 'secret.pem'), pem);
  assert.equal(execute().status, 0);
  assert.equal(readBytes(output).includes(Buffer.from('secret.pem')), false);
  rmSync(output);
  for (const material of [pem, JSON.stringify({ privateKey: pem })]) {
    writeFileSync(path.join(directory, 'index.js'), material);
    const result = execute();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PRIVATE_KEY_MATERIAL/);
  }
});
