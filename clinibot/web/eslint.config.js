import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist", "coverage", "test-results", "playwright-report"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Event handlers may be async; React ignores the returned promise.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // Directional styling must use logical properties so RTL works.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/(^|\\s)(-?(ml|mr|pl|pr|left|right)-|text-(left|right)(\\s|$)|rounded-(l|r|tl|tr|bl|br)(-|\\s|$)|border-(l|r)(-|\\s|$))/]",
          message:
            "Use logical utilities (ms/me/ps/pe/start/end/text-start/rounded-s/border-s) so the layout works in RTL.",
        },
        {
          selector:
            "TemplateElement[value.raw=/(^|\\s)(-?(ml|mr|pl|pr|left|right)-|text-(left|right)(\\s|$)|rounded-(l|r|tl|tr|bl|br)(-|\\s|$)|border-(l|r)(-|\\s|$))/]",
          message:
            "Use logical utilities (ms/me/ps/pe/start/end/text-start/rounded-s/border-s) so the layout works in RTL.",
        },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/unbound-method": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
]);
