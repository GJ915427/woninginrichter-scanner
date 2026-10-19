import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Configurator Architectural Isolation & Zero Cross-Contamination', () => {
  const configuratorDirs = [
    path.resolve(process.cwd(), 'src/app/configurator'),
    path.resolve(process.cwd(), 'src/components/configurator'),
    path.resolve(process.cwd(), 'src/domain/configurator')
  ];

  const forbiddenImportPatterns = [
    /from\s+['"].*legacy.*['"]/,
    /from\s+['"].*GoogleMapCanvas.*['"]/,
    /from\s+['"].*FloorplanOverlay.*['"]/,
    /from\s+['"].*cityjson.*['"]/,
    /from\s+['"].*pdok.*['"]/,
    /from\s+['"].*bag.*['"]/,
    /from\s+['"].*ep-online.*['"]/,
    /from\s+['"].*funda.*['"]/,
    /from\s+['"].*collinear-simplifier.*['"]/,
    /from\s+['"].*polygon-simplifier.*['"]/
  ];

  function getAllTsxFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(getAllTsxFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('INV-ISO-01: Configurator codebase must have ZERO imports from 3D CAD, GIS or Maps modules', () => {
    const allConfiguratorFiles = configuratorDirs.flatMap(getAllTsxFiles);
    expect(allConfiguratorFiles.length).toBeGreaterThan(5);

    const violations: { file: string; line: string }[] = [];

    for (const file of allConfiguratorFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (line.trim().startsWith('import') || line.trim().startsWith('export * from')) {
          for (const pattern of forbiddenImportPatterns) {
            if (pattern.test(line)) {
              violations.push({
                file: path.relative(process.cwd(), file),
                line: line.trim()
              });
            }
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('INV-ISO-02: Configurator route page must not reference legacy GIS or 3D Map components', () => {
    const pagePath = path.resolve(process.cwd(), 'src/app/configurator/page.tsx');
    expect(fs.existsSync(pagePath)).toBe(true);

    const content = fs.readFileSync(pagePath, 'utf-8');
    expect(content).not.toContain('GoogleMapCanvas');
    expect(content).not.toContain('FloorplanOverlay');
    expect(content).not.toContain('LegacyPlaceSidebar');
    expect(content).not.toContain('useMapTilePreloader');
  });

  it('INV-ISO-03: Conclaaf Rules Engine must remain a pure domain engine with 0 GIS dependencies', () => {
    const enginePath = path.resolve(process.cwd(), 'src/domain/configurator/conclaaf-rules-engine.ts');
    expect(fs.existsSync(enginePath)).toBe(true);

    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).not.toContain('RDNAP');
    expect(content).not.toContain('coordinates');
    expect(content).not.toContain('Point2D');
  });
});
