'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type LogEntry = {
  id: string;
  date: string;
  stage: string;
  notes: string;
};

const STAGE_COLORS: Record<string, string> = {
  'Proestrus': 'bg-pink-400',
  'Estrus': 'bg-red-500',
  'Metestrus': 'bg-purple-400',
  'Diestrus': 'bg-blue-400',
};

const STAGE_HEIGHTS: Record<string, string> = {
  'Proestrus': 'h-12', // Rising
  'Estrus': 'h-16',    // Peak
  'Metestrus': 'h-8',  // Falling
  'Diestrus': 'h-4',   // Baseline
};

export function CycleTimeline({ logs }: { logs: LogEntry[] }) {
  // Sort logs by date
  const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estrus Cycle Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-32 flex items-end gap-1 overflow-x-auto pb-6 pt-4 px-2">
          {/* Background lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10 px-2">
            <div className="w-full border-t border-foreground" />
            <div className="w-full border-t border-foreground" />
            <div className="w-full border-t border-foreground" />
            <div className="w-full border-t border-foreground" />
          </div>

          {sortedLogs.map((log) => (
            <TooltipProvider key={log.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center gap-1 group cursor-pointer">
                    <div 
                      className={`w-8 rounded-t-sm transition-all group-hover:brightness-110 ${STAGE_COLORS[log.stage] || 'bg-gray-300'} ${STAGE_HEIGHTS[log.stage] || 'h-4'}`} 
                    />
                    <span className="text-[10px] text-muted-foreground rotate-45 origin-left translate-y-2">
                      {new Date(log.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs font-bold">{log.stage}</div>
                  <div className="text-xs">{new Date(log.date).toLocaleDateString()}</div>
                  {log.notes && <div className="text-xs text-muted-foreground mt-1 max-w-[150px]">{log.notes}</div>}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex gap-4 mt-6 justify-center text-xs text-muted-foreground">
          {Object.entries(STAGE_COLORS).map(([stage, color]) => (
            <div key={stage} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-full ${color}`} />
              <span>{stage}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
