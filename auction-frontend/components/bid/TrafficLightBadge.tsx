'use client';

import { TrafficLightStatus } from '@/lib/types';

interface TrafficLightBadgeProps {
  status: TrafficLightStatus;
  greenPct?: number;
  yellowPct?: number;
}

export function TrafficLightBadge({ status, greenPct, yellowPct }: TrafficLightBadgeProps) {
  if (status === TrafficLightStatus.DISABLED) return null;

  const config = {
    [TrafficLightStatus.GREEN]: {
      dotClass: 'bg-green-500 animate-pulse',
      label: 'Competitive',
      textClass: 'text-green-700',
      tooltip: greenPct != null ? `Within ${greenPct}% of best price` : 'Competitive bid',
    },
    [TrafficLightStatus.YELLOW]: {
      dotClass: 'bg-amber-400',
      label: 'Marginal',
      textClass: 'text-amber-700',
      tooltip: greenPct != null && yellowPct != null
        ? `${greenPct}–${yellowPct}% from best price`
        : 'Marginally competitive',
    },
    [TrafficLightStatus.RED]: {
      dotClass: 'bg-red-500',
      label: 'Not competitive',
      textClass: 'text-red-700',
      tooltip: yellowPct != null ? `More than ${yellowPct}% from best price` : 'Not competitive',
    },
  } as const;

  const { dotClass, label, textClass, tooltip } = config[status];

  return (
    <div title={tooltip} className="flex items-center gap-1.5 cursor-default">
      <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      <span className={`text-xs font-medium ${textClass}`}>{label}</span>
    </div>
  );
}
