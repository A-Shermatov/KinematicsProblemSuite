import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type PlatformSettings } from "../api";

const DEFAULT: PlatformSettings = {
  difficulty_max: 1000,
  difficulty_step: 100,
  difficulty_levels: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
  password_min_length: 8,
  show_country_field: false,
};

interface SettingsState {
  settings: PlatformSettings;
  reload: () => void;
}

const SettingsContext = createContext<SettingsState>({ settings: DEFAULT, reload: () => undefined });

/** Системные настройки платформы (шкала сложности и т.п.), загружаются один раз при старте. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api.settings
      .get()
      .then(setSettings)
      .catch(() => undefined);
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(() => ({ settings, reload }), [settings, reload]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function usePlatformSettings(): SettingsState {
  return useContext(SettingsContext);
}
