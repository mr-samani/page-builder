#!/usr/bin/env node
/**
 * fix-shared-imports.js
 *
 * - جستجوی بازگشتی در ریشه برای فایل‌های ts/tsx/js/jsx (قابل تنظیم)
 * - پیدا کردن importهایی که به پوشه‌ای با نام "shared" اشاره دارند (نسبی یا absolute)
 * - تبدیل مسیر آنها به "ngx-page-builder/core"
 * - ادغام همه importها از "ngx-page-builder/core" در یک (یا دو برای type/value)
 * - حذف تکراری‌ها
 *
 * Usage:
 *   node fix-shared-imports.js --root ../my-project --apply
 *   node fix-shared-imports.js --root ../my-project        # dry-run
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const recast = require('recast');
const tsParser = require('recast/parsers/typescript');
const minimist = require('minimist');

const args = minimist(process.argv.slice(2), {
  string: ['root', 'ext'],
  boolean: ['apply'],
  default: { root: '.', ext: 'ts,tsx,js,jsx', apply: false },
});

const ROOT = path.resolve(args.root || '../projects/ngx-page-builder');
const EXTS = (args.ext || 'ts,tsx,js,jsx').split(',').map((s) => s.trim());
const APPLY = !!args.apply;
const TARGET_MODULE = 'ngx-page-builder/core';

console.log(`🔎 root: ${ROOT}`);
console.log(`🔁 exts: ${EXTS.join(', ')}`);
console.log(`✍ apply changes: ${APPLY ? 'YES' : 'NO (dry-run)'}`);
console.log('---');

function shouldTransformSource(srcValue) {
  if (!srcValue || typeof srcValue !== 'string') return false;
  // شرط: مسیر شامل '/shared' به هر صورتی باشد (نسبی یا absolute)
  // اما اگر پیشاپیش به TARGET_MODULE اشاره دارد، نیاز به تغییر نیست
  if (srcValue === TARGET_MODULE) return false;
  // contains "/shared" or ends with "/shared" or "shared/..."
  return /(^|\/)shared(\/|$)/.test(srcValue);
}

function parseCodeToAst(code, filePath) {
  try {
    return recast.parse(code, {
      parser: tsParser,
    });
  } catch (err) {
    console.error(`❌ Failed to parse ${filePath}: ${err.message}`);
    return null;
  }
}

function buildImportSpecifiers(namedSet, defaultLocal, namespaceLocal, isType) {
  const b = recast.types.builders;
  const specs = [];

  // default import
  if (defaultLocal) {
    specs.push(b.importDefaultSpecifier(b.identifier(defaultLocal)));
  }

  // named imports
  const namedNames = Array.from(namedSet.keys()).sort();
  for (const importedName of namedNames) {
    const local = namedSet.get(importedName);
    if (importedName === local) {
      specs.push(b.importSpecifier(b.identifier(importedName)));
    } else {
      specs.push(b.importSpecifier(b.identifier(importedName), b.identifier(local)));
    }
  }

  // NOTE: namespace cannot be combined with named in a single import that keeps both as-is.
  // We'll prefer named imports if there are any named; otherwise keep namespace.
  if (!specs.length && namespaceLocal) {
    specs.push(b.importNamespaceSpecifier(b.identifier(namespaceLocal)));
  }

  // mark importKind (for types)
  if (isType && specs.length > 0) {
    specs.forEach((s) => (s.importKind = 'type'));
  }

  return specs;
}

function formatSpecifierKey(spec) {
  // unify key for set — include alias if any
  if (spec.type === 'ImportSpecifier') {
    const imported = spec.imported.name || spec.imported.value;
    const local = spec.local && spec.local.name;
    return `${imported}::${local || imported}::named::${spec.importKind || 'value'}`;
  }
  if (spec.type === 'ImportDefaultSpecifier') {
    return `default::${spec.local.name}`;
  }
  if (spec.type === 'ImportNamespaceSpecifier') {
    return `namespace::${spec.local.name}`;
  }
  return JSON.stringify(spec);
}

function processFile(filePath, applyChanges) {
  const code = fs.readFileSync(filePath, 'utf8');
  const ast = parseCodeToAst(code, filePath);
  if (!ast) return { changed: false };

  const b = recast.types.builders;
  const importNodes = [];
  const body = ast.program.body;

  // Gather import declarations to transform and their indices
  for (let i = 0; i < body.length; i++) {
    const node = body[i];
    if (node.type === 'ImportDeclaration') {
      importNodes.push({ node, index: i });
    }
  }

  // collect all imports that match 'shared' pattern
  const matched = [];
  for (const { node, index } of importNodes) {
    const srcValue = node.source && node.source.value;
    if (shouldTransformSource(srcValue)) {
      matched.push({ node, index });
    }
  }

  if (matched.length === 0) return { changed: false };

  // aggregate specifiers
  // We'll collect two classes: type-only specifiers and value specifiers
  const namedValue = new Map(); // importedName -> localName
  const namedType = new Map(); // importedName -> localName
  let defaultLocal = null;
  let namespaceLocal = null;
  let namespaceWasType = false;

  // order: keep index of first occurrence to place merged import there
  const firstIndex = Math.min(...matched.map((m) => m.index));

  for (const { node } of matched) {
    for (const s of node.specifiers || []) {
      if (s.type === 'ImportSpecifier') {
        const importedName = s.imported && (s.imported.name || s.imported.value);
        const localName = s.local && s.local.name ? s.local.name : importedName;
        const isType = s.importKind === 'type' || node.importKind === 'type';
        if (isType) {
          if (!namedType.has(importedName)) namedType.set(importedName, localName);
        } else {
          if (!namedValue.has(importedName)) namedValue.set(importedName, localName);
        }
      } else if (s.type === 'ImportDefaultSpecifier') {
        if (!defaultLocal) defaultLocal = s.local.name;
        // default imports are value imports (not type)
      } else if (s.type === 'ImportNamespaceSpecifier') {
        // If more than one namespace import with different locals, keep the first local.
        if (!namespaceLocal) {
          namespaceLocal = s.local.name;
          namespaceWasType = node.importKind === 'type';
        }
      }
    }
  }

  // If both namespace and namedValue exist, we choose to prefer namedValue (more explicit).
  // But we add a comment so developer can review.
  let addReviewComment = false;
  if (namespaceLocal && namedValue.size > 0) {
    addReviewComment = true;
    // prefer namedValue; drop namespaceLocal (can't keep both in one import)
    namespaceLocal = null;
  }

  // Build new import declarations:
  //  - one for value imports (if any)
  //  - one for type-only imports (if any)
  const newImports = [];

  // value import
  const valueSpecifiers = buildImportSpecifiers(namedValue, defaultLocal, namespaceLocal, false);
  if (valueSpecifiers.length > 0) {
    const imp = b.importDeclaration(valueSpecifiers, b.stringLiteral(TARGET_MODULE));
    newImports.push(imp);
  }

  // type-only import
  const typeSpecifiers = buildImportSpecifiers(namedType, null, null, true);
  if (typeSpecifiers.length > 0) {
    const impType = b.importDeclaration(typeSpecifiers, b.stringLiteral(TARGET_MODULE));
    impType.importKind = 'type';
    newImports.push(impType);
  }

  // If there were only namespace import(s) and we removed them earlier and no named imports
  // then namespaceLocal might be present and valueSpecifiers could be empty; handle that:
  if (!valueSpecifiers.length && namespaceLocal && !namedValue.size) {
    const nsImp = b.importDeclaration(
      [b.importNamespaceSpecifier(b.identifier(namespaceLocal))],
      b.stringLiteral(TARGET_MODULE),
    );
    newImports.unshift(nsImp);
  }

  // Remove original matched import nodes from AST body
  // We remove by setting to null and then filtering to preserve indices relocation
  const removedIndices = matched.map((m) => m.index).sort((a, b) => b - a); // remove from end to start
  for (const idx of removedIndices) {
    body.splice(idx, 1);
  }

  // Insert new import(s) at firstIndex
  body.splice(firstIndex, 0, ...newImports);

  // Optionally add a top-of-file comment if we did conflict resolution
  if (addReviewComment) {
    const comment = recast.types.builders.commentLine(
      ' REVIEW: namespace import from shared merged into named imports — please verify usages (ns.X -> X if necessary)',
      true,
      false,
    );
    // attach comment to the first new import
    if (newImports.length > 0) {
      if (!newImports[0].leadingComments) newImports[0].leadingComments = [];
      newImports[0].leadingComments.push(comment);
    } else {
      // fallback: prepend a line comment to file
      ast.program.body.unshift(b.noop());
      if (!ast.program.body[0].leadingComments) ast.program.body[0].leadingComments = [];
      ast.program.body[0].leadingComments.push(comment);
    }
  }

  // print new code
  const output = recast.print(ast).code;

  if (applyChanges) {
    // backup original file
    // fs.writeFileSync(filePath + '.bak', code, 'utf8'); // optional
    fs.writeFileSync(filePath, output, 'utf8');
    console.log(`✅ Updated: ${filePath}`);
  } else {
    console.log(`(dry) would update: ${filePath}`);
  }

  return { changed: true };
}

// find files
function findFiles(root, exts) {
  const patterns = exts.map((ext) => `**/*.${ext}`);
  const ignore = ['**/node_modules/**', '**/dist/**', '**/out/**', '**/.git/**'];
  const files = new Set();
  for (const p of patterns) {
    const matches = glob.sync(p, { cwd: root, absolute: true, nodir: true, ignore });
    matches.forEach((m) => files.add(m));
  }
  return Array.from(files);
}

function main() {
  const files = findFiles(ROOT, EXTS);
  console.log(`Found ${files.length} files to scan.`);

  let changedCount = 0;
  for (const f of files) {
    try {
      const res = processFile(f, APPLY);
      if (res.changed) changedCount++;
    } catch (err) {
      console.error(`Error processing ${f}: ${err.stack || err}`);
    }
  }
  console.log('---');
  console.log(`Scanned ${files.length} files. Files to change: ${changedCount}`);
  if (!APPLY) {
    console.log('No files were modified (dry-run). Rerun with --apply to write changes.');
  }
}

main();
