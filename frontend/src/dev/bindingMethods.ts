import ts from 'typescript';

export function bindingMethodNames(sources: Record<string, string>): Map<number, string> {
  const names = new Map<number, string>();
  for (const [indexPath, indexSource] of Object.entries(sources)) {
    if (!indexPath.endsWith('/index.ts')) continue;
    const directory = indexPath.slice(0, indexPath.lastIndexOf('/'));
    const packageName = directory.slice(directory.indexOf('/bindings/') + '/bindings/'.length);
    const index = ts.createSourceFile(indexPath, indexSource, ts.ScriptTarget.Latest, true);
    for (const statement of index.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const namespace = statement.importClause?.namedBindings;
      if (!namespace || !ts.isNamespaceImport(namespace)) continue;
      const path = `${directory}/${statement.moduleSpecifier.text.replace(/^\.\//, '').replace(/\.js$/, '.ts')}`;
      const source = sources[path];
      if (!source) continue;
      const service = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
      for (const method of service.statements) {
        if (!ts.isFunctionDeclaration(method) || !method.name || !method.body) continue;
        const visit = (node: ts.Node) => {
          if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
            && node.expression.name.text === 'ByID' && node.arguments[0] && ts.isNumericLiteral(node.arguments[0])) {
            names.set(Number(node.arguments[0].text), `${packageName}.${namespace.name.text}.${method.name!.text}`);
          }
          ts.forEachChild(node, visit);
        };
        visit(method.body);
      }
    }
  }
  return names;
}
