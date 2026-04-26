import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { DashboardPayload } from '../../features/skills/state';
import { fetchDashboardState, refreshDashboardState } from '../api';
import { buildSkills, getErrorMessage } from './utils';
import type { BrowserSkill, DashboardDataValue } from './types';

const DashboardDataContext = createContext<DashboardDataValue | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    setIsInitialLoading(true);

    try {
      const next = await fetchDashboardState();
      setPayload(next);
    } catch (error) {
      setErrorMessage(`Dashboard load failed: ${getErrorMessage(error)}`);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }

    setErrorMessage(null);
    setIsRefreshing(true);

    try {
      const next = payload
        ? await refreshDashboardState(payload.installedState)
        : await fetchDashboardState();
      setPayload(next);
    } catch (error) {
      setErrorMessage(`Refresh request failed: ${getErrorMessage(error)}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, payload]);

  const skills = useMemo(() => {
    if (!payload) {
      return [];
    }

    return buildSkills(payload.installedState);
  }, [payload]);

  const getSkillById = (skillId: string): BrowserSkill | undefined => {
    return skills.find((skill) => skill.id === skillId);
  };

  const contextValue: DashboardDataValue = {
    payload,
    skills,
    isInitialLoading,
    isRefreshing,
    errorMessage,
    reload: load,
    refresh,
    getSkillById,
  };

  return (
    <DashboardDataContext.Provider value={contextValue}>{children}</DashboardDataContext.Provider>
  );
}

export function useDashboardData(): DashboardDataValue {
  const context = useContext(DashboardDataContext);

  if (!context) {
    throw new Error('useDashboardData must be used within DashboardDataProvider.');
  }

  return context;
}
