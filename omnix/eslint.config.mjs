import next from "eslint-config-next";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...next,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "worker/**", "mobile/**", ".models/**", ".storage/**", "next-env.d.ts"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
  {
    files: ["scripts/**", "e2e/**", "tests/**"],
    rules: { "no-console": "off" },
  },
];

export default config;
