type ModelErrorShape = Error & { statusCode?: number; isRetryable?: boolean };

export function modelErrorDetails(error: unknown) {
  if (!(error instanceof Error)) return { name: "UnknownError", message: "Non-Error rejection" };
  const modelError = error as ModelErrorShape;
  const apiKeys = [process.env.OPENAI_API_KEY].filter((key): key is string => Boolean(key));
  const message = apiKeys.reduce((value, key) => value.replaceAll(key, "[redacted]"), modelError.message).slice(0, 300);
  return { name: modelError.name, message, statusCode: modelError.statusCode, isRetryable: modelError.isRetryable };
}

export function modelErrorResponse(error: unknown, fallback: string) {
  const statusCode = (error as ModelErrorShape | null)?.statusCode;
  if (statusCode === 401 || statusCode === 403) return { status: 502, error: "OpenAI rejected the API key. Check OPENAI_API_KEY in .env.local, then restart the dev server." };
  if (statusCode === 404) return { status: 502, error: "The configured model was not found. Check OPENAI_MODEL in .env.local." };
  if (statusCode === 402) return { status: 503, error: "The OpenAI API account needs available credits or billing enabled." };
  if (statusCode === 429) return { status: 503, error: "OpenAI is rate limiting requests. Wait a little and try again." };
  if (statusCode === 400 || statusCode === 422) return { status: 502, error: "The configured model rejected the request. Check the server log and verify the model name and gateway settings." };
  if (statusCode === 408 || statusCode === 504) return { status: 504, error: "The model request timed out. Please try again." };
  return { status: 502, error: fallback };
}
