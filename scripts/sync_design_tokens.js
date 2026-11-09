/**
 * Sync Design Tokens Extractor (CommonJS)
 * 
 * Extraheert EasyM2M ontwerptokens uit het native Tailwind CSS v4 `@theme` blok
 * in src/app/globals.css en synchroniseert deze naar DESIGN.md voor Google Stitch.
 */

/**
 * Extracts design tokens from a CSS string (specifically the native @theme block).
 * @param {string} cssContent
 * @returns {Array<{ name: string, value: string, category: string }>}
 */
function extractTokens(cssContent) {
  if (!cssContent || typeof cssContent !== 'string') return [];

  // Match the native @theme block while explicitly ignoring '@theme inline'
  const themeBlockMatch = cssContent.match(/(?:^|\s)@theme(?!\s+inline)\s*\{([\s\S]*?)\}/);
  if (!themeBlockMatch) return [];

  const blockBody = themeBlockMatch[1];
  const lines = blockBody.split(/\r?\n/);

  const tokens = [];
  let currentCategory = 'Algemeen';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for category comment: /* Category Name */
    const commentMatch = line.match(/^\/\*\s*(.*?)\s*\*\/$/);
    if (commentMatch) {
      currentCategory = commentMatch[1];
      continue;
    }

    // Check for token declaration: --var-name: value;
    const tokenMatch = line.match(/^(--[\w-]+)\s*:\s*([^;]+);/);
    if (tokenMatch) {
      const name = tokenMatch[1].trim();
      const value = tokenMatch[2].trim();
      tokens.push({
        name,
        value,
        category: currentCategory,
      });
    }
  }

  return tokens;
}

/**
 * Generates a markdown table from a list of tokens.
 * @param {Array<{ name: string, value: string, category: string }>} tokens
 * @returns {string}
 */
function generateMarkdownTable(tokens) {
  let md = '# Design Tokens\n\n';
  md += '> Geautomatiseerd gegenereerd voor Google Stitch en EasyM2M UI componenten via `scripts/sync_design_tokens.js`. Niet handmatig bewerken.\n\n';
  md += '| Token | Waarde | Categorie |\n';
  md += '| :--- | :--- | :--- |\n';

  if (!tokens || tokens.length === 0) {
    return md;
  }

  for (const token of tokens) {
    md += `| \`${token.name}\` | \`${token.value}\` | ${token.category} |\n`;
  }

  return md;
}

/**
 * Verifies if the target markdown text matches the tokens extracted from CSS.
 * Normalizes CRLF and whitespace to prevent OS line ending mismatches.
 * @param {string} cssContent
 * @param {string} markdownContent
 * @returns {boolean}
 */
function isSynced(cssContent, markdownContent) {
  if (!cssContent || typeof cssContent !== 'string') return false;
  if (!markdownContent || typeof markdownContent !== 'string') return false;

  const tokens = extractTokens(cssContent);
  const expectedMd = generateMarkdownTable(tokens);

  const normActual = markdownContent.replace(/\r\n/g, '\n').trim();
  const normExpected = expectedMd.replace(/\r\n/g, '\n').trim();

  return normActual === normExpected;
}

// CLI Execution entrypoint (isolated from module imports in unit tests)
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');

  const globalsCssPath = path.resolve(__dirname, '../src/app/globals.css');
  const designMdPath = path.resolve(__dirname, '../DESIGN.md');
  const checkOnly = process.argv.includes('--check');

  try {
    const cssContent = fs.readFileSync(globalsCssPath, 'utf8');

    if (checkOnly) {
      if (!fs.existsSync(designMdPath)) {
        console.error('[sync_design_tokens] [DRIFT_DETECTED] DESIGN.md does not exist. Run "npm run sync-tokens" to generate it.');
        process.exit(1);
      }
      const existingMd = fs.readFileSync(designMdPath, 'utf8');
      if (!isSynced(cssContent, existingMd)) {
        console.error('[sync_design_tokens] [DRIFT_DETECTED] DESIGN.md is out of sync with src/app/globals.css. Run "npm run sync-tokens" to update.');
        process.exit(1);
      }
      console.log('[sync_design_tokens] [PASS] DESIGN.md is in perfect sync with src/app/globals.css.');
      process.exit(0);
    } else {
      const tokens = extractTokens(cssContent);
      const markdown = generateMarkdownTable(tokens);
      fs.writeFileSync(designMdPath, markdown, 'utf8');
      console.log(`[sync_design_tokens] [PASS] Successfully synced ${tokens.length} tokens to ${designMdPath}`);
    }
  } catch (err) {
    console.error('[sync_design_tokens] [ERROR] Operation failed:', err.message);
    process.exit(1);
  }
}

module.exports = {
  extractTokens,
  generateMarkdownTable,
  isSynced,
};
