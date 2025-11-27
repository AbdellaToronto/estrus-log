'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Circle, Sparkles, Scan, Brain, Target } from 'lucide-react';

export type ProgressStep = {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'complete' | 'error';
  detail?: string;
};

interface AnalysisProgressProps {
  steps: ProgressStep[];
  className?: string;
}

const STEP_ICONS: Record<string, typeof Scan> = {
  upload: Scan,
  segment: Target,
  analyze: Brain,
  classify: Sparkles,
};

export function AnalysisProgress({ steps, className = '' }: AnalysisProgressProps) {
  const currentStepIndex = steps.findIndex(s => s.status === 'in_progress');
  const progress = steps.filter(s => s.status === 'complete').length / steps.length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall progress bar */}
      <div className="relative">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        
        {/* Shimmer effect when in progress */}
        <AnimatePresence>
          {currentStepIndex >= 0 && (
            <motion.div
              className="absolute inset-0 h-1.5 rounded-full overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ['-100%', '400%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Step list */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[step.id] || Circle;
          const isActive = step.status === 'in_progress';
          const isComplete = step.status === 'complete';
          const isPending = step.status === 'pending';

          return (
            <motion.div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-primary/5 border border-primary/20' 
                  : isComplete 
                    ? 'bg-muted/30' 
                    : 'opacity-50'
              }`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {/* Status icon */}
              <div className={`relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                isComplete 
                  ? 'bg-green-500/10 text-green-500' 
                  : isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-muted text-muted-foreground'
              }`}>
                <AnimatePresence mode="wait">
                  {isComplete ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Check className="w-4 h-4" />
                    </motion.div>
                  ) : isActive ? (
                    <motion.div
                      key="loading"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <motion.div key="icon">
                      <Icon className="w-4 h-4" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pulse effect for active step */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-primary/20"
                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${
                  isActive ? 'text-foreground' : isComplete ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {step.label}
                </div>
                {step.detail && (
                  <motion.div
                    className="text-xs text-muted-foreground truncate"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.2 }}
                  >
                    {step.detail}
                  </motion.div>
                )}
              </div>

              {/* Time indicator for complete steps */}
              {isComplete && (
                <motion.span
                  className="text-xs text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  ✓
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}




