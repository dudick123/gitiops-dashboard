module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:security/recommended-legacy",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: ["./tsconfig.json"],
  },
  plugins: ["@typescript-eslint", "react", "react-hooks", "jsx-a11y", "security", "import"],
  rules: {
    "react/no-danger": "error",
    "react/prop-types": "off",
    "import/order": [
      "error",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        alphabetize: { order: "asc" },
      },
    ],
    "import/no-default-export": "error",
  },
  settings: {
    react: { version: "detect" },
    "import/resolver": { typescript: true, node: true },
  },
  overrides: [
    {
      files: ["vite.config.ts", "tailwind.config.ts", "postcss.config.js"],
      rules: { "import/no-default-export": "off" },
    },
  ],
};
