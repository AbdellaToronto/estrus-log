'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, UploadCloud, LayoutGrid, List as ListIcon, Search, BarChart2, FlaskConical } from "lucide-react";
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import { CohortAnalysis } from "@/components/cohort-analysis";
import { CohortLibrary } from "@/components/cohort-library";
import { CohortEvaluation } from "@/components/cohort-evaluation";
import { CohortSubjectsList } from "@/components/cohort-subjects-list";

export function CohortClient({ 
  cohort, 
  initialLogs, 
  initialInsights,
  initialSubjects 
}: { 
  cohort: any, 
  initialLogs: any[], 
  initialInsights: any,
  initialSubjects: any[]
}) {
  const [activeTab, setActiveTab] = useState("analysis");

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 min-h-screen pb-20 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between sticky top-16 lg:top-0 z-30 bg-slate-50/80 backdrop-blur-xl py-3 sm:py-4 -mx-4 px-4 border-b border-slate-200/50">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight truncate">{cohort.name}</h1>
            <Badge variant="secondary" className="bg-white/50 border border-slate-200 text-slate-600 backdrop-blur-md text-xs sm:text-sm flex-shrink-0">
              {cohort.type || 'Estrus Tracking'}
            </Badge>
          </div>
          <p className="text-sm sm:text-base text-slate-500 max-w-md leading-relaxed line-clamp-2">{cohort.description || 'No description provided'}</p>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Link href={`/cohorts/${cohort.id}/batch`}>
            <Button size="default" className="rounded-full h-9 sm:h-11 px-4 sm:px-6 shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-500 transition-all hover:scale-105 active:scale-95 text-sm sm:text-base">
              <UploadCloud className="mr-1.5 sm:mr-2 h-4 w-4" />
              <span className="hidden xs:inline">Upload & </span>Analyze
            </Button>
          </Link>
        </div>
      </div>

      {/* Resume Banner */}
      {initialInsights.totalLogs > 0 && (
         <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-linear-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-200/50 rounded-2xl p-4 flex items-center justify-between backdrop-blur-md"
         >
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600">
               <BarChart2 className="w-4 h-4" />
             </div>
             <div>
               <p className="font-medium text-slate-800 text-sm">Analysis in progress</p>
               <p className="text-xs text-slate-500">{initialInsights.totalLogs} scans processed so far</p>
             </div>
           </div>
         </motion.div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <div className="bg-white/60 p-1 rounded-xl sm:rounded-2xl inline-flex border border-slate-200/60 backdrop-blur-md shadow-xs overflow-x-auto max-w-full">
          <TabsList className="bg-transparent h-auto p-0 gap-0.5 sm:gap-1 flex-nowrap">
            <TabsTrigger 
              value="analysis" 
              className="rounded-lg sm:rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all text-xs sm:text-sm whitespace-nowrap"
            >
              <BarChart2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Analysis</span>
              <span className="xs:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger 
              value="library" 
              className="rounded-lg sm:rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all text-xs sm:text-sm whitespace-nowrap"
            >
              <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Library
            </TabsTrigger>
            <TabsTrigger 
              value="subjects" 
              className="rounded-lg sm:rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all text-xs sm:text-sm whitespace-nowrap"
            >
              <ListIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Subjects
            </TabsTrigger>
            <TabsTrigger 
              value="evaluation" 
              className="rounded-lg sm:rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm transition-all text-xs sm:text-sm whitespace-nowrap"
            >
              <FlaskConical className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Evaluation</span>
              <span className="xs:hidden">Eval</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <TabsContent value="analysis" className="mt-0 focus-visible:ring-0">
              <CohortAnalysis insights={initialInsights} />
            </TabsContent>

            <TabsContent value="library" className="mt-0 focus-visible:ring-0">
              <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 min-h-[400px] sm:min-h-[500px]">
                <CohortLibrary 
                  logs={initialLogs} 
                  subjects={initialSubjects}
                />
              </div>
            </TabsContent>

            <TabsContent value="subjects" className="mt-0 focus-visible:ring-0">
              <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 min-h-[250px] sm:min-h-[300px]">
                <CohortSubjectsList subjects={initialSubjects} />
              </div>
            </TabsContent>
            
            <TabsContent value="evaluation" className="mt-0 focus-visible:ring-0">
              <CohortEvaluation logs={initialLogs} />
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}

