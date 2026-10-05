import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".agents/**",
    "scripts/**",
    "tests/**",
    "android/**",
    "archive/**",
    "doc_review_app/**",
    "gronsvelds_archief/**",
    "postcss.config.mjs",
    "*.js",
    "*.cjs",
    "*.py",
  ]),
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/set-state-in-effect": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
]);

export default eslintConfig;
