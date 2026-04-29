import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      ".vercel/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules (type-aware where possible)
  ...tseslint.configs.recommended,

  // Client-side (React + browser)
  {
    files: ["client/src/**/*.{ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // React
      "react/jsx-uses-react": "off",     // Not needed w/ React 19 JSX transform
      "react/react-in-jsx-scope": "off",  // Not needed w/ React 19 JSX transform
      "react/prop-types": "off",          // TypeScript handles this

      // React Hooks — critical
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // TypeScript adjustments for React patterns
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },

  // Server-side (Node)
  {
    files: ["server/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Shared code
  {
    files: ["shared/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
    },
  },

  // Config files (vite, drizzle, etc.)
  {
    files: ["*.config.ts", "*.config.js", "drizzle.config.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  }
);
