export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

/**
 * Cliente HTTP do painel.
 *
 * `credentials: 'include'` é o que faz o cookie de sessão viajar até a API. O
 * token nunca passa por JavaScript — é httpOnly —, então não há header
 * Authorization para montar aqui.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });

  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // resposta sem corpo JSON
    }

    throw new ApiError(
      response.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? 'Não consegui falar com o servidor.',
    );
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/**
 * Manda o navegador para um fluxo OAuth.
 *
 * É uma navegação top-level de propósito, não um fetch: o retorno do provedor
 * precisa poder setar cookie e redirecionar, o que XHR não faz.
 */
export function goToOAuth(path: string): void {
  window.location.href = `${API_URL}${path}`;
}
