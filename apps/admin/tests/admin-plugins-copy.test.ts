import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { pluginMessage, pluginMessages, type PluginLabel } from 'shared/src/i18n/messages/admin-plugins';

it('preserves approved board copy as identical UTF-8 bytes', () => {
  const board = Buffer.concat(['Plugins', 'PluginDetail'].map(name => readFileSync(resolve(__dirname, '../../../docs/design/admin/' + name + '.dc.html'))));
  const keys: PluginLabel[] = ['title', 'intro', 'upload', 'installed', 'market', 'removed', 'views', 'enabled', 'disabled', 'needsConfig', 'paused', 'manage', 'configure', 'view', 'listNote', 'marketNote', 'removedNote', 'back', 'config', 'configNote', 'secret', 'required', 'enableTitle', 'save', 'saved', 'dirty', 'discard', 'about', 'description', 'version', 'slug', 'signature', 'capabilities', 'capabilityNote', 'category', 'choose', 'drop', 'chooseNote', 'check', 'confirm', 'installing', 'done', 'backup', 'unsigned', 'unsignedWarning'];
  for (const key of keys) expect(board.includes(Buffer.from(pluginMessage('zh-Hans', key), 'utf8')), key).toBe(true);
  for (const key of ['latest', 'marketIncompatible', 'provision', 'categoryPayment'] as const) expect(board.includes(Buffer.from(pluginMessage('zh-Hans', key), 'utf8')), key).toBe(true);
  expect(board.includes(Buffer.from(pluginMessage('zh-Hans', 'marketUpdate', { version: '2.3.1' }), 'utf8'))).toBe(true);
  const messages = pluginMessages('zh-Hans');
  expect(board.includes(Buffer.from(messages.marketplace.incompatible, 'utf8'))).toBe(true);
  expect(board.includes(Buffer.from(messages.lifecycle.purge, 'utf8'))).toBe(true);
  expect(board.includes(Buffer.from(messages.lastRecordedError.historical, 'utf8'))).toBe(true);
  expect(board.includes(Buffer.from(messages.disableWarningTitle, 'utf8'))).toBe(true);
  const source = readFileSync(resolve(__dirname, '../../../docs/design/admin/PluginDetail.dc.html'), 'utf8').replace(/<[^>]+>/g, '');
  expect(Buffer.from(source, 'utf8').includes(Buffer.from(messages.disableWarning.replace('{count}', '3').replace('{name}', 'Stripe 付款'), 'utf8'))).toBe(true);
  const markup = board.toString('utf8').replace(/<[^>]+>/g, '');
  for (const text of [
    pluginMessage('zh-Hans', 'confirmSlug', { slug: 'sf-express' }),
    pluginMessage('zh-Hans', 'progress', { name: '顺丰物流', count: '1 / 2' }),
    pluginMessage('zh-Hans', 'doneNote', { name: '顺丰物流' }),
    pluginMessage('zh-Hans', 'missing', { count: 2, fields: '秘密密钥、Webhook 签名密钥' }),
  ]) expect(Buffer.from(markup, 'utf8').includes(Buffer.from(text, 'utf8'))).toBe(true);
});
