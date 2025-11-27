'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PresetCard } from './preset-card';
import { PRESET_CONFIGS, CohortConfig } from '@/lib/config-types';
import { createCohort } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Loader2,
  FlaskConical,
  Upload,
  BarChart3,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'welcome' | 'preset' | 'details' | 'ready';

const PRESETS = Object.values(PRESET_CONFIGS).filter(p => p.type !== 'custom');

export function OnboardingFlow({ onComplete }: { onComplete?: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [selectedPreset, setSelectedPreset] = useState<CohortConfig | null>(null);
  const [cohortName, setCohortName] = useState('');
  const [cohortDescription, setCohortDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdCohortId, setCreatedCohortId] = useState<string | null>(null);

  const canProceed = () => {
    switch (step) {
      case 'welcome': return true;
      case 'preset': return selectedPreset !== null;
      case 'details': return cohortName.trim().length > 0;
      case 'ready': return true;
      default: return false;
    }
  };

  const handleNext = async () => {
    switch (step) {
      case 'welcome':
        setStep('preset');
        break;
      case 'preset':
        setStep('details');
        // Pre-fill name based on preset
        if (selectedPreset && !cohortName) {
          setCohortName(`My ${selectedPreset.subjectConfig.labelPlural || 'Subjects'}`);
        }
        break;
      case 'details':
        await createCohortAndProceed();
        break;
      case 'ready':
        if (createdCohortId) {
          router.push(`/cohorts/${createdCohortId}/batch`);
        }
        onComplete?.();
        break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'preset': setStep('welcome'); break;
      case 'details': setStep('preset'); break;
      case 'ready': setStep('details'); break;
    }
  };

  const createCohortAndProceed = async () => {
    if (!selectedPreset) return;
    
    setIsCreating(true);
    try {
      const formData = new FormData();
      formData.set('name', cohortName);
      formData.set('description', cohortDescription);
      formData.set('type', selectedPreset.type);
      formData.set('subject_config', JSON.stringify(selectedPreset.subjectConfig));
      formData.set('log_config', JSON.stringify(selectedPreset.logConfig));
      
      // createCohort doesn't return the ID, so we need to fetch it
      await createCohort(formData);
      
      // For now, redirect to cohorts page - in a real app we'd get the ID back
      setStep('ready');
      // We'll need to fetch the cohort ID - for now just go to cohorts
      setCreatedCohortId(null);
    } catch (error) {
      console.error('Failed to create cohort:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center p-4 overflow-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl"
      >
        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            {(['welcome', 'preset', 'details', 'ready'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center">
                <motion.div
                  className={cn(
                    "w-3 h-3 rounded-full transition-colors",
                    step === s ? "bg-primary scale-125" : 
                    (['welcome', 'preset', 'details', 'ready'].indexOf(step) > i) ? "bg-primary/50" : "bg-slate-200"
                  )}
                  animate={{ scale: step === s ? 1.25 : 1 }}
                />
                {i < 3 && (
                  <div className={cn(
                    "w-12 h-0.5 mx-1",
                    (['welcome', 'preset', 'details', 'ready'].indexOf(step) > i) ? "bg-primary/50" : "bg-slate-200"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-24 h-24 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-primary/10"
              >
                <FlaskConical className="w-12 h-12 text-primary" />
              </motion.div>
              
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
                Welcome to <span className="text-primary">Estrus Log</span>
              </h1>
              <p className="text-xl text-slate-500 mb-12 max-w-lg mx-auto">
                AI-powered image classification for biological research. 
                Let&apos;s set up your first project in under a minute.
              </p>

              {/* Feature highlights */}
              <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-2xl mx-auto">
                {[
                  { icon: Upload, title: 'Batch Upload', desc: 'Drop images or ZIPs' },
                  { icon: Zap, title: 'AI Classification', desc: 'Instant analysis' },
                  { icon: BarChart3, title: 'Track Progress', desc: 'Beautiful insights' },
                ].map((feature, i) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-white/50 shadow-sm"
                  >
                    <feature.icon className="w-8 h-8 text-primary/70 mb-2 mx-auto" />
                    <h3 className="font-semibold text-slate-800">{feature.title}</h3>
                    <p className="text-sm text-slate-500">{feature.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'preset' && (
            <motion.div
              key="preset"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">
                  What are you tracking?
                </h2>
                <p className="text-slate-500">
                  Choose a template to get started quickly, or customize later.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-8">
                {PRESETS.map((preset, i) => (
                  <PresetCard
                    key={preset.type}
                    preset={preset}
                    isSelected={selectedPreset?.type === preset.type}
                    onSelect={() => setSelectedPreset(preset)}
                    index={i}
                  />
                ))}
              </div>

              <p className="text-center text-sm text-slate-400">
                Don&apos;t see what you need? You can fully customize stages and fields later.
              </p>
            </motion.div>
          )}

          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">
                  Name your project
                </h2>
                <p className="text-slate-500">
                  This is a cohort - a group of {selectedPreset?.subjectConfig.labelPlural?.toLowerCase() || 'subjects'} you&apos;re tracking together.
                </p>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-white/50 shadow-xl space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                    Cohort Name *
                  </Label>
                  <Input
                    id="name"
                    value={cohortName}
                    onChange={(e) => setCohortName(e.target.value)}
                    placeholder={`e.g., "Control Group" or "Batch ${new Date().toLocaleDateString()}"`}
                    className="h-12 text-lg rounded-xl border-slate-200 focus:border-primary"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-semibold text-slate-700">
                    Description <span className="text-slate-400 font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="description"
                    value={cohortDescription}
                    onChange={(e) => setCohortDescription(e.target.value)}
                    placeholder="What's this cohort for?"
                    className="h-12 rounded-xl border-slate-200 focus:border-primary"
                  />
                </div>

                {selectedPreset && (
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400 mb-2">Template</p>
                    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                      <div className="flex gap-1">
                        {selectedPreset.logConfig.stages.slice(0, 3).map((stage) => (
                          <div
                            key={stage.name}
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{selectedPreset.name}</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-24 h-24 bg-gradient-to-br from-green-400/20 to-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-500/10"
              >
                <Sparkles className="w-12 h-12 text-green-500" />
              </motion.div>
              
              <h2 className="text-4xl font-bold text-slate-900 mb-4">
                You&apos;re all set! 🎉
              </h2>
              <p className="text-xl text-slate-500 mb-8 max-w-lg mx-auto">
                Your cohort <strong className="text-slate-700">&quot;{cohortName}&quot;</strong> is ready.
                Let&apos;s upload your first batch of images!
              </p>

              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-sm max-w-md mx-auto mb-8">
                <h3 className="font-semibold text-slate-800 mb-3">Next steps:</h3>
                <ol className="text-left text-sm text-slate-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                    Drop images or a ZIP file into the upload area
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                    Click &quot;Analyze&quot; to classify with AI
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
                    Review results and assign to {selectedPreset?.subjectConfig.labelPlural?.toLowerCase() || 'subjects'}
                  </li>
                </ol>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={step === 'welcome'}
            className={cn(
              "gap-2 text-slate-500 hover:text-slate-700",
              step === 'welcome' && "invisible"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canProceed() || isCreating}
            size="lg"
            className="gap-2 px-8 rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-105 active:scale-95"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : step === 'ready' ? (
              <>
                Start Uploading
                <ArrowRight className="w-4 h-4" />
              </>
            ) : step === 'details' ? (
              <>
                Create Cohort
                <Sparkles className="w-4 h-4" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

