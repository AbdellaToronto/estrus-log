'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { StageConfig } from '@/lib/config-types';

interface CycleWheelProps {
  /** Confidence scores keyed by stage name */
  confidences: Record<string, number>;
  /** The predicted/selected stage name */
  predictedStage?: string;
  /** Whether analysis is in progress */
  isAnalyzing?: boolean;
  /** Size in pixels */
  size?: number;
  /** Stage configurations - if not provided, uses default estrus stages */
  stages?: StageConfig[];
}

// Default stages for backwards compatibility
const DEFAULT_STAGES: StageConfig[] = [
  { name: 'Proestrus', color: '#F472B6', lightColor: '#FBCFE8' },
  { name: 'Estrus', color: '#EF4444', lightColor: '#FECACA' },
  { name: 'Metestrus', color: '#A855F7', lightColor: '#E9D5FF' },
  { name: 'Diestrus', color: '#3B82F6', lightColor: '#BFDBFE' },
];

export function CycleWheel({ 
  confidences, 
  predictedStage, 
  isAnalyzing = false,
  size = 280,
  stages = DEFAULT_STAGES,
}: CycleWheelProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate angles for each stage based on count
  const stagesWithAngles = useMemo(() => {
    const count = stages.length;
    const anglePerStage = 360 / count;
    
    return stages.map((stage, i) => ({
      ...stage,
      // Start angle offset so first stage is at top-right
      angle: (i * anglePerStage) + (anglePerStage / 2) - 90,
      startAngle: (i * anglePerStage - anglePerStage / 2) * (Math.PI / 180),
      endAngle: ((i + 1) * anglePerStage - anglePerStage / 2) * (Math.PI / 180),
    }));
  }, [stages]);

  // Calculate marker position based on weighted confidences
  const calculatePosition = () => {
    if (!confidences) return 0;
    
    let x = 0, y = 0;
    stagesWithAngles.forEach((stage) => {
      const conf = confidences[stage.name] || 0;
      const angleRad = (stage.angle * Math.PI) / 180;
      x += Math.cos(angleRad) * conf;
      y += Math.sin(angleRad) * conf;
    });
    
    return Math.atan2(y, x) * (180 / Math.PI);
  };

  const markerAngle = calculatePosition();
  const radius = size / 2 - 40;
  const center = size / 2;

  // Calculate marker position on the circle
  const markerX = center + radius * 0.7 * Math.cos((markerAngle * Math.PI) / 180);
  const markerY = center + radius * 0.7 * Math.sin((markerAngle * Math.PI) / 180);

  // Get confidence for predicted stage
  const predictedConfidence = predictedStage ? (confidences?.[predictedStage] || 0) : 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted/20"
        />

        {/* Stage segments */}
        {stagesWithAngles.map((stage, i) => {
          const conf = confidences?.[stage.name] || 0;
          
          const innerRadius = radius * 0.5;
          const outerRadius = radius * (0.5 + conf * 0.5);
          
          const x1 = center + innerRadius * Math.cos(stage.startAngle);
          const y1 = center + innerRadius * Math.sin(stage.startAngle);
          const x2 = center + outerRadius * Math.cos(stage.startAngle);
          const y2 = center + outerRadius * Math.sin(stage.startAngle);
          const x3 = center + outerRadius * Math.cos(stage.endAngle);
          const y3 = center + outerRadius * Math.sin(stage.endAngle);
          const x4 = center + innerRadius * Math.cos(stage.endAngle);
          const y4 = center + innerRadius * Math.sin(stage.endAngle);

          // Use large arc if segment is > 180 degrees
          const largeArc = (stage.endAngle - stage.startAngle) > Math.PI ? 1 : 0;

          const pathD = `
            M ${x1} ${y1}
            L ${x2} ${y2}
            A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x3} ${y3}
            L ${x4} ${y4}
            A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1} ${y1}
          `;

          return (
            <motion.path
              key={stage.name}
              d={pathD}
              fill={stage.color}
              opacity={predictedStage === stage.name ? 1 : 0.6}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: predictedStage === stage.name ? 1 : 0.6,
                scale: 1 
              }}
              transition={{ 
                duration: 0.5, 
                delay: mounted ? i * 0.1 : 0,
                ease: "easeOut"
              }}
              className={predictedStage === stage.name ? 'drop-shadow-lg' : ''}
            />
          );
        })}

        {/* Stage labels on the outside */}
        {stagesWithAngles.map((stage) => {
          const labelAngle = (stage.angle + 90) * (Math.PI / 180); // Adjust for SVG rotation
          const labelRadius = radius + 25;
          const x = center + labelRadius * Math.cos(labelAngle);
          const y = center + labelRadius * Math.sin(labelAngle);

          // Abbreviate long names
          const label = stage.name.length > 6 
            ? stage.name.slice(0, 3).toUpperCase() 
            : stage.name.toUpperCase();

          return (
            <g key={`label-${stage.name}`} transform={`rotate(90, ${center}, ${center})`}>
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xs font-medium fill-foreground"
                style={{ fontSize: '11px' }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Animated marker */}
      <AnimatePresence>
        {!isAnalyzing && confidences && Object.keys(confidences).length > 0 && (
          <motion.div
            className="absolute w-5 h-5 rounded-full bg-white border-2 border-foreground shadow-lg"
            style={{
              left: markerX - 10,
              top: markerY - 10,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: 1, 
              opacity: 1,
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 300,
              damping: 20,
              delay: 0.5
            }}
          >
            {/* Pulse effect */}
            <motion.div
              className="absolute inset-0 rounded-full bg-white"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spinning indicator when analyzing */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {isAnalyzing ? (
            <motion.span
              key="analyzing"
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              Analyzing...
            </motion.span>
          ) : predictedStage ? (
            <motion.div
              key="result"
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <span className="text-2xl font-bold text-foreground">
                {predictedStage}
              </span>
              <br />
              <span className="text-sm text-muted-foreground">
                {Math.round(predictedConfidence * 100)}% confident
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
