export async function readApiResponse<T extends { error?: string }>(response: Response, fallbackMessage: string): Promise<T> {
  const raw = await response.text();
  if (!raw.trim()) {
    throw new Error(fallbackMessage);
  }

  let data: T;
  try {
    data = JSON.parse(raw) as T;
  } catch {
    throw new Error(fallbackMessage);
  }

  if (!response.ok) {
    throw new Error(data.error?.trim() || fallbackMessage);
  }

  return data;
}
