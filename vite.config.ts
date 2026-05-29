import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/*
 * Vite = dev server + bundler configuration.
 *
 * Angular porównanie:
 * - Angular CLI ukrywa większość konfiguracji w angular.json i builderach.
 * - Vite jest cieńszy: ten plik jawnie mówi, jakie pluginy obsługują Reacta,
 *   Tailwinda i testy.
 *
 * defineConfig nie jest magiczne runtime'owo. Daje lepsze typy i autocomplete
 * w edytorze, dzięki czemu literówki w konfiguracji szybciej wychodzą.
 */
export default defineConfig({
  /*
   * @vitejs/plugin-react:
   * - kompiluje JSX/TSX,
   * - włącza React Fast Refresh w dev serverze,
   * - obsługuje nowoczesny React transform.
   *
   * @tailwindcss/vite:
   * - integruje Tailwind CSS 4 z pipeline Vite.
   */
  plugins: [react(), tailwindcss()],
  /*
   * Vitest używa podobnego modelu do Jest, ale jest zbudowany pod Vite.
   * environment: 'node' jest OK dla testów domeny/store, które nie renderują DOM.
   * Gdybyśmy testowali komponenty React Testing Library, często wybralibyśmy jsdom.
   */
  test: {
    environment: 'node',
    /*
     * globals: true pozwala pisać describe/it/expect bez importowania ich w każdym teście.
     */
    globals: true,
  },
})
