'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MaskOverlayProps {
  originalUrl: string;
  croppedUrl?: string;
  maskUrl?: string;
  stage?: 'uploading' | 'segmenting' | 'segmented' | 'analyzing' | 'complete';
  className?: string;
}

export function MaskOverlay({
  originalUrl,
  croppedUrl,
  maskUrl,
  stage = 'uploading',
  className = '',
}: MaskOverlayProps) {
  const [showCropped, setShowCropped] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (stage === 'complete' && croppedUrl) {
      // Auto-show cropped after a delay
      const timer = setTimeout(() => setShowCropped(true), 500);
      return () => clearTimeout(timer);
    }
  }, [stage, croppedUrl]);

  return (
    <div className={`relative ${className}`}>
      {/* Main image container */}
      <motion.div
        className={`relative overflow-hidden rounded-xl bg-muted ${
          isExpanded ? 'fixed inset-4 z-50' : 'aspect-square'
        }`}
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Original image */}
        <div className="relative w-full h-full">
          <Image
            src={originalUrl}
            alt="Original scan"
            fill
            className={`object-cover transition-all duration-500 ${
              showCropped ? 'opacity-30 blur-sm scale-105' : 'opacity-100'
            }`}
          />
        </div>

        {/* Animated mask overlay */}
        <AnimatePresence>
          {(stage === 'segmenting' || stage === 'segmented') && !showCropped && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Scanning line animation */}
              <motion.div
                className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent"
                initial={{ top: 0 }}
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />

              {/* Pulsing detection box */}
              <motion.div
                className="w-32 h-32 border-2 border-primary rounded-lg"
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 1, 0.5],
                  borderColor: ['hsl(var(--primary))', 'hsl(var(--primary) / 0.5)', 'hsl(var(--primary))'],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {/* Corner markers */}
                {['-top-1 -left-1', '-top-1 -right-1', '-bottom-1 -left-1', '-bottom-1 -right-1'].map((pos, i) => (
                  <motion.div
                    key={i}
                    className={`absolute w-3 h-3 border-2 border-primary ${pos}`}
                    style={{
                      borderTop: pos.includes('bottom') ? 'none' : undefined,
                      borderBottom: pos.includes('top') ? 'none' : undefined,
                      borderLeft: pos.includes('right') ? 'none' : undefined,
                      borderRight: pos.includes('left') ? 'none' : undefined,
                    }}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
              </motion.div>

              {/* Status text */}
              <motion.div
                className="absolute bottom-4 left-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-3"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <div className="flex items-center gap-2 text-white text-sm">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-primary"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                  <span>Detecting region of interest...</span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cropped result overlay */}
        <AnimatePresence>
          {showCropped && croppedUrl && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center p-8"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="relative w-full h-full max-w-[80%] max-h-[80%]">
                {/* Glow effect behind cropped image */}
                <motion.div
                  className="absolute inset-0 bg-primary/20 blur-xl rounded-2xl"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                
                {/* Cropped image */}
                <motion.div
                  className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border-2 border-white/20"
                  initial={{ rotate: -5 }}
                  animate={{ rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <Image
                    src={croppedUrl}
                    alt="Segmented region"
                    fill
                    className="object-contain bg-black"
                  />
                </motion.div>

                {/* "Segmented" badge */}
                <motion.div
                  className="absolute -top-3 -right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg"
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3, type: "spring" }}
                >
                  ✓ Isolated
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle button */}
        {croppedUrl && stage === 'complete' && (
          <div className="absolute top-3 right-3 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-black/50 hover:bg-black/70 text-white border-0 backdrop-blur-sm"
              onClick={() => setShowCropped(!showCropped)}
            >
              {showCropped ? 'Show Original' : 'Show Segmented'}
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="bg-black/50 hover:bg-black/70 text-white border-0 backdrop-blur-sm w-8 h-8"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        )}

        {/* Stage indicator */}
        {stage !== 'complete' && (
          <div className="absolute top-3 left-3">
            <motion.div
              className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 text-white text-xs"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <motion.div
                className="w-2 h-2 rounded-full bg-primary"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              {stage === 'uploading' && 'Uploading...'}
              {stage === 'segmenting' && 'Segmenting...'}
              {stage === 'segmented' && 'Segmented'}
              {stage === 'analyzing' && 'Analyzing...'}
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* Backdrop for expanded view */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="fixed inset-0 bg-black/80 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsExpanded(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}




