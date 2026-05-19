import { environment } from '../../../environments/environment';

export function apiEndpoint(path: string): string {
  const base = environment.apiUrl.replace(/\/$/, '');
  const route = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${route}` : route;
}
