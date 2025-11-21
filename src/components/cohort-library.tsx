'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Grid, 
  List as ListIcon,
  SlidersHorizontal,
  ArrowUpDown,
  Download
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

type Log = {
  id: string;
  stage: string;
  confidence: any;
  created_at: string;
  image_url: string | null;
  subjectName: string;
  notes: string | null;
};

const STAGES = ["Proestrus", "Estrus", "Metestrus", "Diestrus", "Uncertain"];

export function CohortLibrary({ logs }: { logs: Log[] }) {
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<'none' | 'subject' | 'date'>('none');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'confidence'>('newest');
  const [selectedStages, setSelectedStages] = useState<string[]>([]);

  // -- Filtering & Sorting --
  const filteredLogs = useMemo(() => {
    let result = logs;

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(log => 
        log.subjectName.toLowerCase().includes(q) || 
        log.stage.toLowerCase().includes(q) ||
        (log.notes && log.notes.toLowerCase().includes(q))
      );
    }

    // Stage Filter
    if (selectedStages.length > 0) {
      result = result.filter(log => selectedStages.includes(log.stage));
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'confidence') {
         const confA = typeof a.confidence === 'number' ? a.confidence : a.confidence?.score ?? 0;
         const confB = typeof b.confidence === 'number' ? b.confidence : b.confidence?.score ?? 0;
         return confB - confA;
      }
      return 0;
    });

    return result;
  }, [logs, search, selectedStages, sortBy]);

  // -- Grouping --
  const groupedLogs = useMemo(() => {
    if (groupBy === 'none') return { 'All Assets': filteredLogs };

    const groups: Record<string, Log[]> = {};
    
    filteredLogs.forEach(log => {
      let key = 'Other';
      if (groupBy === 'subject') key = log.subjectName;
      if (groupBy === 'date') key = new Date(log.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });

    return groups;
  }, [filteredLogs, groupBy]);

  const toggleStage = (stage: string) => {
    setSelectedStages(prev => 
      prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
    );
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white/50 backdrop-blur-xl p-4 rounded-2xl border border-white/50 shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search assets..." 
              className="pl-9 bg-white border-slate-200 rounded-full h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full h-10 w-10 shrink-0 bg-white">
                <Filter className={`w-4 h-4 ${selectedStages.length > 0 ? 'text-primary fill-primary/20' : 'text-slate-500'}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Filter by Stage</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STAGES.map(stage => (
                <DropdownMenuCheckboxItem 
                  key={stage}
                  checked={selectedStages.includes(stage)}
                  onCheckedChange={() => toggleStage(stage)}
                >
                  <span className={`w-2 h-2 rounded-full mr-2 
                    ${stage === 'Estrus' ? 'bg-red-500' : 
                      stage === 'Proestrus' ? 'bg-pink-500' : 
                      stage === 'Diestrus' ? 'bg-purple-500' : 
                      stage === 'Metestrus' ? 'bg-orange-500' : 'bg-slate-500'}`} 
                  />
                  {stage}
                </DropdownMenuCheckboxItem>
              ))}
              {selectedStages.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setSelectedStages([])} className="text-slate-500 justify-center text-xs">
                    Clear Filters
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-x-auto">
           <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
             <SelectTrigger className="w-[140px] rounded-full bg-white h-10 border-slate-200">
               <SelectValue placeholder="Group By" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="none">No Grouping</SelectItem>
               <SelectItem value="subject">Subject</SelectItem>
               <SelectItem value="date">Date</SelectItem>
             </SelectContent>
           </Select>

           <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
             <SelectTrigger className="w-[140px] rounded-full bg-white h-10 border-slate-200">
               <SelectValue placeholder="Sort By" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="newest">Newest First</SelectItem>
               <SelectItem value="oldest">Oldest First</SelectItem>
               <SelectItem value="confidence">Confidence</SelectItem>
             </SelectContent>
           </Select>
           
           <div className="h-6 w-px bg-slate-200 mx-1" />

           <div className="bg-slate-100 p-1 rounded-full flex items-center">
              <Button 
                variant="ghost" 
                size="icon" 
                className={`h-8 w-8 rounded-full ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className={`h-8 w-8 rounded-full ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                onClick={() => setViewMode('list')}
              >
                <ListIcon className="w-4 h-4" />
              </Button>
           </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-8">
        {Object.entries(groupedLogs).map(([groupName, groupLogs]) => (
          <div key={groupName} className="space-y-4">
            {groupBy !== 'none' && (
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-700 text-lg">{groupName}</h3>
                <Badge variant="secondary" className="bg-slate-100 text-slate-500">{groupLogs.length}</Badge>
              </div>
            )}
            
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <AnimatePresence initial={false}>
                  {groupLogs.map((log) => (
                    <LogCard key={log.id} log={log} />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {groupLogs.map((log) => (
                    <LogListItem key={log.id} log={log} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        ))}
        
        {filteredLogs.length === 0 && (
           <div className="text-center py-20">
             <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
               <Search className="w-8 h-8 text-slate-300" />
             </div>
             <h3 className="text-slate-900 font-medium">No assets found</h3>
             <p className="text-slate-500 text-sm">Try adjusting your filters or search query</p>
           </div>
        )}
      </div>
    </div>
  );
}

function LogCard({ log }: { log: Log }) {
  const confidence = typeof log.confidence === 'number' ? log.confidence : log.confidence?.score ?? 0;
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer"
    >
      {/* Image */}
      {log.image_url ? (
        <div className="absolute inset-0 bg-slate-100">
           <img src={log.image_url} alt={log.subjectName} className="w-full h-full object-cover" />
           <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center text-slate-300">
          <User className="w-12 h-12" />
        </div>
      )}
      
      {/* Stage Badge (Always visible) */}
      <div className="absolute top-2 right-2">
        <Badge className={`
          backdrop-blur-md shadow-sm border-0 font-medium bg-white/90 text-slate-800
        `}>
          {log.stage}
        </Badge>
      </div>

      {/* Overlay Content (Hover) */}
      <div className="absolute bottom-0 left-0 right-0 p-4 text-white opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
         <div className="font-bold text-lg">{log.subjectName}</div>
         <div className="text-xs text-white/80 flex justify-between items-center mt-1">
            <span>{new Date(log.created_at).toLocaleDateString()}</span>
            <span>{(confidence * 100).toFixed(0)}% conf</span>
         </div>
      </div>
    </motion.div>
  );
}

function LogListItem({ log }: { log: Log }) {
  const confidence = typeof log.confidence === 'number' ? log.confidence : log.confidence?.score ?? 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-4 p-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-primary/20 transition-colors"
    >
      <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">
        {log.image_url && (
          <img src={log.image_url} alt={log.subjectName} className="w-full h-full object-cover" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">{log.subjectName}</span>
          <Badge variant="outline" className="text-xs font-normal bg-slate-50">{log.stage}</Badge>
        </div>
        <div className="text-xs text-slate-500 truncate">
          {new Date(log.created_at).toLocaleString()} • {(confidence * 100).toFixed(0)}% confidence
        </div>
      </div>

      {log.notes && (
        <div className="hidden md:block text-sm text-slate-600 max-w-xs truncate italic">
          "{log.notes}"
        </div>
      )}
      
      <Button variant="ghost" size="sm" className="text-slate-400 hover:text-primary">
         View
      </Button>
    </motion.div>
  );
}

