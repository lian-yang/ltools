/** 提取所有 t()/tI18n() 调用的字符串字面量 key，输出到 scripts/i18n-keys.json */
import { Project, SyntaxKind as K } from 'ts-morph';
import fs from 'node:fs';
const project = new Project({ compilerOptions: { jsx: (await import('ts-morph')).ts.JsxEmit.ReactJSX, target: 99, module: 99 } });
const files = project.addSourceFilesAtPaths(['src/**/*.ts', 'src/**/*.tsx', '!src/i18n/**']);
const keys = new Set<string>();
for (const sf of files) {
  sf.forEachDescendant((node: any) => {
    if (node.getKind() !== K.CallExpression) return;
    const expr = node.getExpression();
    const name = expr?.getText?.();
    if (name !== 't' && name !== 'tI18n') return;
    const arg = node.getArguments()[0];
    if (!arg) return;
    const k = arg.getKind();
    if (k === K.StringLiteral || k === K.NoSubstitutionTemplateLiteral) {
      keys.add(arg.getLiteralText());
    }
  });
}
const sorted = [...keys].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
fs.writeFileSync('scripts/i18n-keys.json', JSON.stringify(sorted, null, 2));
console.log('total keys:', sorted.length);
