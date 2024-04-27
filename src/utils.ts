export interface ErrorLike extends Partial<Error> {
  message: string
}

export const isPlainObject = (
  data: unknown
): data is Record<string | number | symbol, unknown> => {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const proto = Object.getPrototypeOf(data)
  return proto === null || proto === Object.prototype
}

export const isErrorLike = (error: unknown): error is ErrorLike =>
  isPlainObject(error) &&
  Object.hasOwn(error, 'message') &&
  typeof error.message === 'string'

export const parseUnknownError = (error: unknown) => {
  if (isErrorLike(error)) {
    return error as Error
  }

  try {
    return new Error(JSON.stringify(error))
  } catch {
    return new Error(String(error))
  }
}
