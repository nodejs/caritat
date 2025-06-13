import js from "@eslint/js";
import tsPlugin from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

export default [
  js.configs.recommended,
  ...tsPlugin.configs.recommended,
  stylistic.configs.customize({
    braceStyle: "1tbs",
    quotes: "double",
    quoteProps: "as-needed",
    semi: true,
  }),
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsPlugin.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin.plugin,
      "@stylistic": stylistic,
    },
  },
  { ignores: ["node_modules/", "**/dist/"] },
];
