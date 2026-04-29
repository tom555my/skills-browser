import { createContext, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DashboardPayload } from '../../features/skills/state';
import { fetchDashboardState, refreshDashboardState } from '../api';
import { buildSkills, getErrorMessage } from './utils';
import type { BrowserSkill, DashboardActionsValue, DashboardDataValue } from './types';

const DashboardDataContext = createContext<DashboardDataValue | null>(null);
const DashboardActionsContext = createContext<DashboardActionsValue | null>(null);
const dashboardQueryKey = ['dashboard', 'state'] as const;

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const {
    data: payload = null,
    error: loadError,
    isPending: isInitialLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: fetchDashboardState,
  });
  const {
    error: refreshError,
    isPending: isRefreshPending,
    mutateAsync: refreshDashboard,
    reset: resetRefresh,
  } = useMutation({
    mutationFn: async () => {
      const currentPayload =
        queryClient.getQueryData<DashboardPayload>(dashboardQueryKey) ?? payload;

      return currentPayload
        ? refreshDashboardState(currentPayload.installedState)
        : fetchDashboardState();
    },
    onSuccess: (nextPayload) => {
      queryClient.setQueryData(dashboardQueryKey, nextPayload);
    },
  });

  const load = useCallback(async () => {
    resetRefresh();
    await refetch();
  }, [refetch, resetRefresh]);

  const refresh = useCallback(async () => {
    if (isRefreshPending) {
      return;
    }

    await refreshDashboard();
  }, [isRefreshPending, refreshDashboard]);

  const errorMessage = useMemo(() => {
    if (refreshError) {
      return `Refresh request failed: ${getErrorMessage(refreshError)}`;
    }

    if (!payload && loadError) {
      return `Dashboard load failed: ${getErrorMessage(loadError)}`;
    }

    return null;
  }, [loadError, payload, refreshError]);

  const skills = useMemo(() => {
    if (!payload) {
      return [];
    }

    return buildSkills(payload.installedState);
  }, [payload]);

  const skillsById = useMemo(() => {
    return new Map(skills.map((skill) => [skill.id, skill]));
  }, [skills]);

  const getSkillById = useCallback(
    (skillId: string): BrowserSkill | undefined => {
      return skillsById.get(skillId);
    },
    [skillsById]
  );

  const dataValue: DashboardDataValue = useMemo(
    () => ({
      payload,
      skills,
      isInitialLoading,
      errorMessage,
      getSkillById,
    }),
    [errorMessage, getSkillById, isInitialLoading, payload, skills]
  );

  const actionsValue: DashboardActionsValue = useMemo(
    () => ({
      isRefreshing: isRefreshPending || isRefetching,
      reload: load,
      refresh,
    }),
    [isRefreshPending, isRefetching, load, refresh]
  );

  return (
    <DashboardActionsContext.Provider value={actionsValue}>
      <DashboardDataContext.Provider value={dataValue}>{children}</DashboardDataContext.Provider>
    </DashboardActionsContext.Provider>
  );
}

export function useDashboardData(): DashboardDataValue {
  const context = useContext(DashboardDataContext);

  if (!context) {
    throw new Error('useDashboardData must be used within DashboardDataProvider.');
  }

  return context;
}

export function useDashboardActions(): DashboardActionsValue {
  const context = useContext(DashboardActionsContext);

  if (!context) {
    throw new Error('useDashboardActions must be used within DashboardDataProvider.');
  }

  return context;
}
