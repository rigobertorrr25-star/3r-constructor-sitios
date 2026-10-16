/** Saca el token de "Authorization: Bearer …" sin exigirlo: cada servicio decide qué hacer si falta. */
export function bearerOf(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  const [scheme, token] = value?.split(' ') ?? [];
  return scheme === 'Bearer' && token ? token : undefined;
}

export interface RawRequest {
  headers: Record<string, string | string[] | undefined>;
}
