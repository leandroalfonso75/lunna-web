// Config base do timeia, adaptada: sem `eslint-rules/` customizadas (o
// plugin `quality` e as regras que dependiam dele foram removidas) e sem
// `eslint.typed.config.mjs` (tier separado com type-checking, fora do
// escopo deste bloco).
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
      // js.configs.recommended liga no-undef, que não conhece o runtime do
      // projeto -- declara só o que o código de fato usa.
      globals: {
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    // tseslint.configs.strict liga estas duas em "error". Os clients HTTP
    // (`lib/*Client.ts`) tipam a função `api` recebida como
    // `(path, options?) => Promise<any>` de propósito -- cada método do
    // client já declara seu próprio retorno específico (`Promise<{company:
    // Company}>`, etc.), então o `any` fica isolado nesse único ponto de
    // fronteira em vez de se espalhar por toda chamada. `warn`, não "off":
    // um `any`/`!` novo em outro lugar do código ainda aparece no lint.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },
  // Vue é o único framework usado aqui (Nuxt 4 / Vue 3 SFCs) -- só o tier A
  // (provável bug), não o tier estilístico completo.
  ...pluginVue.configs["flat/essential"],
  {
    // vue-eslint-parser (usado pelo config do pluginVue acima) parseia
    // <script> com espree por padrão, que não entende TypeScript.
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    // O checker do TypeScript já reporta símbolos genuinamente indefinidos,
    // e os auto-imports do Nuxt (ref, useRoute, definePageMeta, ...) são
    // globais ambientes que o ESLint sozinho não enxerga.
    files: ["**/*.{ts,vue}"],
    rules: {
      "no-undef": "off",
    },
  },
  {
    plugins: { "import-x": importX },
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver()],
    },
    rules: {
      "import-x/no-unresolved": "error",
      "import-x/no-duplicates": "error",
    },
  },
  {
    // Fronteira de arquitetura (mesma do timeia): components/pages/layouts
    // recebem um client já construído via props/injeção -- nunca importam a
    // fábrica de `lib/` e constroem um sozinhos. Os pontos legítimos de
    // construção são `app/plugins/api.ts` (fora deste bloco).
    files: ["app/components/**/*.vue", "app/pages/**/*.vue", "app/layouts/**/*.vue"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/apiClient", "**/lib/authClient"],
              message:
                "Receba um client já construído via props/injeção em vez de importar a fábrica de lib/ direto aqui.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ["app/**/*.{ts,vue}", "server/**/*.ts", "*.ts"],
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-var": "error",
      "prefer-const": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Rotas por arquivo do Nuxt exigem nomes de uma palavra só (index.vue,
    // login.vue, cadastro.vue, ...) -- não é um componente registrado como
    // tag JSX-style, então vue/multi-word-component-names não se aplica.
    files: ["app/pages/**/*.vue", "app/layouts/**/*.vue", "app/error.vue"],
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
  globalIgnores([
    "node_modules/**",
    ".nuxt/**",
    ".output/**",
    ".nitro/**",
    ".cache/**",
    "dist/**",
    "**/*.tsbuildinfo",
    "package-lock.json",
  ]),
]);
