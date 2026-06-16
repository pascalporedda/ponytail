#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const TRUSTED_REF = 'v4.6.0-snipki.1';
const RUNTIME_FILES = [
  '.opencode/plugins/ponytail.mjs',
  'pi-extension/index.js',
  'hooks/ponytail-activate.js',
  'hooks/ponytail-config.js',
  'hooks/ponytail-instructions.js',
  'hooks/ponytail-mode-tracker.js',
  'hooks/ponytail-runtime.js',
];
const FORBIDDEN_MODULES = [
  'child_process',
  'http',
  'https',
  'net',
  'tls',
  'dgram',
  'dns',
  'undici',
];
const FORBIDDEN_COMMAND_WORDS = /\b(curl|wget|nc|ncat|ssh|scp|python|python3|ruby|perl)\b/;

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJSON(relPath) {
  return JSON.parse(read(relPath));
}

test('agent marketplace installs this fork from a pinned ref', () => {
  const marketplace = readJSON('.agents/plugins/marketplace.json');
  const source = marketplace.plugins[0].source;

  assert.equal(source.url, 'https://github.com/pascalporedda/ponytail.git');
  assert.equal(source.ref, TRUSTED_REF);
  assert.notEqual(source.ref, 'main');
});

test('runtime files do not import subprocess or network modules', () => {
  const forbiddenImport = new RegExp(
    String.raw`(?:require\(|from\s+|import\()\s*['"](?:node:)?(${FORBIDDEN_MODULES.join('|')})['"]`
  );

  for (const relPath of RUNTIME_FILES) {
    assert.doesNotMatch(read(relPath), forbiddenImport, `${relPath} imports a forbidden module`);
  }
});

test('lifecycle hook commands only launch the checked-in node hooks', () => {
  const hookConfigs = [
    readJSON('hooks/hooks.json'),
    readJSON('hooks/copilot-hooks.json'),
  ];

  for (const config of hookConfigs) {
    for (const events of Object.values(config.hooks)) {
      for (const event of events) {
        const hooks = event.hooks || [event];
        for (const hook of hooks) {
          for (const command of [hook.command, hook.commandWindows, hook.bash, hook.powershell].filter(Boolean)) {
            assert.match(command, /\bnode\b/, `hook command must launch node: ${command}`);
            assert.match(command, /hooks[\\/](ponytail-activate|ponytail-mode-tracker)\.js/, `unexpected hook target: ${command}`);
            assert.doesNotMatch(command, FORBIDDEN_COMMAND_WORDS, `hook command contains a high-risk executable: ${command}`);
          }
        }
      }
    }
  }
});
