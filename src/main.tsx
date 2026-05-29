import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/*
 * Entry point Reacta.
 *
 * Angular porównanie:
 * - Angular: main.ts robi platformBrowserDynamic().bootstrapModule(AppModule)
 *   albo bootstrapApplication(AppComponent).
 * - React: createRoot(...) mówi Reactowi, który element DOM ma przejąć,
 *   a render(<App />) wskazuje pierwszy komponent drzewa.
 */
createRoot(document.getElementById('root')!).render(
  /*
   * StrictMode działa tylko w development.
   * Pomaga wykrywać nieczyste efekty i przestarzałe API. React może np. odpalić
   * pewne ścieżki podwójnie w dev, żeby znaleźć side effecty.
   *
   * Rekrutacyjnie:
   * Jeśli useEffect "odpala się dwa razy" w dev, często winny jest StrictMode,
   * a rozwiązaniem nie jest wyłączenie go, tylko napisanie idempotentnego efektu.
   */
  <StrictMode>
    {/*
      JSX wygląda jak HTML, ale jest składnią JS.
      <App /> to wywołanie komponentu funkcyjnego App, a propsy byłyby
      argumentami podobnymi do inputów w Angularze.
    */}
    <App />
  </StrictMode>,
)
