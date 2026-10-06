import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { name: 'home' }
  | { name: 'history' }
  | { name: 'stats' }
  | { name: 'new' }
  | { name: 'edit'; id: number };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  if (path === '/historial') return { name: 'history' };
  if (path === '/estadisticas') return { name: 'stats' };
  if (path === '/nueva') return { name: 'new' };
  const edit = /^\/llaga\/(\d+)$/.exec(path);
  if (edit) return { name: 'edit', id: Number(edit[1]) };
  return { name: 'home' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string, replace = false) {
  if (replace) history.replaceState(null, '', `#${path}`);
  else location.hash = path;
  if (replace) dispatchEvent(new HashChangeEvent('hashchange'));
}
