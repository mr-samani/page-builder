import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

function addDependencies(tree: Tree, context: SchematicContext): void {
  const dependencies = [
    { name: 'ngx-drag-drop-kit', version: '^4.0.3' },
    { name: 'ngx-kit', version: '^7.4.0' },
  ];

  const packageJsonPath = '/package.json';
  if (!tree.exists(packageJsonPath)) {
    context.logger.error('package.json not found');
    return;
  }

  const packageJsonBuffer = tree.read(packageJsonPath);
  if (!packageJsonBuffer) {
    return;
  }

  const packageJson = JSON.parse(packageJsonBuffer.toString());

  dependencies.forEach((dep) => {
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    if (!packageJson.dependencies[dep.name]) {
      packageJson.dependencies[dep.name] = dep.version;
      context.logger.info(`✅ Added ${dep.name}@${dep.version}`);
    } else {
      context.logger.info(`ℹ️ ${dep.name} already exists, skipped`);
    }
  });

  tree.overwrite(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // بعد از تغییر package.json دستور نصب اجرا میشه
  context.addTask(new NodePackageInstallTask());
}

export function ngAdd(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    addDependencies(tree, context);
    return tree;
  };
}
