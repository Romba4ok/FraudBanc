import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DisplaySettings } from "./DisplaySettings";
import { SidebarNavigation } from "./SidebarNavigation";
import { NotificationCenter } from "../components/NotificationCenter";
import { SearchIcon } from "../components/ui/icons";
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  DASHBOARD_ROUTES,
} from "../types/dashboard";
import type {
  DashboardPreferences,
  DashboardRouteId,
  WorkspacePhase,
} from "../types/dashboard";
import type { SessionNotification } from "../types/notifications";

const PREFERENCES_KEY = "risk-ledger-display-preferences";

function restorePreferences(): DashboardPreferences {
  try {
    const stored = window.localStorage.getItem(PREFERENCES_KEY);
    if (!stored) return DEFAULT_DASHBOARD_PREFERENCES;
    const parsed = JSON.parse(stored) as Partial<DashboardPreferences>;
    return {
      ...DEFAULT_DASHBOARD_PREFERENCES,
      ...parsed,
    };
  } catch {
    return DEFAULT_DASHBOARD_PREFERENCES;
  }
}

interface DashboardShellProps {
  activeRoute: DashboardRouteId;
  children: ReactNode;
  phase: WorkspacePhase;
  notifications?: SessionNotification[];
  onNavigate: (route: DashboardRouteId) => void;
}

export function DashboardShell({
  activeRoute,
  children,
  phase,
  notifications = [],
  onNavigate,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileMode, setMobileMode] = useState(false);
  const [preferences, setPreferences] = useState(restorePreferences);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const route = DASHBOARD_ROUTES.find((item) => item.id === activeRoute)!;

  useEffect(() => {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 767px)");
    const syncMobileMode = () => setMobileMode(query.matches);
    syncMobileMode();
    query.addEventListener("change", syncMobileMode);
    return () => query.removeEventListener("change", syncMobileMode);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--text-scale",
      String(preferences.textScale / 100),
    );
    return () => {
      document.documentElement.style.removeProperty("--text-scale");
    };
  }, [preferences.textScale]);

  const closeMobileMenu = () => {
    setMobileOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  return (
    <div
      className={`dashboard-root density-${preferences.density} mode-${preferences.explanationMode} contrast-${preferences.contrast} scale-${preferences.textScale}`}
    >
      <a className="skip-link" href="#main-content">К основному содержимому</a>
      <SidebarNavigation
        activeRoute={activeRoute}
        mobileMode={mobileMode}
        mobileOpen={mobileOpen}
        phase={phase}
        onCloseMobile={closeMobileMenu}
        onNavigate={onNavigate}
      />
      <div className="dashboard-stage">
        <header className="dashboard-header">
          <button
            aria-controls="dashboard-sidebar"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
            className="dashboard-menu-button"
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
          >☰</button>
          <div>
            <span className="dashboard-header__context">Рабочее пространство</span>
            <strong>{route.label}</strong>
          </div>
          <label className="dashboard-search">
            <SearchIcon />
            <span className="sr-only">Поиск в текущем разделе</span>
            <input aria-label="Поиск в текущем разделе" placeholder="Поиск по текущему разделу" type="search" />
          </label>
          <div className="dashboard-header__tools">
            <NotificationCenter notifications={notifications} />
            <DisplaySettings preferences={preferences} onChange={setPreferences} />
            <div className="dashboard-analyst" aria-label="Текущая роль: аналитик по рискам">
              <span aria-hidden="true">АР</span>
              <div><strong>Аналитик</strong><small>Риск-проверка</small></div>
            </div>
          </div>
        </header>
        <main className="dashboard-content" id="main-content" tabIndex={-1}>{children}</main>
        <footer className="dashboard-footer">
          <span>Risk Ledger / Local Analysis</span>
          <span>Оценка риска не является доказательством мошенничества.</span>
        </footer>
      </div>
    </div>
  );
}
