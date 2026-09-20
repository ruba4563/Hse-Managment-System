export const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000';

export interface ApiErrorResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export async function getErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const data =
      (await response.json()) as ApiErrorResponse;

    if (Array.isArray(data.message)) {
      return data.message.join(', ');
    }

    if (typeof data.message === 'string') {
      return data.message;
    }
  } catch {
    // Use a generic message when the response
    // is not valid JSON.
  }

  return `Request failed (${response.status})`;
}