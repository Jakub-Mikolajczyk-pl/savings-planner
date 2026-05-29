export type BackendMode = 'local' | 'api'

/*
 * import.meta.env to mechanizm Vite na zmienne środowiskowe dostępne w froncie.
 *
 * WAŻNE:
 * - tylko zmienne z prefiksem VITE_ trafiają do bundle przeglądarki,
 * - wszystko w bundle frontendu jest widoczne dla użytkownika,
 * - dlatego VITE_API_TOKEN jest wygodnym tokenem LAN/dev, ale nie sekretem
 *   klasy backend-only.
 *
 * Angular porównanie:
 * Angular często ma environment.ts/environment.prod.ts. W Vite konfiguracja
 * przychodzi z .env, .env.local i zmiennych procesu podczas builda.
 */
const rawBackendMode = import.meta.env.VITE_BACKEND

/*
 * BackendMode to string literal union.
 * Dzięki temu TypeScript wie, że legalne wartości to dokładnie 'local' albo 'api'.
 * To frontendowy odpowiednik bardzo małego enuma, ale bez runtime kodu.
 */
export const BACKEND_MODE: BackendMode = rawBackendMode === 'api' ? 'api' : 'local'
/*
 * Defaulty są celowo developerskie. Produkcyjne LAN ustawimy przez .env/.env.local
 * albo konfigurację build/deploy.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
export const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? 'dev-token'
/*
 * Mała stała czytelności: komponenty i store nie muszą porównywać stringów.
 */
export const IS_API_MODE = BACKEND_MODE === 'api'
