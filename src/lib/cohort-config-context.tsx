"use client";

import { createContext, useContext, useMemo, ReactNode } from "react";
import {
  CohortConfig,
  parseCohortConfig,
  getPresetConfig,
  getStageColor,
  getStageGradient,
  getStageConfig,
  StageConfig,
} from "./config-types";

// =============================================================================
// Context
// =============================================================================

type CohortConfigContextValue = {
  config: CohortConfig;
  // Convenience helpers
  stages: StageConfig[];
  stageNames: string[];
  getColor: (stageName: string) => string;
  getGradient: (stageName: string) => string;
  getStage: (stageName: string) => StageConfig | undefined;
  subjectLabel: string;
  subjectLabelPlural: string;
  aiPrompt: string;
};

const CohortConfigContext = createContext<CohortConfigContextValue | null>(
  null
);

// =============================================================================
// Provider
// =============================================================================

type CohortConfigProviderProps = {
  children: ReactNode;
  cohort?: {
    type?: string | null;
    log_config?: unknown;
    subject_config?: unknown;
  } | null;
  // Or provide config directly
  config?: CohortConfig;
};

export function CohortConfigProvider({
  children,
  cohort,
  config: directConfig,
}: CohortConfigProviderProps) {
  const config = useMemo(() => {
    if (directConfig) return directConfig;
    if (cohort) {
      return parseCohortConfig(
        cohort.type,
        cohort.log_config,
        cohort.subject_config
      );
    }
    return getPresetConfig("estrus_tracking"); // Default fallback
  }, [cohort, directConfig]);

  const value = useMemo<CohortConfigContextValue>(
    () => ({
      config,
      stages: config.logConfig.stages,
      stageNames: config.logConfig.stages.map((s) => s.name),
      getColor: (stageName: string) => getStageColor(config, stageName),
      getGradient: (stageName: string) => getStageGradient(config, stageName),
      getStage: (stageName: string) => getStageConfig(config, stageName),
      subjectLabel: config.subjectConfig.labelSingular || "Subject",
      subjectLabelPlural: config.subjectConfig.labelPlural || "Subjects",
      aiPrompt: config.logConfig.aiPrompt || "subject",
    }),
    [config]
  );

  return (
    <CohortConfigContext.Provider value={value}>
      {children}
    </CohortConfigContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useCohortConfig(): CohortConfigContextValue {
  const context = useContext(CohortConfigContext);

  if (!context) {
    // Return a default config if used outside provider
    // This makes it safe to use in components that might be rendered
    // before the cohort is loaded
    const defaultConfig = getPresetConfig("estrus_tracking");
    return {
      config: defaultConfig,
      stages: defaultConfig.logConfig.stages,
      stageNames: defaultConfig.logConfig.stages.map((s) => s.name),
      getColor: (stageName: string) => getStageColor(defaultConfig, stageName),
      getGradient: (stageName: string) =>
        getStageGradient(defaultConfig, stageName),
      getStage: (stageName: string) => getStageConfig(defaultConfig, stageName),
      subjectLabel: defaultConfig.subjectConfig.labelSingular || "Subject",
      subjectLabelPlural: defaultConfig.subjectConfig.labelPlural || "Subjects",
      aiPrompt: defaultConfig.logConfig.aiPrompt || "subject",
    };
  }

  return context;
}

// =============================================================================
// Standalone helper for when you have cohort data but no context
// =============================================================================

export function useParsedCohortConfig(
  cohort?: {
    type?: string | null;
    log_config?: unknown;
    subject_config?: unknown;
  } | null
): CohortConfigContextValue {
  return useMemo(() => {
    const config = cohort
      ? parseCohortConfig(cohort.type, cohort.log_config, cohort.subject_config)
      : getPresetConfig("estrus_tracking");

    return {
      config,
      stages: config.logConfig.stages,
      stageNames: config.logConfig.stages.map((s) => s.name),
      getColor: (stageName: string) => getStageColor(config, stageName),
      getGradient: (stageName: string) => getStageGradient(config, stageName),
      getStage: (stageName: string) => getStageConfig(config, stageName),
      subjectLabel: config.subjectConfig.labelSingular || "Subject",
      subjectLabelPlural: config.subjectConfig.labelPlural || "Subjects",
      aiPrompt: config.logConfig.aiPrompt || "subject",
    };
  }, [cohort]);
}
