import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    // OpenNext/Cloudflare build artifacts (generated):
    ".open-next/**",
    "next-env.d.ts",
  ]),
  // Strategic overrides:
  // - Keep app code strict.
  // - Allow tests to use `any` without blocking MVP.
  // - Allow scripts to use CommonJS `require()` (Node scripts are often CJS).
  // - Downgrade overly-aggressive hook rule to warning (don't block shipping).
  {
    files: ["**/*.{test,spec}.ts", "**/*.{test,spec}.tsx", "tests/**/*.ts", "tests/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
