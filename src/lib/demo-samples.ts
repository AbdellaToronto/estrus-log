/**
 * Bundled white-coated photographs with their published ground truth.
 *
 * A demo where the visitor has to supply their own images only works if they
 * happen to have mouse photographs to hand, which almost nobody does. These
 * eight ship with the app so the batch evaluator can be run in one click.
 *
 * Labels are not invented for the demo. Each file was matched by content hash
 * against the released S-BIAD2395 archive, and the stage comes from the source
 * filename — the dataset sorts into estrus/nonestrus folders but names every
 * file with its exact stage, so four-stage truth is available for all eight.
 */

import type { ClassificationStage } from "@/lib/classification";
import type { BinaryGroup } from "@/lib/bulk-eval";

export type DemoSample = {
  /** Served from public/assets/demo/s-biad2395/. */
  file: string;
  label: string;
  stage: ClassificationStage;
  group: BinaryGroup;
  /** Path inside the released archive, so a reader can verify the label. */
  source: string;
};

export const DEMO_SAMPLES: DemoSample[] = [
  {
    file: "n-221.png",
    label: "Photograph 139",
    stage: "Estrus",
    group: "PROESTRUS_OR_ESTRUS",
    source: "Testing/estrus/estrus (139).png",
  },
  {
    file: "n-222.png",
    label: "Photograph 118",
    stage: "Proestrus",
    group: "PROESTRUS_OR_ESTRUS",
    source: "Testing/estrus/proestrus (118).png",
  },
  {
    file: "n-223.png",
    label: "Photograph 106",
    stage: "Metestrus",
    group: "METESTRUS_OR_DIESTRUS",
    source: "Testing/nonestrus/metestrus (106).png",
  },
  {
    file: "n-224.png",
    label: "Photograph 135",
    stage: "Diestrus",
    group: "METESTRUS_OR_DIESTRUS",
    source: "Testing/nonestrus/diestrus (135).png",
  },
  {
    file: "n-225.png",
    label: "Photograph 155",
    stage: "Estrus",
    group: "PROESTRUS_OR_ESTRUS",
    source: "Testing/estrus/estrus (155).png",
  },
  {
    file: "n-226.png",
    label: "Photograph 145",
    stage: "Metestrus",
    group: "METESTRUS_OR_DIESTRUS",
    source: "Testing/nonestrus/metestrus (145).png",
  },
  {
    file: "n-227.png",
    label: "Photograph 174",
    stage: "Proestrus",
    group: "PROESTRUS_OR_ESTRUS",
    source: "Testing/estrus/proestrus (174).png",
  },
  {
    file: "n-228.png",
    label: "Photograph 177",
    stage: "Diestrus",
    group: "METESTRUS_OR_DIESTRUS",
    source: "Testing/nonestrus/diestrus (177).png",
  },
];

export const SAMPLE_BASE_PATH = "/assets/demo/s-biad2395";

/** Ground truth for a bundled sample, by filename. */
export function sampleTruth(filename: string): DemoSample | undefined {
  return DEMO_SAMPLES.find((sample) => sample.file === filename);
}
