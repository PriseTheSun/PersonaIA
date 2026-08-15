import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const resourcePath = new URL('../apps/web/src/i18n/resources.ts', import.meta.url);
const source = await readFile(resourcePath, 'utf8');
const match = source.match(/export const resources = (\{[\s\S]*\}) as const;/);
assert.ok(match, 'não foi possível extrair o objeto de traduções');
const resources = vm.runInNewContext(`(${match[1]})`, Object.create(null), {
  timeout: 1_000,
  displayErrors: true
});

function leaves(value, prefix = '', result = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      leaves(child, path, result);
    } else {
      result.set(path, child);
    }
  }
  return result;
}

function interpolationTokens(message) {
  return [...String(message).matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)]
    .map((item) => item[1])
    .sort();
}

const locales = ['pt-BR', 'es', 'en'];
const translations = Object.fromEntries(
  locales.map((locale) => [locale, leaves(resources[locale]?.translation ?? {})])
);
const referenceKeys = [...translations['pt-BR'].keys()].sort();

test('i18n: pt-BR, es e en possuem exatamente as mesmas chaves', () => {
  for (const locale of locales.slice(1)) {
    assert.deepEqual(
      [...translations[locale].keys()].sort(),
      referenceKeys,
      `${locale} diverge do catálogo pt-BR`
    );
  }
});

test('i18n: placeholders são equivalentes nos três idiomas', () => {
  for (const key of referenceKeys) {
    const expected = interpolationTokens(translations['pt-BR'].get(key));
    for (const locale of locales.slice(1)) {
      assert.deepEqual(
        interpolationTokens(translations[locale].get(key)),
        expected,
        `${locale}:${key} possui placeholders divergentes`
      );
    }
  }
});

test('i18n: nenhuma tradução é vazia ou expõe a própria chave', () => {
  for (const locale of locales) {
    for (const [key, value] of translations[locale]) {
      assert.equal(typeof value, 'string', `${locale}:${key} precisa ser string`);
      assert.ok(value.trim(), `${locale}:${key} está vazia`);
      assert.notEqual(value, key, `${locale}:${key} expõe a chave crua`);
    }
  }
});

test('i18n: vocabulário multicliente crítico está traduzido', () => {
  const requiredKeys = [
    'roles.SUPER_ADMIN',
    'roles.CLIENT_ADMIN',
    'roles.WORKSPACE_ADMIN',
    'roles.WORKSPACE_MEMBER',
    'common.pending_approval',
    'common.removed',
    'nav.workspaces',
    'nav.personas',
    'nav.questionnaires',
    'permissions.allow',
    'permissions.deny',
    'permissions.inherit',
    'permissions.projectOverride'
  ];
  for (const locale of locales) {
    for (const key of requiredKeys) {
      assert.ok(translations[locale].has(key), `${locale} não possui ${key}`);
    }
  }
});
