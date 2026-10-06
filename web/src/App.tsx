import { useSores } from './api.ts';
import { useRoute, type Route } from './router.ts';
import { Home } from './pages/Home.tsx';
import { History } from './pages/History.tsx';
import { SoreForm } from './pages/SoreForm.tsx';
import { StatsPage } from './pages/Stats.tsx';

const TABS: { route: Route['name']; href: string; label: string; icon: string }[] = [
  { route: 'home', href: '#/', label: 'Inicio', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { route: 'history', href: '#/historial', label: 'Historial', icon: 'M4 6h16M4 12h16M4 18h10' },
  { route: 'stats', href: '#/estadisticas', label: 'Estadísticas', icon: 'M5 20V10M12 20V4M19 20v-7' },
];

function Page({ route }: { route: Route }) {
  const { sores, error } = useSores();
  if (error && !sores) return <p class="empty">No se pudieron cargar las llagas: {error}</p>;
  if (!sores) return <p class="empty">Cargando…</p>;
  switch (route.name) {
    case 'home':
      return <Home sores={sores} />;
    case 'history':
      return <History sores={sores} />;
    case 'stats':
      return <StatsPage sores={sores} />;
    case 'new':
      return <SoreForm sores={sores} />;
    case 'edit': {
      const sore = sores.find((s) => s.id === route.id);
      return sore ? <SoreForm key={sore.id} sores={sores} sore={sore} /> : <p class="empty">Esta llaga no existe.</p>;
    }
  }
}

export function App() {
  const route = useRoute();
  const showFab = route.name === 'home' || route.name === 'history';
  return (
    <>
      <main>
        <Page route={route} />
      </main>
      {showFab && (
        <a class="fab" href="#/nueva" aria-label="Nueva llaga">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </a>
      )}
      <nav class="tabbar">
        {TABS.map((tab) => (
          <a key={tab.route} href={tab.href} class={route.name === tab.route ? 'active' : ''}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={tab.icon} />
            </svg>
            <span>{tab.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
