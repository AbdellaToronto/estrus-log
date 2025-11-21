'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ZoomIn, ZoomOut, Maximize2, Bell, User, Share2, Download } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogEntryModal } from '@/components/log-entry-modal';
import { format } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from "recharts";
import { motion } from "framer-motion";

export function SubjectPageClient({ subject, initialLogs }: { subject: any, initialLogs: any[] }) {
  const [logs, setLogs] = useState(initialLogs);
  const [selectedLog, setSelectedLog] = useState(initialLogs[0] || null);

  const handleLogCreated = () => {
    // In a real app, we'd re-fetch or use a server action to get the new log
    // For now, we'll just reload the page to get fresh data
    window.location.reload();
  };

  // Prepare Chart Data
  const timelineData = logs
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(log => ({
      date: format(new Date(log.created_at), 'MMM d'),
      stage: log.stage,
      confidence: typeof log.confidence === 'number' ? log.confidence : 0.95,
      value: 1 // Simple activity counter
    }));

  const stageCounts = logs.reduce((acc, log) => {
    acc[log.stage] = (acc[log.stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const distributionData = Object.entries(stageCounts).map(([name, value]) => ({ name, value }));

  const STAGE_COLORS: Record<string, string> = {
    Proestrus: "#f472b6",
    Estrus: "#fb7185",
    Metestrus: "#38bdf8",
    Diestrus: "#34d399",
    Uncertain: "#cbd5f5",
  };

  return (
    <div className="space-y-6 h-[calc(100vh-2rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold text-foreground/80">Analysis View: {subject.name}</h1>
        <div className="flex items-center gap-4">
           <Avatar className="h-9 w-9 border-2 border-white/20">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>LW</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Top Row: Charts & Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0 h-48">
         <motion.div 
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           className="glass-panel rounded-2xl p-4 flex flex-col justify-between"
         >
            <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Activity Trend</h3>
            <div className="flex-1 mt-2 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    itemStyle={{ color: '#1e293b' }}
                  />
                  <Area type="monotone" dataKey="confidence" stroke="#8884d8" fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
         </motion.div>

         <motion.div 
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.1 }}
           className="glass-panel rounded-2xl p-4 flex flex-col justify-between"
         >
            <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Stage Distribution</h3>
            <div className="flex-1 mt-2 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData}>
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STAGE_COLORS[entry.name] || "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
         </motion.div>

         <motion.div 
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.2 }}
           className="glass-panel rounded-2xl p-4 flex flex-col gap-2 justify-center items-start"
         >
            <div className="text-muted-foreground text-sm font-medium">Total Scans</div>
            <div className="text-4xl font-bold text-slate-800">{logs.length}</div>
            
            <div className="w-full h-px bg-slate-100 my-2" />
            
            <div className="text-muted-foreground text-sm font-medium">Most Frequent Stage</div>
            <div className="text-xl font-semibold text-primary">
              {distributionData.sort((a,b) => b.value - a.value)[0]?.name || 'N/A'}
            </div>
         </motion.div>
      </div>

      {/* Main Split View */}
      <div className="grid lg:grid-cols-[1fr_350px] gap-6 flex-1 min-h-0">
        {/* Left: Image Viewer */}
        <div className="glass-panel rounded-3xl p-4 relative flex flex-col overflow-hidden">
          <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-xl bg-white/80 backdrop-blur shadow-sm hover:bg-white">
              <ZoomIn className="h-5 w-5" />
            </Button>
            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-xl bg-white/80 backdrop-blur shadow-sm hover:bg-white">
              <ZoomOut className="h-5 w-5" />
            </Button>
            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-xl bg-white/80 backdrop-blur shadow-sm hover:bg-white">
              <Maximize2 className="h-5 w-5" />
            </Button>
          </div>

          {selectedLog && (
            <div className="absolute top-6 right-6 z-10">
               <Badge variant="secondary" className="bg-white/80 backdrop-blur text-foreground px-3 py-1.5 rounded-lg shadow-sm">
                <span className="mr-2">✨</span> AI detected
              </Badge>
            </div>
          )}

          {/* Main Image Area */}
          <div className="flex-1 bg-black/5 rounded-2xl flex items-center justify-center overflow-hidden relative">
            {selectedLog ? (
              <img 
                src={selectedLog.image_url} 
                alt="Analysis" 
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-muted-foreground">No logs selected</div>
            )}
          </div>
        </div>

        {/* Right: Analysis Panel */}
        <div className="flex flex-col gap-6">
          {/* Result Card */}
          {selectedLog ? (
            <div className="glass-panel rounded-3xl p-6 space-y-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Estrus Stage:</div>
                <div className="text-3xl font-bold">{selectedLog.stage}</div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Confidence score:</span>
                  <span className="font-bold">
                    {selectedLog.confidence ? (selectedLog.confidence[selectedLog.stage] * 100).toFixed(1) + '%' : 'N/A'}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: selectedLog.confidence ? `${selectedLog.confidence[selectedLog.stage] * 100}%` : '0%' }}
                  />
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-semibold mb-1">Notes:</p>
                <p>{selectedLog.notes || 'No notes'}</p>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl p-6 flex items-center justify-center text-muted-foreground">
              Select a log to view details
            </div>
          )}
          
          <LogEntryModal mouseId={subject.id} onLogCreated={handleLogCreated} />
        </div>
      </div>

      {/* Bottom: Data Library */}
      <div className="glass-panel rounded-3xl p-6 flex flex-col gap-4 flex-1 min-h-0">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-semibold">Project: {subject.cohorts?.name || 'Unassigned'}</h3>
            <h2 className="text-2xl font-bold">Data Library</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search" 
              className="pl-9 bg-white/40 border-white/20 rounded-full w-64"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 overflow-y-auto pr-2 pb-2">
          {logs.map((log) => (
            <div 
              key={log.id} 
              className={`group cursor-pointer ${selectedLog?.id === log.id ? 'ring-2 ring-primary rounded-xl' : ''}`}
              onClick={() => setSelectedLog(log)}
            >
              <div className="aspect-video rounded-xl bg-muted overflow-hidden relative mb-2 border border-white/20 shadow-sm group-hover:shadow-md transition-all">
                <img src={log.image_url} alt={log.stage} className="w-full h-full object-cover" 
                  onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/400x300/png?text=Scan';
                  }}
                />
                <div className="absolute top-2 right-2">
                  <Badge className={`
                    text-[10px] px-1.5 py-0.5 h-5 backdrop-blur-md border-0
                    ${log.stage === 'Proestrus' ? 'bg-blue-500/80 text-white' : 
                      log.stage === 'Estrus' ? 'bg-red-500/80 text-white' : 'bg-gray-500/80 text-white'}
                  `}>
                    {log.stage}
                  </Badge>
                </div>
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-medium">{format(new Date(log.created_at), 'MMM d, yyyy')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
