'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface HourlyStat {
  hour: number;
  timestamp?: string;
  views: number;
  unique: number;
  hour_label: string;
}

interface EngagementHeatmapProps {
  data?: { hourly_stats?: HourlyStat[] };
  isLoading?: boolean;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getDayOfWeek(timestamp: string): number {
  const d = new Date(timestamp);
  // JS: 0=Sun, convert to 0=Mon
  return (d.getDay() + 6) % 7;
}

export function EngagementHeatmap({ data, isLoading }: EngagementHeatmapProps) {
  const { grid, maxVal, totalVisitors, peakHour, peakDay } = useMemo(() => {
    // 7 days × 24 hours grid
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const counts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    const stats = data?.hourly_stats ?? [];

    for (const stat of stats) {
      if (stat.timestamp) {
        const day = getDayOfWeek(stat.timestamp);
        const hour = stat.hour;
        if (hour >= 0 && hour < 24 && day >= 0 && day < 7) {
          g[day][hour] += stat.views;
          counts[day][hour]++;
        }
      } else {
        // Fallback: no timestamp, just aggregate by hour across all days
        const hour = stat.hour;
        if (hour >= 0 && hour < 24) {
          for (let d = 0; d < 7; d++) {
            g[d][hour] += Math.round(stat.views / 7);
            counts[d][hour]++;
          }
        }
      }
    }

    // Average if multiple entries per cell
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (counts[d][h] > 1) {
          g[d][h] = Math.round(g[d][h] / counts[d][h]);
        }
      }
    }

    let max = 0;
    let total = 0;
    let pDay = 0;
    let pHour = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        total += g[d][h];
        if (g[d][h] > max) {
          max = g[d][h];
          pDay = d;
          pHour = h;
        }
      }
    }

    return {
      grid: g,
      maxVal: max,
      totalVisitors: total,
      peakHour: pHour,
      peakDay: pDay,
    };
  }, [data]);

  function getIntensity(value: number): string {
    if (maxVal === 0 || value === 0) return 'bg-muted/30';
    const ratio = value / maxVal;
    if (ratio < 0.15) return 'bg-primary/10';
    if (ratio < 0.3) return 'bg-primary/20';
    if (ratio < 0.45) return 'bg-primary/35';
    if (ratio < 0.6) return 'bg-primary/50';
    if (ratio < 0.75) return 'bg-primary/65';
    if (ratio < 0.9) return 'bg-primary/80';
    return 'bg-primary';
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-48 bg-muted/50 rounded animate-pulse" />
          <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `40px repeat(24, 1fr)` }}>
          {Array.from({ length: 7 * 25 }).map((_, i) => (
            <div key={i} className={cn("rounded-sm animate-pulse", i % 25 === 0 ? "h-4 bg-transparent" : "h-7 bg-muted/30")} />
          ))}
        </div>
      </div>
    );
  }

  const formatHour = (h: number) => {
    if (h === 0) return '12a';
    if (h < 12) return `${h}a`;
    if (h === 12) return '12p';
    return `${h - 12}p`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Visitor Activity</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            When your visitors are most active throughout the week
          </p>
        </div>
        {maxVal > 0 && (
          <div className="text-right">
            <p className="text-sm font-bold">{DAYS[peakDay]} {formatHour(peakHour)}</p>
            <p className="text-[10px] text-muted-foreground">peak activity</p>
          </div>
        )}
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels */}
          <div className="grid gap-[3px] mb-1" style={{ gridTemplateColumns: `40px repeat(24, 1fr)` }}>
            <div />
            {HOURS.map(h => (
              <div key={h} className="text-[9px] text-muted-foreground text-center font-medium">
                {h % 3 === 0 ? formatHour(h) : ''}
              </div>
            ))}
          </div>

          {/* Rows */}
          {DAYS.map((day, dayIdx) => (
            <div key={day} className="grid gap-[3px] mb-[3px]" style={{ gridTemplateColumns: `40px repeat(24, 1fr)` }}>
              <div className="text-[10px] text-muted-foreground font-medium flex items-center">{day}</div>
              {HOURS.map(hour => {
                const val = grid[dayIdx][hour];
                return (
                  <div
                    key={hour}
                    className={cn(
                      "rounded-sm h-7 transition-colors cursor-default group relative",
                      getIntensity(val)
                    )}
                    title={`${day} ${formatHour(hour)} — ${val.toLocaleString()} views`}
                  />
                );
              })}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center justify-between mt-3 px-[40px]">
            <span className="text-[10px] text-muted-foreground">Less</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-3 rounded-sm bg-muted/30" />
              <div className="w-4 h-3 rounded-sm bg-primary/15" />
              <div className="w-4 h-3 rounded-sm bg-primary/30" />
              <div className="w-4 h-3 rounded-sm bg-primary/50" />
              <div className="w-4 h-3 rounded-sm bg-primary/70" />
              <div className="w-4 h-3 rounded-sm bg-primary" />
            </div>
            <span className="text-[10px] text-muted-foreground">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
