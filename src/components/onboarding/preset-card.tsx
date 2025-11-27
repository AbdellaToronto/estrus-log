'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CohortConfig } from '@/lib/config-types';
import { 
  Mouse, 
  Microscope, 
  Leaf, 
  Heart, 
  Settings,
  LucideIcon,
  Check
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Mouse,
  Microscope,
  Leaf,
  Heart,
  Settings,
};

interface PresetCardProps {
  preset: CohortConfig;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}

export function PresetCard({ preset, isSelected, onSelect, index }: PresetCardProps) {
  const Icon = ICONS[preset.icon || 'Settings'] || Settings;
  const primaryColor = preset.logConfig.stages[0]?.color || '#3B82F6';
  
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      onClick={onSelect}
      className={cn(
        "relative group text-left p-6 rounded-3xl border-2 transition-all duration-300",
        "hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
        isSelected 
          ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" 
          : "border-slate-200 bg-white/60 hover:border-slate-300 hover:bg-white/80"
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-4 right-4 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
        >
          <Check className="w-4 h-4 text-white" />
        </motion.div>
      )}

      {/* Icon */}
      <div 
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors",
          isSelected ? "bg-primary/10" : "bg-slate-100 group-hover:bg-slate-200"
        )}
        style={{ 
          backgroundColor: isSelected ? `${primaryColor}20` : undefined,
        }}
      >
        <Icon 
          className="w-7 h-7 transition-colors"
          style={{ color: isSelected ? primaryColor : '#64748b' }}
        />
      </div>

      {/* Title & Description */}
      <h3 className={cn(
        "font-bold text-lg mb-2 transition-colors",
        isSelected ? "text-slate-900" : "text-slate-700"
      )}>
        {preset.name}
      </h3>
      <p className="text-sm text-slate-500 mb-4 line-clamp-2">
        {preset.description}
      </p>

      {/* Stage preview */}
      <div className="flex gap-1.5 flex-wrap">
        {preset.logConfig.stages.slice(0, 4).map((stage, i) => (
          <span
            key={stage.name}
            className="text-[10px] font-medium px-2 py-1 rounded-full text-white"
            style={{ backgroundColor: stage.color }}
          >
            {stage.name}
          </span>
        ))}
        {preset.logConfig.stages.length > 4 && (
          <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-slate-200 text-slate-600">
            +{preset.logConfig.stages.length - 4}
          </span>
        )}
      </div>

      {/* Subject type hint */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <span className="text-xs text-slate-400">
          Tracks: <span className="font-medium text-slate-600">{preset.subjectConfig.labelPlural}</span>
        </span>
      </div>
    </motion.button>
  );
}

