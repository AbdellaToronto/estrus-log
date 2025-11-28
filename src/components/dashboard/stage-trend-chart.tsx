'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, Activity } from "lucide-react";

type DailyTrendData = {
  date: string;
  Proestrus: number;
  Estrus: number;
  Metestrus: number;
  Diestrus: number;
};

const STAGE_COLORS = {
  Proestrus: '#a855f7', // purple
  Estrus: '#ef4444',    // red  
  Metestrus: '#f97316', // orange
  Diestrus: '#3b82f6',  // blue
};

export function StageTrendChart({ data }: { data: DailyTrendData[] }) {
  const { maxValue, totalScans, chartData } = useMemo(() => {
    let max = 0;
    let total = 0;
    
    const processed = data.map(day => {
      const dayTotal = day.Proestrus + day.Estrus + day.Metestrus + day.Diestrus;
      total += dayTotal;
      if (dayTotal > max) max = dayTotal;
      return { ...day, total: dayTotal };
    });
    
    return { maxValue: max || 1, totalScans: total, chartData: processed };
  }, [data]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  return (
    <Card className="col-span-full overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              7-Day Activity
            </CardTitle>
            <CardDescription className="mt-1">
              Stage distribution over the past week
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
            <TrendingUp className="w-4 h-4" />
            <span className="font-semibold">{totalScans}</span>
            <span className="text-emerald-600/70">scans</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
          {Object.entries(STAGE_COLORS).map(([stage, color]) => (
            <div key={stage} className="flex items-center gap-1.5">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: color }}
              />
              <span className="text-xs font-medium text-muted-foreground">{stage}</span>
            </div>
          ))}
        </div>

        {/* Chart Area */}
        <div className="relative h-48 sm:h-56">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="border-t border-slate-100 w-full" />
            ))}
          </div>

          {/* Bars */}
          <div className="relative h-full flex items-end justify-around gap-1 sm:gap-2 px-2">
            {chartData.map((day, idx) => {
              const heightPercent = (day.total / maxValue) * 100;
              
              // Calculate segment heights
              const proestrusHeight = day.total > 0 ? (day.Proestrus / day.total) * heightPercent : 0;
              const estrusHeight = day.total > 0 ? (day.Estrus / day.total) * heightPercent : 0;
              const metestrusHeight = day.total > 0 ? (day.Metestrus / day.total) * heightPercent : 0;
              const diestrusHeight = day.total > 0 ? (day.Diestrus / day.total) * heightPercent : 0;

              return (
                <div 
                  key={day.date} 
                  className="flex-1 flex flex-col items-center group max-w-16"
                >
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 bg-slate-900 text-white text-xs px-2 py-1 rounded-lg shadow-lg z-10 whitespace-nowrap pointer-events-none">
                    <div className="font-semibold mb-1">{formatDate(day.date)}</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {day.Proestrus > 0 && <span>Pro: {day.Proestrus}</span>}
                      {day.Estrus > 0 && <span>Est: {day.Estrus}</span>}
                      {day.Metestrus > 0 && <span>Met: {day.Metestrus}</span>}
                      {day.Diestrus > 0 && <span>Die: {day.Diestrus}</span>}
                    </div>
                  </div>

                  {/* Stacked bar */}
                  <div 
                    className="w-full flex flex-col-reverse rounded-t-lg overflow-hidden transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg cursor-pointer"
                    style={{ height: `${Math.max(heightPercent, day.total > 0 ? 8 : 0)}%` }}
                  >
                    {day.Diestrus > 0 && (
                      <div 
                        className="w-full transition-all"
                        style={{ 
                          height: `${diestrusHeight}%`, 
                          backgroundColor: STAGE_COLORS.Diestrus,
                          minHeight: day.Diestrus > 0 ? '4px' : 0
                        }}
                      />
                    )}
                    {day.Metestrus > 0 && (
                      <div 
                        className="w-full transition-all"
                        style={{ 
                          height: `${metestrusHeight}%`, 
                          backgroundColor: STAGE_COLORS.Metestrus,
                          minHeight: day.Metestrus > 0 ? '4px' : 0
                        }}
                      />
                    )}
                    {day.Estrus > 0 && (
                      <div 
                        className="w-full transition-all"
                        style={{ 
                          height: `${estrusHeight}%`, 
                          backgroundColor: STAGE_COLORS.Estrus,
                          minHeight: day.Estrus > 0 ? '4px' : 0
                        }}
                      />
                    )}
                    {day.Proestrus > 0 && (
                      <div 
                        className="w-full transition-all"
                        style={{ 
                          height: `${proestrusHeight}%`, 
                          backgroundColor: STAGE_COLORS.Proestrus,
                          minHeight: day.Proestrus > 0 ? '4px' : 0
                        }}
                      />
                    )}
                  </div>

                  {/* Empty state indicator */}
                  {day.total === 0 && (
                    <div className="w-full h-2 bg-slate-100 rounded-full" />
                  )}

                  {/* Day label */}
                  <div className="mt-2 text-[10px] sm:text-xs font-medium text-muted-foreground">
                    {formatShortDate(day.date)}
                  </div>
                  
                  {/* Count below */}
                  <div className="text-[10px] text-muted-foreground/60">
                    {day.total > 0 ? day.total : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary stats below chart */}
        <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-4 gap-2 sm:gap-4">
          {Object.entries(STAGE_COLORS).map(([stage, color]) => {
            const stageTotal = chartData.reduce((sum, day) => sum + day[stage as keyof typeof STAGE_COLORS], 0);
            const percentage = totalScans > 0 ? Math.round((stageTotal / totalScans) * 100) : 0;
            
            return (
              <div key={stage} className="text-center">
                <div 
                  className="text-lg sm:text-2xl font-bold"
                  style={{ color }}
                >
                  {percentage}%
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  {stage}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

