'use client';

import { motion } from 'framer-motion';
import { StageConfig } from '@/lib/config-types';

interface ConfidenceBarsProps {
  /** Confidence scores keyed by stage name */
  confidences: Record<string, number>;
  /** The predicted/selected stage name */
  predictedStage?: string;
  /** Whether to animate the bars */
  animated?: boolean;
  /** Stage configurations - if not provided, uses default estrus stages */
  stages?: StageConfig[];
}

// Default stages for backwards compatibility
const DEFAULT_STAGES: StageConfig[] = [
  { name: 'Proestrus', color: '#F472B6' },
  { name: 'Estrus', color: '#EF4444' },
  { name: 'Metestrus', color: '#A855F7' },
  { name: 'Diestrus', color: '#3B82F6' },
];

export function ConfidenceBars({ 
  confidences, 
  predictedStage,
  animated = true,
  stages = DEFAULT_STAGES,
}: ConfidenceBarsProps) {
  return (
    <div className="space-y-3">
      {stages.map((stage, index) => {
        const confidence = confidences?.[stage.name] || 0;
        const percentage = Math.round(confidence * 100);
        const isPredicted = predictedStage === stage.name;

        return (
          <div key={stage.name} className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className={`font-medium ${isPredicted ? 'text-foreground' : 'text-muted-foreground'}`}>
                {stage.name}
                {isPredicted && (
                  <motion.span
                    className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    Predicted
                  </motion.span>
                )}
              </span>
              <motion.span 
                className={`tabular-nums ${isPredicted ? 'font-bold text-foreground' : 'text-muted-foreground'}`}
                initial={animated ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
              >
                {percentage}%
              </motion.span>
            </div>
            
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${isPredicted ? 'shadow-sm' : 'opacity-70'}`}
                style={{ backgroundColor: stage.color }}
                initial={animated ? { width: 0 } : { width: `${percentage}%` }}
                animate={{ width: `${percentage}%` }}
                transition={{
                  duration: 0.8,
                  delay: animated ? 0.2 + index * 0.1 : 0,
                  ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuad
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
