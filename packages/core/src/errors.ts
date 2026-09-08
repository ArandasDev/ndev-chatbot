export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/**
 * Erro de dominio. Services lancam; a borda (HTTP ou chat) traduz.
 * Nenhuma rota precisa de try/catch por causa disso.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
  }
}

export const badRequest = (msg: string) => new AppError('BAD_REQUEST', msg);
export const unauthorized = (msg = 'Faca login para continuar.') =>
  new AppError('UNAUTHORIZED', msg);
export const forbidden = (msg = 'Voce nao tem permissao para isso.') =>
  new AppError('FORBIDDEN', msg);
export const notFound = (msg = 'Nao encontrado.') => new AppError('NOT_FOUND', msg);
export const conflict = (msg: string) => new AppError('CONFLICT', msg);

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
