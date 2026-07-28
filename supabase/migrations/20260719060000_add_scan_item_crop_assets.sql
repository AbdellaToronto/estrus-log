alter table public.scan_items
  add column if not exists cropped_image_url text,
  add column if not exists mask_image_url text,
  add column if not exists analysis_progress jsonb;

comment on column public.scan_items.cropped_image_url is
  'Private object reference for the prepared ROI reviewed before analysis.';

comment on column public.scan_items.mask_image_url is
  'Optional private object reference for a segmentation or crop-review mask.';

comment on column public.scan_items.analysis_progress is
  'Structured progress and provenance emitted by long-running batch analysis.';
