import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/*
 * ESLint = statyczny "reviewer" kodu.
 *
 * Angular porównanie:
 * - Angular CLI też odpala lint/build/test jako osobne kroki.
 * - W React/Vite częściej składasz toolchain sam: ESLint + TypeScript + Vite.
 *
 * Ten plik używa "flat config" ESLinta. To nowszy format konfiguracji:
 * zamiast .eslintrc z dziedziczeniem po stringach mamy zwykły moduł JS.
 * Rekrutacyjnie warto umieć powiedzieć: lint łapie klasy błędów wcześniej
 * niż runtime, np. nieużywane zmienne, złamane rules of hooks, niepoprawny
 * hot reload boundary.
 */
export default defineConfig([
  /*
   * dist/ jest wynikiem builda. Nie lintujemy wygenerowanego kodu, tak samo
   * jak w Angularze nie lintujesz katalogu dist aplikacji.
   */
  globalIgnores(['dist']),
  {
    /*
     * Lint dotyczy plików TypeScript i TSX.
     * .tsx = TypeScript + JSX, czyli składnia komponentów Reacta.
     */
    files: ['**/*.{ts,tsx}'],
    extends: [
      /*
       * Podstawowe reguły JS: np. no-undef, podejrzane konstrukcje itd.
       */
      js.configs.recommended,
      /*
       * TypeScript-aware linting. TypeScript sprawdza typy, ESLint sprawdza styl
       * i pułapki. Te narzędzia się uzupełniają.
       */
      tseslint.configs.recommended,
      /*
       * Hooks mają twarde reguły:
       * - wołaj hooki tylko na top-levelu komponentu/custom hooka,
       * - nie wołaj ich warunkowo ani w pętli.
       *
       * Angular porównanie:
       * - Angular ma DI/lifecycle hooks jako metody klas.
       * - React hooks są zwykłymi funkcjami, więc linter pilnuje kolejności wywołań.
       */
      reactHooks.configs.flat.recommended,
      /*
       * React Refresh = szybki hot reload komponentów podczas `npm run dev`.
       * Reguła pilnuje, żeby pliki eksportujące komponenty były kompatybilne
       * z odświeżaniem bez utraty stanu.
       */
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      /*
       * Ten kod działa w przeglądarce, więc globalne obiekty typu window,
       * document, FileReader czy localStorage są legalne.
       */
      globals: globals.browser,
    },
  },
])
