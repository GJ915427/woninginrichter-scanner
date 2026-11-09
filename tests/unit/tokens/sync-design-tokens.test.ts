import { describe, it, expect } from 'vitest';

// @ts-expect-error CommonJS module import
import { extractTokens, generateMarkdownTable, isSynced } from '../../../scripts/sync_design_tokens.js';

describe('sync_design_tokens', () => {
  describe('extractTokens', () => {
    it('extracts design tokens from a valid @theme block with category comments', () => {
      const sampleCss = `
@import 'tailwindcss';

:root {
  --background: #ffffff;
}

@theme {
  /* EasyM2M Merkidentiteit */
  --color-brand: #0a3875;
  --color-brand-hover: #072b5c;

  /* Neutrale Typografie */
  --color-neutral-dark: #222222;
}

@theme inline {
  --color-background: var(--background);
}
`;

      const tokens = extractTokens(sampleCss);
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toEqual({
        name: '--color-brand',
        value: '#0a3875',
        category: 'EasyM2M Merkidentiteit',
      });
      expect(tokens[1]).toEqual({
        name: '--color-brand-hover',
        value: '#072b5c',
        category: 'EasyM2M Merkidentiteit',
      });
      expect(tokens[2]).toEqual({
        name: '--color-neutral-dark',
        value: '#222222',
        category: 'Neutrale Typografie',
      });
    });

    it('returns an empty array when no @theme block exists or input is empty', () => {
      expect(extractTokens('')).toEqual([]);
      expect(extractTokens('body { margin: 0; }')).toEqual([]);
    });

    it('handles CRLF line endings on Windows correctly', () => {
      const crlfCss = "@theme {\r\n  /* Category Windows */\r\n  --color-test: #123456;\r\n}\r\n";
      const tokens = extractTokens(crlfCss);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({
        name: '--color-test',
        value: '#123456',
        category: 'Category Windows',
      });
    });
  });

  describe('generateMarkdownTable', () => {
    it('generates a valid markdown table from extracted tokens', () => {
      const tokens = [
        { name: '--color-brand', value: '#0a3875', category: 'Merkidentiteit' },
        { name: '--color-error', value: '#c13515', category: 'Status' },
      ];

      const md = generateMarkdownTable(tokens);
      expect(md).toContain('# Design Tokens');
      expect(md).toContain('| Token | Waarde | Categorie |');
      expect(md).toContain('| `--color-brand` | `#0a3875` | Merkidentiteit |');
      expect(md).toContain('| `--color-error` | `#c13515` | Status |');
    });

    it('generates an empty table header when token list is empty', () => {
      const md = generateMarkdownTable([]);
      expect(md).toContain('# Design Tokens');
      expect(md).toContain('| Token | Waarde | Categorie |');
    });
  });

  describe('isSynced', () => {
    it('returns true when markdown matches extracted tokens exactly', () => {
      const sampleCss = `@theme {\n  /* Brand */\n  --color-brand: #0a3875;\n}\n`;
      const tokens = extractTokens(sampleCss);
      const md = generateMarkdownTable(tokens);

      expect(isSynced(sampleCss, md)).toBe(true);
    });

    it('handles Windows CRLF and trailing newline differences gracefully', () => {
      const sampleCss = `@theme {\r\n  /* Brand */\r\n  --color-brand: #0a3875;\r\n}\r\n`;
      const tokens = extractTokens(sampleCss);
      const md = generateMarkdownTable(tokens).replace(/\n/g, '\r\n') + '\r\n';

      expect(isSynced(sampleCss, md)).toBe(true);
    });

    it('returns false when markdown has drifted or is missing a token', () => {
      const sampleCss = `@theme {\n  /* Brand */\n  --color-brand: #0a3875;\n}\n`;
      const staleMd = '# Design Tokens\n\n| Token | Waarde | Categorie |\n| :--- | :--- | :--- |\n| `--color-old` | `#ffffff` | Old |\n';

      expect(isSynced(sampleCss, staleMd)).toBe(false);
    });
  });
});
