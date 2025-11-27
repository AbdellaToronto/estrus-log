'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CycleWheel } from './cycle-wheel';
import { ConfidenceBars } from './confidence-bars';
import { MaskOverlay } from './mask-overlay';
import { AnalysisProgress, type ProgressStep } from './analysis-progress';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AnalysisResultProps {
  imageUrl: string;
  croppedImageUrl?: string;
  maskImageUrl?: string;
  result?: {
    estrus_stage: string;
    confidence_scores: {
      Proestrus: number;
      Estrus: number;
      Metestrus: number;
      Diestrus: number;
    };
    features?: {
      color?: string;
      opening?: string;
      swelling?: string;
      moistness?: string;
    };
    reasoning?: string;
  };
  status: 'pending' | 'uploading' | 'segmenting' | 'analyzing' | 'complete' | 'error';
  progressSteps?: ProgressStep[];
  createdAt?: string;
  className?: string;
}

const DEFAULT_PROGRESS_STEPS: ProgressStep[] = [
  { id: 'upload', label: 'Uploading image', status: 'pending' },
  { id: 'segment', label: 'Detecting region of interest', status: 'pending' },
  { id: 'analyze', label: 'Extracting features', status: 'pending' },
  { id: 'classify', label: 'Classifying estrus stage', status: 'pending' },
];

export function AnalysisResult({
  imageUrl,
  croppedImageUrl,
  maskImageUrl,
  result,
  status,
  progressSteps = DEFAULT_PROGRESS_STEPS,
  createdAt,
  className = '',
}: AnalysisResultProps) {
  const isComplete = status === 'complete' && result;
  const isAnalyzing = status !== 'complete' && status !== 'error' && status !== 'pending';

  // Map status to MaskOverlay stage
  const maskStage = status === 'pending' 
    ? 'uploading' 
    : status === 'uploading'
      ? 'uploading'
      : status === 'segmenting'
        ? 'segmenting'
        : status === 'analyzing'
          ? 'segmented'
          : 'complete';

  return (
    <div className={`grid gap-6 ${className}`}>
      {/* Top row: Image + Progress/Result */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Image with mask overlay */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <MaskOverlay
              originalUrl={imageUrl}
              croppedUrl={croppedImageUrl}
              maskUrl={maskImageUrl}
              stage={maskStage}
              className="w-full"
            />
          </CardContent>
        </Card>

        {/* Progress or Results */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {isComplete ? 'Analysis Results' : 'Analysis Progress'}
              </CardTitle>
              {createdAt && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {new Date(createdAt).toLocaleTimeString()}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!isComplete ? (
              <AnalysisProgress steps={progressSteps} />
            ) : (
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {/* Cycle wheel */}
                <div className="flex justify-center">
                  <CycleWheel
                    confidences={result.confidence_scores}
                    predictedStage={result.estrus_stage}
                    isAnalyzing={isAnalyzing}
                    size={200}
                  />
                </div>

                {/* Confidence bars */}
                <ConfidenceBars
                  confidences={result.confidence_scores}
                  predictedStage={result.estrus_stage}
                />
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Details (only when complete) */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  Analysis Details
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Features extracted using BioCLIP + k-NN classification</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  BioCLIP v1
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Features */}
                {result.features && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Observed Features
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(result.features).map(([key, value]) => (
                        <div
                          key={key}
                          className="bg-muted/50 rounded-lg p-3"
                        >
                          <div className="text-xs text-muted-foreground capitalize">
                            {key}
                          </div>
                          <div className="text-sm font-medium truncate">
                            {value || 'N/A'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reasoning */}
                {result.reasoning && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Classification Reasoning
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {result.reasoning}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}




