/**
 * Configuration types for flexible, config-driven research tracking.
 * 
 * Cohorts can use preset templates or define custom configurations
 * for stages, colors, subject fields, and AI behavior.
 */

// =============================================================================
// Core Config Types
// =============================================================================

export type StageConfig = {
  name: string;
  color: string;        // Hex color for badges, charts
  lightColor?: string;  // Lighter variant for backgrounds
  gradient?: string;    // Tailwind gradient classes
};

export type LogConfig = {
  stages: StageConfig[];
  stageOrder: "cycle" | "linear";  // cycle = wheel, linear = timeline/bar
  features?: FeatureConfig[];
  aiPrompt?: string;               // SAM3 prompt for segmentation
};

export type FeatureConfig = {
  key: string;
  label: string;
  type: "text" | "select" | "number" | "scale";
  options?: string[];              // For select type
  min?: number;                    // For number/scale
  max?: number;
};

export type SubjectConfig = {
  fields: FieldConfig[];
  labelSingular?: string;          // "Mouse", "Sample", "Subject"
  labelPlural?: string;            // "Mice", "Samples", "Subjects"
};

export type FieldConfig = {
  key: string;
  label: string;
  type: "text" | "date" | "number" | "select";
  required?: boolean;
  options?: string[];              // For select type
};

export type CohortConfig = {
  type: string;
  name: string;
  description?: string;
  icon?: string;                   // Lucide icon name
  logConfig: LogConfig;
  subjectConfig: SubjectConfig;
};

// =============================================================================
// Preset Templates
// =============================================================================

export const PRESET_CONFIGS: Record<string, CohortConfig> = {
  estrus_tracking: {
    type: "estrus_tracking",
    name: "Mouse Estrus Tracking",
    description: "Track estrus cycle stages in laboratory mice",
    icon: "Mouse",
    logConfig: {
      stages: [
        { 
          name: "Proestrus", 
          color: "#F472B6", 
          lightColor: "#FBCFE8",
          gradient: "from-pink-400/80 via-pink-500/70 to-pink-600/60"
        },
        { 
          name: "Estrus", 
          color: "#EF4444", 
          lightColor: "#FECACA",
          gradient: "from-rose-400/80 via-rose-500/70 to-rose-600/60"
        },
        { 
          name: "Metestrus", 
          color: "#A855F7", 
          lightColor: "#E9D5FF",
          gradient: "from-purple-400/80 via-purple-500/70 to-purple-600/60"
        },
        { 
          name: "Diestrus", 
          color: "#3B82F6", 
          lightColor: "#BFDBFE",
          gradient: "from-blue-400/80 via-blue-500/70 to-blue-600/60"
        },
      ],
      stageOrder: "cycle",
      features: [
        { key: "swelling", label: "Swelling", type: "select", options: ["None", "Mild", "Moderate", "Severe"] },
        { key: "color", label: "Color", type: "select", options: ["Pale", "Pink", "Red", "Dark"] },
        { key: "opening", label: "Opening", type: "select", options: ["Closed", "Slightly Open", "Open", "Gaping"] },
        { key: "moistness", label: "Moistness", type: "select", options: ["Dry", "Moist", "Wet"] },
      ],
      aiPrompt: "mouse body",
    },
    subjectConfig: {
      labelSingular: "Mouse",
      labelPlural: "Mice",
      fields: [
        { key: "dob", label: "Date of Birth", type: "date" },
        { key: "genotype", label: "Genotype", type: "text" },
        { key: "cage_number", label: "Cage Number", type: "text" },
      ],
    },
  },

  cell_culture: {
    type: "cell_culture",
    name: "Cell Culture Health",
    description: "Monitor cell culture viability and health status",
    icon: "Microscope",
    logConfig: {
      stages: [
        { 
          name: "Healthy", 
          color: "#22C55E", 
          lightColor: "#DCFCE7",
          gradient: "from-green-400/80 via-green-500/70 to-green-600/60"
        },
        { 
          name: "Stressed", 
          color: "#EAB308", 
          lightColor: "#FEF9C3",
          gradient: "from-yellow-400/80 via-yellow-500/70 to-yellow-600/60"
        },
        { 
          name: "Apoptotic", 
          color: "#F97316", 
          lightColor: "#FED7AA",
          gradient: "from-orange-400/80 via-orange-500/70 to-orange-600/60"
        },
        { 
          name: "Necrotic", 
          color: "#EF4444", 
          lightColor: "#FECACA",
          gradient: "from-red-400/80 via-red-500/70 to-red-600/60"
        },
      ],
      stageOrder: "linear",
      features: [
        { key: "confluence", label: "Confluence %", type: "number", min: 0, max: 100 },
        { key: "morphology", label: "Morphology", type: "select", options: ["Normal", "Rounded", "Elongated", "Irregular"] },
        { key: "debris", label: "Debris Level", type: "select", options: ["None", "Low", "Medium", "High"] },
      ],
      aiPrompt: "cells",
    },
    subjectConfig: {
      labelSingular: "Culture",
      labelPlural: "Cultures",
      fields: [
        { key: "cell_line", label: "Cell Line", type: "text", required: true },
        { key: "passage_number", label: "Passage Number", type: "number" },
        { key: "media_type", label: "Media Type", type: "text" },
        { key: "plate_id", label: "Plate ID", type: "text" },
      ],
    },
  },

  plant_phenotyping: {
    type: "plant_phenotyping",
    name: "Plant Phenotyping",
    description: "Track plant growth stages and health conditions",
    icon: "Leaf",
    logConfig: {
      stages: [
        { 
          name: "Seedling", 
          color: "#84CC16", 
          lightColor: "#ECFCCB",
          gradient: "from-lime-400/80 via-lime-500/70 to-lime-600/60"
        },
        { 
          name: "Vegetative", 
          color: "#22C55E", 
          lightColor: "#DCFCE7",
          gradient: "from-green-400/80 via-green-500/70 to-green-600/60"
        },
        { 
          name: "Flowering", 
          color: "#EC4899", 
          lightColor: "#FCE7F3",
          gradient: "from-pink-400/80 via-pink-500/70 to-pink-600/60"
        },
        { 
          name: "Fruiting", 
          color: "#F97316", 
          lightColor: "#FED7AA",
          gradient: "from-orange-400/80 via-orange-500/70 to-orange-600/60"
        },
        { 
          name: "Senescence", 
          color: "#A16207", 
          lightColor: "#FEF3C7",
          gradient: "from-amber-600/80 via-amber-700/70 to-amber-800/60"
        },
      ],
      stageOrder: "linear",
      features: [
        { key: "height_cm", label: "Height (cm)", type: "number", min: 0 },
        { key: "leaf_count", label: "Leaf Count", type: "number", min: 0 },
        { key: "leaf_color", label: "Leaf Color", type: "select", options: ["Green", "Yellow-Green", "Yellow", "Brown"] },
        { key: "health", label: "Overall Health", type: "select", options: ["Excellent", "Good", "Fair", "Poor"] },
      ],
      aiPrompt: "plant",
    },
    subjectConfig: {
      labelSingular: "Plant",
      labelPlural: "Plants",
      fields: [
        { key: "species", label: "Species", type: "text", required: true },
        { key: "variety", label: "Variety", type: "text" },
        { key: "planting_date", label: "Planting Date", type: "date" },
        { key: "location", label: "Location", type: "text" },
      ],
    },
  },

  wound_healing: {
    type: "wound_healing",
    name: "Wound Healing Assessment",
    description: "Track wound healing progression in animal models",
    icon: "Heart",
    logConfig: {
      stages: [
        { 
          name: "Hemostasis", 
          color: "#DC2626", 
          lightColor: "#FECACA",
          gradient: "from-red-500/80 via-red-600/70 to-red-700/60"
        },
        { 
          name: "Inflammation", 
          color: "#F97316", 
          lightColor: "#FED7AA",
          gradient: "from-orange-400/80 via-orange-500/70 to-orange-600/60"
        },
        { 
          name: "Proliferation", 
          color: "#EAB308", 
          lightColor: "#FEF9C3",
          gradient: "from-yellow-400/80 via-yellow-500/70 to-yellow-600/60"
        },
        { 
          name: "Remodeling", 
          color: "#22C55E", 
          lightColor: "#DCFCE7",
          gradient: "from-green-400/80 via-green-500/70 to-green-600/60"
        },
        { 
          name: "Healed", 
          color: "#3B82F6", 
          lightColor: "#BFDBFE",
          gradient: "from-blue-400/80 via-blue-500/70 to-blue-600/60"
        },
      ],
      stageOrder: "linear",
      features: [
        { key: "wound_size_mm", label: "Wound Size (mm)", type: "number", min: 0 },
        { key: "exudate", label: "Exudate", type: "select", options: ["None", "Serous", "Sanguineous", "Purulent"] },
        { key: "granulation", label: "Granulation", type: "select", options: ["None", "Partial", "Complete"] },
      ],
      aiPrompt: "wound",
    },
    subjectConfig: {
      labelSingular: "Subject",
      labelPlural: "Subjects",
      fields: [
        { key: "subject_id", label: "Subject ID", type: "text", required: true },
        { key: "wound_location", label: "Wound Location", type: "text" },
        { key: "wound_date", label: "Wound Date", type: "date" },
      ],
    },
  },

  custom: {
    type: "custom",
    name: "Custom Tracking",
    description: "Define your own stages, fields, and classification criteria",
    icon: "Settings",
    logConfig: {
      stages: [
        { name: "Stage 1", color: "#3B82F6", lightColor: "#BFDBFE", gradient: "from-blue-400/80 via-blue-500/70 to-blue-600/60" },
        { name: "Stage 2", color: "#22C55E", lightColor: "#DCFCE7", gradient: "from-green-400/80 via-green-500/70 to-green-600/60" },
        { name: "Stage 3", color: "#EAB308", lightColor: "#FEF9C3", gradient: "from-yellow-400/80 via-yellow-500/70 to-yellow-600/60" },
      ],
      stageOrder: "linear",
      features: [],
      aiPrompt: "subject",
    },
    subjectConfig: {
      labelSingular: "Subject",
      labelPlural: "Subjects",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
      ],
    },
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a preset config by type, with fallback to custom
 */
export function getPresetConfig(type: string): CohortConfig {
  return PRESET_CONFIGS[type] || PRESET_CONFIGS.custom;
}

/**
 * Parse a cohort's stored config into typed format
 */
export function parseCohortConfig(
  type: string | null | undefined,
  logConfig: unknown,
  subjectConfig: unknown
): CohortConfig {
  const preset = getPresetConfig(type || "custom");
  
  // If configs are stored, merge with preset defaults
  const parsedLogConfig = logConfig as Partial<LogConfig> | null;
  const parsedSubjectConfig = subjectConfig as Partial<SubjectConfig> | null;
  
  // Convert legacy format (array of stage names) to new format
  if (parsedLogConfig?.stages && Array.isArray(parsedLogConfig.stages)) {
    const stagesArray = parsedLogConfig.stages as unknown[];
    if (stagesArray.length > 0 && typeof stagesArray[0] === "string") {
      // Legacy format: ["Proestrus", "Estrus", ...]
      const legacyStages = stagesArray as string[];
      const presetStageMap = new Map(preset.logConfig.stages.map(s => [s.name, s]));
      
      parsedLogConfig.stages = legacyStages.map((name, i) => {
        const presetStage = presetStageMap.get(name);
        if (presetStage) return presetStage;
        
        // Generate color for unknown stages
        const hue = (i * 137.5) % 360; // Golden angle for nice distribution
        return {
          name,
          color: `hsl(${hue}, 70%, 50%)`,
          lightColor: `hsl(${hue}, 70%, 90%)`,
          gradient: `from-slate-400/80 via-slate-500/70 to-slate-600/60`,
        };
      });
    }
  }
  
  return {
    ...preset,
    logConfig: {
      ...preset.logConfig,
      ...parsedLogConfig,
      stages: (parsedLogConfig?.stages as StageConfig[]) || preset.logConfig.stages,
    },
    subjectConfig: {
      ...preset.subjectConfig,
      ...parsedSubjectConfig,
    },
  };
}

/**
 * Get stage config by name
 */
export function getStageConfig(config: CohortConfig, stageName: string): StageConfig | undefined {
  return config.logConfig.stages.find(s => s.name === stageName);
}

/**
 * Get stage color by name (with fallback)
 */
export function getStageColor(config: CohortConfig, stageName: string): string {
  return getStageConfig(config, stageName)?.color || "#94A3B8";
}

/**
 * Get stage gradient by name (with fallback)
 */
export function getStageGradient(config: CohortConfig, stageName: string): string {
  return getStageConfig(config, stageName)?.gradient || "from-slate-400/80 via-slate-500/70 to-slate-600/60";
}

/**
 * Build confidence scores object from stage names
 */
export function buildEmptyConfidences(config: CohortConfig): Record<string, number> {
  return Object.fromEntries(config.logConfig.stages.map(s => [s.name, 0]));
}

/**
 * Get all stage names as array
 */
export function getStageNames(config: CohortConfig): string[] {
  return config.logConfig.stages.map(s => s.name);
}

