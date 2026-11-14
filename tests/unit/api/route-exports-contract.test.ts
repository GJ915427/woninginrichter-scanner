import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';

const ALLOWED_RUNTIME_EXPORTS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'config',
  'dynamic',
  'dynamicParams',
  'revalidate',
  'fetchCache',
  'runtime',
  'preferredRegion',
  'maxDuration',
  'generateStaticParams',
  'unstable_instant',
  'unstable_dynamicStaleTime'
]);

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(fullPath));
    } else if (entry.isFile() && entry.name === 'route.ts') {
      results.push(fullPath);
    }
  }
  return results;
}

interface Violation {
  file: string;
  message: string;
}

function checkRouteFile(filePath: string, rootDir: string): Violation[] {
  const violations: Violation[] = [];
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const sourceCode = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );

  const isDynamicRoute = relPath.includes('[') && relPath.includes(']');

  function checkSecondParam(funcDecl: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression, handlerName: string) {
    if (!isDynamicRoute) return;
    const params = funcDecl.parameters;
    if (params.length < 2) return;

    const secondParam = params[1];
    const typeNode = secondParam.type;

    if (!typeNode) {
      violations.push({
        file: relPath,
        message: `HTTP handler '${handlerName}' 2nd parameter ontbreekt een strikt type contract (moet Promise<...> zijn).`
      });
      return;
    }

    // Check if typeNode is a union type (e.g. Promise<{ id: string }> | { id: string })
    if (ts.isUnionTypeNode(typeNode)) {
      violations.push({
        file: relPath,
        message: `HTTP handler '${handlerName}' 2nd parameter mag geen UnionType zijn met niet-Promise types: ${typeNode.getText(sourceFile)}`
      });
      return;
    }

    // If typeNode is a TypeReference, check if it references Promise
    if (ts.isTypeReferenceNode(typeNode)) {
      const typeName = typeNode.typeName.getText(sourceFile);
      if (typeName !== 'Promise') {
        violations.push({
          file: relPath,
          message: `HTTP handler '${handlerName}' 2nd parameter '${secondParam.getText(sourceFile)}' moet Promise<...> zijn, maar is ${typeName}.`
        });
      }
      return;
    }

    // If typeNode is a TypeLiteral (e.g. { params: Promise<{ id: string }> | ... })
    if (ts.isTypeLiteralNode(typeNode)) {
      for (const member of typeNode.members) {
        if (ts.isPropertySignature(member) && member.name.getText(sourceFile) === 'params' && member.type) {
          if (ts.isUnionTypeNode(member.type)) {
            violations.push({
              file: relPath,
              message: `HTTP handler '${handlerName}' context.params mag geen UnionType zijn in Next.js 16: ${member.type.getText(sourceFile)}`
            });
          } else if (ts.isTypeReferenceNode(member.type)) {
            const refName = member.type.typeName.getText(sourceFile);
            if (refName !== 'Promise') {
              violations.push({
                file: relPath,
                message: `HTTP handler '${handlerName}' context.params moet Promise<...> zijn, maar is ${refName}.`
              });
            }
          }
        }
      }
    }
  }

  for (const statement of sourceFile.statements) {
    // 1. Export default (ExportAssignment) is forbidden in route.ts
    if (ts.isExportAssignment(statement)) {
      violations.push({
        file: relPath,
        message: `export default is verboden in App Router route.ts handlers.`
      });
      continue;
    }

    // 2. Export * without clause is forbidden
    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) {
        violations.push({
          file: relPath,
          message: `export * is verboden in App Router route.ts handlers.`
        });
        continue;
      }

      // Check if export declaration is type-only: export type { ... }
      if (statement.isTypeOnly) {
        continue;
      }

      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          if (element.isTypeOnly) {
            continue;
          }
          const exportedName = element.name.text;
          if (!ALLOWED_RUNTIME_EXPORTS.has(exportedName)) {
            violations.push({
              file: relPath,
              message: `Niet-toegestane runtime named re-export: '${exportedName}'. Alleen HTTP handlers of Next.js route segment configs zijn toegestaan.`
            });
          }
        }
      }
      continue;
    }

    // Check modifiers for export
    const hasExport = statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!hasExport) continue;

    // Type-only statements are allowed
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      continue;
    }

    // Function Declaration
    if (ts.isFunctionDeclaration(statement)) {
      const funcName = statement.name?.text || '';
      if (!ALLOWED_RUNTIME_EXPORTS.has(funcName)) {
        violations.push({
          file: relPath,
          message: `Niet-toegestane runtime export functie: '${funcName}'. Alleen HTTP handlers of route configs zijn toegestaan.`
        });
      } else {
        checkSecondParam(statement, funcName);
      }
      continue;
    }

    // Variable Statement (const / let / var)
    if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        const varName = decl.name.getText(sourceFile);
        if (!ALLOWED_RUNTIME_EXPORTS.has(varName)) {
          violations.push({
            file: relPath,
            message: `Niet-toegestane runtime export variabele/const: '${varName}'. Verplaats helpers naar lib/ of domein-modules.`
          });
        } else if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
          checkSecondParam(decl.initializer, varName);
        }
      }
      continue;
    }

    // Class Declaration is forbidden as export in route.ts
    if (ts.isClassDeclaration(statement)) {
      const className = statement.name?.text || 'AnonymousClass';
      violations.push({
        file: relPath,
        message: `export class '${className}' is verboden in App Router route.ts handlers.`
      });
    }
  }

  return violations;
}

describe('App Router Route Contract AST Invariant (INV-GOV-21A / Next.js 16)', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const appDir = path.join(rootDir, 'src/app');
  const routeFiles = findRouteFiles(appDir);

  it('moet minimaal 1 route.ts bestand vinden in src/app', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it('alle route.ts bestanden moeten strikt voldoen aan Next.js 16 route exports en async params', () => {
    const allViolations: Violation[] = [];
    for (const routeFile of routeFiles) {
      const violations = checkRouteFile(routeFile, rootDir);
      allViolations.push(...violations);
    }

    if (allViolations.length > 0) {
      const formatted = allViolations
        .map(v => `  - ${v.file}: ${v.message}`)
        .join('\n');
      expect.fail(`Gevonden overtredingen op Next.js 16 Route Handler contract:\n${formatted}`);
    }
  });
});
