const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = process.cwd();
const libraryRoot = path.join(root, 'projects/ngx-page-builder');
const previewRoot = path.join(libraryRoot, 'preview');
const designerRoot = path.join(libraryRoot, 'designer');

const configPath = [path.join(libraryRoot, 'tsconfig.lib.json'), path.join(root, 'tsconfig.json')].find(fs.existsSync);

if (!configPath) {
  throw new Error('Architecture Guard: tsconfig not found.');
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

if (configFile.error) {
  throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
}

const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));

const compilerOptions = parsed.options;

function normalize(file) {
  return path.resolve(file).replace(/\\/g, '/').toLowerCase();
}

function isInside(file, directory) {
  const relative = path.relative(directory, file);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function getFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return getFiles(file);
    }

    return /\.(ts|html|scss|sass)$/.test(entry.name) && !/\.spec\.ts$|\.test\.ts$/.test(entry.name) ? [file] : [];
  });
}

const violations = [];
const visited = new Set();

function report(from, target) {
  violations.push({
    from: path.relative(root, from),
    target: path.relative(root, target),
  });
}

function inspectFile(file) {
  file = path.resolve(file);

  if (visited.has(file) || !fs.existsSync(file)) return;
  visited.add(file);

  const source = fs.readFileSync(file, 'utf8');

  // Detect explicit references to the Designer directory,
  // including SCSS references in Angular component metadata.
  const references = source.matchAll(/['"`]([^'"`]*(?:designer\/|designer\\)[^'"`]*)['"`]/gi);

  for (const match of references) {
    const reference = match[1];

    if (reference.startsWith('.')) {
      const resolved = path.resolve(path.dirname(file), reference);

      if (isInside(resolved, designerRoot)) {
        report(file, resolved);
      }
    } else if (/(?:^|\/)ngx-page-builder\/designer(?:\/|$)/i.test(reference)) {
      report(file, reference);
    }
  }

  if (!file.endsWith('.ts')) return;

  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);

  function visit(node) {
    let specifier;

    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifier = node.moduleSpecifier.text;
    }

    if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(sourceFile) === 'require')
    ) {
      specifier = node.arguments[0].text;
    }

    if (specifier) {
      if (/^ngx-page-builder\/designer(?:\/|$)/.test(specifier)) {
        report(file, specifier);
      } else {
        const result = ts.resolveModuleName(specifier, file, compilerOptions, ts.sys);

        const resolved = result.resolvedModule?.resolvedFileName;

        if (resolved) {
          const target = path.resolve(resolved);

          if (isInside(target, designerRoot)) {
            report(file, target);
          } else if (isInside(target, libraryRoot)) {
            inspectFile(target);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

for (const file of getFiles(previewRoot)) {
  inspectFile(file);
}

if (violations.length) {
  console.error('\nPreview → Designer dependency detected:\n');

  for (const item of violations) {
    console.error(`  ${item.from}`);
    console.error(`    → ${item.target}\n`);
  }

  console.error('Build blocked: Preview must not depend on Designer.');

  process.exit(1);
}

console.log('Architecture Guard: Preview boundary passed.');
