import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { DashboardPayload, UpdateSkillsResponse } from '../../features/skills/state';
import { removeInstalledSkills, refreshDashboardState, updateDashboardSkills } from '../api';
import type { BrowserSkill, RemoveOutcome } from './types';
import { dashboardQueryKey } from './data';

type RemoveSkillOptions = {
  applyPayloadDelayMs?: number;
};

export function useSkillActions() {
  const queryClient = useQueryClient();

  const getCurrentPayload = useCallback(() => {
    return queryClient.getQueryData<DashboardPayload>(dashboardQueryKey) ?? null;
  }, [queryClient]);

  const removeSkill = useCallback(
    async (skill: BrowserSkill, options?: RemoveSkillOptions): Promise<RemoveOutcome> => {
      const currentPayload = getCurrentPayload();
      const response = await removeInstalledSkills({
        names: [skill.name],
        scope: skill.scope,
        agents: skill.agents,
        previousState: currentPayload?.installedState,
      });

      const applyPayload = () => queryClient.setQueryData(dashboardQueryKey, response.payload);

      if (response.command.ok && options?.applyPayloadDelayMs) {
        window.setTimeout(applyPayload, options.applyPayloadDelayMs);
      } else {
        applyPayload();
      }

      return {
        status: response.command.ok ? 'success' : 'failure',
        scope: response.scope,
        names: [skill.name],
        command: response.command,
        payload: response.payload,
      };
    },
    [getCurrentPayload, queryClient]
  );

  const updateSkill = useCallback(
    async (skill: BrowserSkill): Promise<UpdateSkillsResponse> => {
      const response = await updateDashboardSkills({
        names: [skill.name],
        scope: skill.scope,
      });

      if (response.command.ok) {
        const currentPayload = getCurrentPayload();
        const nextPayload = currentPayload
          ? await refreshDashboardState(currentPayload.installedState)
          : null;

        if (nextPayload) {
          queryClient.setQueryData(dashboardQueryKey, nextPayload);
        }
      }

      return response;
    },
    [getCurrentPayload, queryClient]
  );

  return { removeSkill, updateSkill };
}
