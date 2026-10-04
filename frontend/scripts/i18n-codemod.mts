/**
 * i18n codemod：把 frontend/src 中的中文文案包装为 t() 调用。
 *
 * 两阶段实现（避免 ts-morph 遍历中替换导致节点失效）：
 *  1) 解析收集所有替换目标（不修改 AST）
 *  2) 按位置倒序对源码文本做拼接，直接写回文件
 *
 * 规则：
 *  - 中文原文即翻译 key（见 src/i18n/index.tsx）
 *  - JSX 文本节点 → {t('...')}；JSX 字符串属性 → attr={t('...')}
 *  - 普通字符串字面量 → t('...')（保留原引号写法）
 *  - 跳过并记录复查清单：case 标签、与非常量的比较、对象下标、
 *    事件名/存储键/选择器参数、字符串处理方法参数、正则、类型位置、
 *    枚举成员、模板字符串插值片段、console.* 参数
 *  - 与中文字面量比较的中文字面量两侧同时包装，保持语义一致
 *  - 文件内已有名为 t 的绑定时改用别名 tI18n；已导入 i18n 的文件复用其别名
 *
 * 输出：
 *  - 覆盖写回源文件（幂等：已包装的 t(...) 不会再次包装）
 *  - scripts/i18n-keys.json    全部 key（去重排序）
 *  - scripts/i18n-review.json  人工复查清单 + 统计
 */
import { Project, SyntaxKind, ts, SyntaxKind as K } from 'ts-morph';
import fs from 'node:fs';

const ROOT = 'src';
const HAS_HAN = /[\u4e00-\u9fff]/;

const project = new Project({
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: false,
    allowJs: false,
  },
});

const files = project.addSourceFilesAtPaths([
  `${ROOT}/**/*.ts`,
  `${ROOT}/**/*.tsx`,
  `!${ROOT}/i18n/**`,
]);

interface Target {
  start: number;
  end: number;
  replacement: string;
  key: string;
}

const keys = new Set<string>();
const review = {
  comparisons: [] as string[],
  caseClauses: [] as string[],
  elementAccess: [] as string[],
  methodArgs: [] as string[],
  templates: [] as string[],
  enums: [] as string[],
  propValues: [] as string[],
  varInits: [] as string[],
};
const stats = { wrapped: 0, filesChanged: 0 };

function isHanStringLiteral(node: any): boolean {
  const k = node.getKind();
  return (
    (k === K.StringLiteral || k === K.NoSubstitutionTemplateLiteral) &&
    HAS_HAN.test(node.getText())
  );
}

function pos(node: any): string {
  const sf = node.getSourceFile();
  const { line } = sf.getLineAndColumnAtPos(node.getStart());
  const p = sf.getFilePath().replace(/^.*(frontend\/src\/)/, '');
  return `${p}:${line}`;
}

function fileAlias(sf: any): string {
  // 已导入 i18n 的文件：复用其别名（幂等重跑）
  for (const d of sf.getImportDeclarations()) {
    if (/i18n$/.test(d.getModuleSpecifierValue())) {
      for (const n of d.getNamedImports()) {
        if (n.getNameNode().getText() === 't') return n.getAliasNode()?.getText() ?? 't';
      }
    }
  }
  // 文件内存在名为 t 的绑定（变量/函数/参数/导入）时用别名
  for (const d of sf.getDescendants()) {
    if (
      d.getKind() === K.Identifier &&
      d.getText() === 't' &&
      [K.Parameter, K.VariableDeclarator, K.FunctionDeclaration, K.ImportSpecifier].includes(
        d.getParent().getKind(),
      )
    ) {
      return 'tI18n';
    }
  }
  return 't';
}

const SKIP_CALLEES =
  /^(Events\.(On|Once|Emit)|addEventListener|removeEventListener|querySelector|querySelectorAll|getElementById|getElementsByClassName|localStorage\.(getItem|setItem|removeItem|has)|sessionStorage\.(getItem|setItem|removeItem)|console\.(log|error|warn|info|debug|trace)|RegExp|fetch)$/;
const METHOD_NAMES = new Set([
  'includes', 'indexOf', 'lastIndexOf', 'startsWith', 'endsWith', 'match', 'matchAll',
  'replace', 'replaceAll', 'split', 'join', 'search', 'localeCompare',
]);

function calleeIsSkip(node: any): string | null {
  const call = node.getParent();
  if (!call || call.getKind() !== K.CallExpression) return null;
  const expr = call.getExpression();
  const text = expr?.getText?.() ?? '';
  if (SKIP_CALLEES.test(text)) return text;
  if (expr?.getKind?.() === K.PropertyAccessExpression && METHOD_NAMES.has(expr.getName?.())) {
    return text;
  }
  return null;
}

for (const sf of files) {
  const alias = fileAlias(sf);
  const targets: Target[] = [];
  let lastImportEnd = 0;
  let hasI18nImport = false;

  for (const d of sf.getImportDeclarations()) {
    lastImportEnd = Math.max(lastImportEnd, d.getEnd());
    if (/i18n$/.test(d.getModuleSpecifierValue())) hasI18nImport = true;
  }

  sf.forEachDescendant((node: any) => {
    const k = node.getKind();

    // ---------- JSX 文本 ----------
    if (k === K.JsxText) {
      const raw = node.getText();
      if (!HAS_HAN.test(raw)) return;
      const lead = raw.match(/^\s*/)?.[0] ?? '';
      const trail = raw.match(/\s*$/)?.[0] ?? '';
      const inner = raw.trim().replace(/\s+/g, ' ');
      if (!inner || !HAS_HAN.test(inner)) return;
      if (/^\{\s*t(I18n)?\(/.test(inner)) return; // 已包装（幂等）
      let lit: string;
      if (!inner.includes("'")) lit = `'${inner}'`;
      else if (!inner.includes('"')) lit = `"${inner}"`;
      else lit = `'${inner.replace(/'/g, "\\'")}'`;
      targets.push({
        start: node.getStart(),
        end: node.getEnd(),
        replacement: `${lead}{${alias}(${lit})}${trail}`,
        key: inner,
      });
      return;
    }

    // ---------- 字符串字面量 ----------
    if (!isHanStringLiteral(node)) return;

    // 属性名跳过
    const p = node.getParent();
    if (!p) return;
    if (
      [K.PropertyAssignment, K.PropertySignature, K.MethodSignature, K.MethodDeclaration,
       K.GetAccessor, K.SetAccessor].includes(p.getKind()) &&
      p.getNameNode?.() === node
    ) {
      return;
    }

    // 已包装（幂等）
    let anc = p;
    while (anc) {
      if (anc.getKind() === K.CallExpression) {
        const expr = anc.getExpression();
        if (expr?.getText?.() === 't' || expr?.getText?.() === 'tI18n') return;
      }
      anc = anc.getParent();
    }

    const pk = p.getKind();
    const raw = node.getText();
    const cookedKey: string = node.getLiteralText?.() ?? raw.slice(1, -1);

    // 类型位置 / 枚举成员：跳过
    if (pk === K.LiteralType) return;
    if (pk === K.EnumMember) {
      review.enums.push(pos(node));
      return;
    }

    // JSX 属性值：attr={t('...')}
    if (pk === K.JsxAttribute) {
      targets.push({ start: node.getStart(), end: node.getEnd(), replacement: `{${alias}(${raw})}`, key: cookedKey });
      return;
    }

    // switch case 标签：跳过
    if (pk === K.CaseClause || pk === K.CaseOrDefaultClause) {
      review.caseClauses.push(pos(node));
      return;
    }

    // 元素访问下标：跳过
    if (pk === K.ElementAccessExpression) {
      review.elementAccess.push(pos(node));
      return;
    }

    // 模板字符串插值片段：跳过（head/tail/middle）
    if ([K.TemplateHead, K.TemplateTail, K.TemplateMiddle].includes(pk)) {
      review.templates.push(pos(node));
      return;
    }

    // 比较：两侧均为中文字面量则同时包装；否则跳过待人工处理
    if (pk === K.BinaryExpression) {
      const op = p.getOperatorToken?.()?.getText?.() ?? '';
      if (['===', '!==', '==', '!='].includes(op)) {
        const other = p.getLeft() === node ? p.getRight() : p.getLeft();
        const otherIsHan =
          other &&
          (other.getKind() === K.StringLiteral || other.getKind() === K.NoSubstitutionTemplateLiteral) &&
          HAS_HAN.test(other.getText());
        if (otherIsHan) {
          targets.push({ start: node.getStart(), end: node.getEnd(), replacement: `${alias}(${raw})`, key: cookedKey });
        } else {
          review.comparisons.push(pos(node));
        }
        return;
      }
      targets.push({ start: node.getStart(), end: node.getEnd(), replacement: `${alias}(${raw})`, key: cookedKey });
      return;
    }

    // 调用参数：事件/存储/处理方法/正则/控制台跳过
    const skipCallee = calleeIsSkip(node);
    if (skipCallee) {
      if (!/^console\./.test(skipCallee)) {
        review.methodArgs.push(`${pos(node)}  [${skipCallee}]`);
      }
      return;
    }

    // 对象属性值 / 变量初始值：包装并记录
    const gp = p.getParent();
    if (pk === K.PropertyAssignment && gp) {
      review.propValues.push(`${pos(node)}  ${raw}`);
    } else if (pk === K.VariableDeclarator) {
      review.varInits.push(`${pos(node)}  ${raw}`);
    }

    targets.push({ start: node.getStart(), end: node.getEnd(), replacement: `${alias}(${raw})`, key: cookedKey });
  });

  if (targets.length === 0) continue;

  // ---- 阶段 2：倒序文本拼接 ----
  let text = sf.getFullText();
  targets.sort((a, b) => b.start - a.start);
  for (const tgt of targets) {
    text = text.slice(0, tgt.start) + tgt.replacement + text.slice(tgt.end);
    keys.add(tgt.key);
    stats.wrapped++;
  }

  if (!hasI18nImport) {
    const importLine = `\nimport { ${alias === 't' ? 't' : `t as ${alias}`} } from '@/i18n';`;
    text = text.slice(0, lastImportEnd) + importLine + text.slice(lastImportEnd);
  }

  fs.writeFileSync(sf.getFilePath(), text);
  stats.filesChanged++;
}

const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
fs.mkdirSync('scripts', { recursive: true });
fs.writeFileSync('scripts/i18n-keys.json', JSON.stringify(sortedKeys, null, 2));
fs.writeFileSync('scripts/i18n-review.json', JSON.stringify(review, null, 2));

console.log(`files changed: ${stats.filesChanged}`);
console.log(`strings wrapped: ${stats.wrapped}`);
console.log(`unique keys: ${sortedKeys.length}`);
for (const [k, v] of Object.entries(review)) {
  console.log(`review.${k}: ${(v as string[]).length}`);
}
