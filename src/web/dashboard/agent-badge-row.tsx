import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { AgentBadge } from './agent-badge';

const AGENT_BADGE_GAP = 6;

const getRowWidth = (widths: number[], overflowWidth: number) => {
  if (widths.length === 0) {
    return overflowWidth;
  }

  return (
    widths.reduce((total, width) => total + width, 0) +
    (widths.length - 1) * AGENT_BADGE_GAP +
    AGENT_BADGE_GAP +
    overflowWidth
  );
};

export function AgentBadgeRow({ agents, skillId }: { agents: string[]; skillId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const overflowMeasureRef = useRef<HTMLButtonElement>(null);
  const [visibleCount, setVisibleCount] = useState(agents.length);

  const measureVisibleCount = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    const overflowMeasure = overflowMeasureRef.current;

    if (!container || !measure || !overflowMeasure) {
      return;
    }

    const style = window.getComputedStyle(container);
    const inlinePadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const availableWidth = container.clientWidth - inlinePadding;
    const badgeWidths = Array.from(measure.children)
      .filter((child) => child !== overflowMeasure)
      .map((child) => child.getBoundingClientRect().width);
    const totalBadgeWidth =
      badgeWidths.reduce((total, width) => total + width, 0) +
      Math.max(0, badgeWidths.length - 1) * AGENT_BADGE_GAP;

    if (totalBadgeWidth <= availableWidth) {
      setVisibleCount(agents.length);
      return;
    }

    const overflowWidth = overflowMeasure.getBoundingClientRect().width;
    let nextVisibleCount = 0;

    for (let count = 1; count < badgeWidths.length; count += 1) {
      const rowWidth = getRowWidth(badgeWidths.slice(0, count), overflowWidth);

      if (rowWidth > availableWidth) {
        break;
      }

      nextVisibleCount = count;
    }

    setVisibleCount(nextVisibleCount);
  }, [agents.length]);

  useLayoutEffect(() => {
    measureVisibleCount();

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver(measureVisibleCount);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [measureVisibleCount]);

  const visibleAgents = useMemo(() => agents.slice(0, visibleCount), [agents, visibleCount]);
  const hiddenAgents = useMemo(() => agents.slice(visibleCount), [agents, visibleCount]);

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-8 items-center gap-1.5 overflow-hidden rounded-md border border-dashed p-1.5"
    >
      <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">
        {visibleAgents.map((agent) => (
          <AgentBadge key={`${skillId}:${agent}`} agent={agent} />
        ))}
        {hiddenAgents.length > 0 ? (
          <Tooltip>
            <TooltipTrigger>
              <button
                type="button"
                className="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-4xl border border-border px-2 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label={`${hiddenAgents.length} more agents`}
              >
                +{hiddenAgents.length}
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="end"
              className="max-w-96 flex-wrap justify-start bg-popover text-popover-foreground ring-1 ring-border"
            >
              {hiddenAgents.map((agent) => (
                <AgentBadge key={`${skillId}:hidden:${agent}`} agent={agent} />
              ))}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute flex h-0 flex-nowrap items-center gap-1.5 overflow-hidden"
      >
        {agents.map((agent) => (
          <AgentBadge key={`${skillId}:measure:${agent}`} agent={agent} />
        ))}
        <button
          ref={overflowMeasureRef}
          type="button"
          tabIndex={-1}
          className="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-4xl border border-border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
        >
          +{agents.length}
        </button>
      </div>
    </div>
  );
}
