\set ON_ERROR_STOP on

-- Local-only, idempotent rehearsal data derived from the public S-BIAD2395
-- official test partition. The paper's exact four-stage labels were assigned
-- using vaginal smear cytology, but the public archive contains only external
-- genital photographs. These rows intentionally keep the scientist's saved
-- stage separate from the binary photo model's review-aid evidence.

BEGIN;

INSERT INTO cohorts (
  id, user_id, org_id, name, description, color, type, subject_config, log_config, created_at
) VALUES (
  '5b1ad239-5000-4000-8000-000000000001',
  'user_local_scientist',
  'org_local_estrus_lab',
  'S-BIAD2395 Paper Demo',
  'Local-only demonstration using public external-genital test images. Exact stages are the paper dataset labels, which were assigned using vaginal-smear cytology. Samples are independent public images, not longitudinal mouse records.',
  'bg-violet-500',
  'estrus_tracking',
  '{"label":"Public sample","id_prefix":"SB"}'::jsonb,
  '{"demo_source":"S-BIAD2395","reference_standard":"cytology-derived paper label","paired_smear_images_available":false}'::jsonb,
  '2026-07-14T13:00:00Z'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject_config = EXCLUDED.subject_config,
  log_config = EXCLUDED.log_config;

INSERT INTO mice (
  id, user_id, org_id, cohort_id, name, notes, metadata, status, coat_colour, strain, created_at
) VALUES
  ('5b1ad239-5000-4000-8000-000000000011', 'user_local_scientist', 'org_local_estrus_lab', '5b1ad239-5000-4000-8000-000000000001', 'SB-EST-139', 'Public test image estrus (139).png. Demo sample identity only; not a longitudinal animal record.', '{"dataset":"S-BIAD2395","partition":"official_test","source_filename":"estrus (139).png"}'::jsonb, 'Active', 'white', 'ICR (public paper dataset)', '2026-07-14T13:10:00Z'),
  ('5b1ad239-5000-4000-8000-000000000012', 'user_local_scientist', 'org_local_estrus_lab', '5b1ad239-5000-4000-8000-000000000001', 'SB-PRO-118', 'Public test image proestrus (118).png. Demo sample identity only; not a longitudinal animal record.', '{"dataset":"S-BIAD2395","partition":"official_test","source_filename":"proestrus (118).png"}'::jsonb, 'Active', 'white', 'ICR (public paper dataset)', '2026-07-15T13:10:00Z'),
  ('5b1ad239-5000-4000-8000-000000000013', 'user_local_scientist', 'org_local_estrus_lab', '5b1ad239-5000-4000-8000-000000000001', 'SB-MET-106', 'Public test image metestrus (106).png. Demo sample identity only; not a longitudinal animal record.', '{"dataset":"S-BIAD2395","partition":"official_test","source_filename":"metestrus (106).png"}'::jsonb, 'Active', 'white', 'ICR (public paper dataset)', '2026-07-16T13:10:00Z'),
  ('5b1ad239-5000-4000-8000-000000000014', 'user_local_scientist', 'org_local_estrus_lab', '5b1ad239-5000-4000-8000-000000000001', 'SB-DIE-135', 'Public test image diestrus (135).png. Demo sample identity only; not a longitudinal animal record.', '{"dataset":"S-BIAD2395","partition":"official_test","source_filename":"diestrus (135).png"}'::jsonb, 'Active', 'white', 'ICR (public paper dataset)', '2026-07-17T13:10:00Z'),
  ('5b1ad239-5000-4000-8000-000000000015', 'user_local_scientist', 'org_local_estrus_lab', '5b1ad239-5000-4000-8000-000000000001', 'SB-EST-155', 'Public test image estrus (155).png. Demo sample identity only; not a longitudinal animal record.', '{"dataset":"S-BIAD2395","partition":"official_test","source_filename":"estrus (155).png"}'::jsonb, 'Active', 'white', 'ICR (public paper dataset)', '2026-07-18T13:10:00Z'),
  ('5b1ad239-5000-4000-8000-000000000016', 'user_local_scientist', 'org_local_estrus_lab', '5b1ad239-5000-4000-8000-000000000001', 'SB-MET-145', 'Public test image metestrus (145).png. Demo sample identity only; not a longitudinal animal record.', '{"dataset":"S-BIAD2395","partition":"official_test","source_filename":"metestrus (145).png"}'::jsonb, 'Active', 'white', 'ICR (public paper dataset)', '2026-07-19T13:10:00Z'),
  ('5b1ad239-5000-4000-8000-000000000017', 'user_local_scientist', 'org_local_estrus_lab', '5b1ad239-5000-4000-8000-000000000001', 'SB-PRO-174', 'Public test image proestrus (174).png. Reserved for the unfinished batch-review demonstration.', '{"dataset":"S-BIAD2395","partition":"official_test","source_filename":"proestrus (174).png"}'::jsonb, 'Active', 'white', 'ICR (public paper dataset)', '2026-07-20T12:10:00Z'),
  ('5b1ad239-5000-4000-8000-000000000018', 'user_local_scientist', 'org_local_estrus_lab', '5b1ad239-5000-4000-8000-000000000001', 'SB-DIE-177', 'Public test image diestrus (177).png. Reserved for the unfinished batch-review demonstration.', '{"dataset":"S-BIAD2395","partition":"official_test","source_filename":"diestrus (177).png"}'::jsonb, 'Active', 'white', 'ICR (public paper dataset)', '2026-07-20T12:20:00Z')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  coat_colour = EXCLUDED.coat_colour,
  strain = EXCLUDED.strain;

INSERT INTO scan_sessions (
  id, cohort_id, user_id, name, status, modality, capture_date, created_at
) VALUES
  ('5b1ad239-5000-4000-8000-000000001001', '5b1ad239-5000-4000-8000-000000000001', 'user_local_scientist', 'Paper demo · six reviewed samples', 'completed', 'external_photo', '2026-07-19', '2026-07-19T13:00:00Z'),
  ('5b1ad239-5000-4000-8000-000000001002', '5b1ad239-5000-4000-8000-000000000001', 'user_local_scientist', 'Paper demo · review two samples', 'review', 'external_photo', '2026-07-20', '2026-07-20T20:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  modality = EXCLUDED.modality,
  capture_date = EXCLUDED.capture_date;

-- The six saved records show a useful partial state: four correct
-- reference-backed binary leads, one safe abstention, and one confidently
-- wrong binary lead. That disagreement is deliberate evidence that the saved
-- scientific decision must remain human-owned.
INSERT INTO estrus_logs (
  id, mouse_id, cohort_id, session_id, stage, confidence, features, image_url,
  notes, data, modality, capture_date, label_status, confirmation_source,
  reviewer_id, capture_metadata, created_at
) VALUES
  (
    '5b1ad239-5000-4000-8000-000000002011',
    '5b1ad239-5000-4000-8000-000000000011',
    '5b1ad239-5000-4000-8000-000000000001',
    '5b1ad239-5000-4000-8000-000000001001',
    'Estrus', NULL, '{}'::jsonb,
    '/api/local-uploads/paper-demo-20260720/est-139.png',
    'Public S-BIAD2395 test label imported for local demonstration. The paper reports cytology as the labeling reference; no paired smear image is included in the public archive.',
    '{"observation_context":{"modality":"external_photo","capture_date":"2026-07-14","confirmation_source":"paper_dataset_import","label_status":"confirmed"},"evidence":{"external_binary":{"task":"external_photo_binary_estrus_group","binary_suggestion":"PROESTRUS_OR_ESTRUS","reference_backed_binary_suggestion":"PROESTRUS_OR_ESTRUS","decision_status":"reference_backed_suggestion","abstention_reasons":[],"probability_proestrus_or_estrus":0.818615,"threshold":0.579,"synthetic_dark_coat":{"binary_suggestion":"PROESTRUS_OR_ESTRUS","probability_proestrus_or_estrus":0.800082,"agrees_with_clean":true,"absolute_probability_shift":0.018533},"reference_domain":{"out_of_reference":false},"acquisition_domain":{"out_of_range":false,"outlier_metrics":[],"severe_outlier_metrics":[],"metrics":{}},"review_required":true,"review_reasons":["Binary photo output is a review aid, not the saved exact stage."],"model_version":"s-biad2395-dinov2-robust-ensemble-20260719-v2"},"external_binary_agrees_with_stage_group":true}}'::jsonb,
    'external_photo', '2026-07-14', 'confirmed', 'paper_dataset_import', 'user_local_scientist',
    '{"dataset":"S-BIAD2395","partition":"official_test","source_filename":"estrus (139).png","paper_stage_label":"Estrus","paper_label_reference":"vaginal_smear_cytology","paired_smear_image_available":false}'::jsonb,
    '2026-07-14T13:30:00Z'
  ),
  (
    '5b1ad239-5000-4000-8000-000000002012',
    '5b1ad239-5000-4000-8000-000000000012',
    '5b1ad239-5000-4000-8000-000000000001',
    '5b1ad239-5000-4000-8000-000000001001',
    'Proestrus', NULL, '{}'::jsonb,
    '/api/local-uploads/paper-demo-20260720/pro-118.png',
    'Public S-BIAD2395 test label imported for local demonstration. The paper reports cytology as the labeling reference; no paired smear image is included in the public archive.',
    '{"observation_context":{"modality":"external_photo","capture_date":"2026-07-15","confirmation_source":"paper_dataset_import","label_status":"confirmed"},"evidence":{"external_binary":{"task":"external_photo_binary_estrus_group","binary_suggestion":"PROESTRUS_OR_ESTRUS","reference_backed_binary_suggestion":"PROESTRUS_OR_ESTRUS","decision_status":"reference_backed_suggestion","abstention_reasons":[],"probability_proestrus_or_estrus":0.928677,"threshold":0.579,"synthetic_dark_coat":{"binary_suggestion":"PROESTRUS_OR_ESTRUS","probability_proestrus_or_estrus":0.840508,"agrees_with_clean":true,"absolute_probability_shift":0.088169},"reference_domain":{"out_of_reference":false},"acquisition_domain":{"out_of_range":false,"outlier_metrics":[],"severe_outlier_metrics":[],"metrics":{}},"review_required":true,"review_reasons":["Binary photo output is a review aid, not the saved exact stage."],"model_version":"s-biad2395-dinov2-robust-ensemble-20260719-v2"},"external_binary_agrees_with_stage_group":true}}'::jsonb,
    'external_photo', '2026-07-15', 'confirmed', 'paper_dataset_import', 'user_local_scientist',
    '{"dataset":"S-BIAD2395","partition":"official_test","source_filename":"proestrus (118).png","paper_stage_label":"Proestrus","paper_label_reference":"vaginal_smear_cytology","paired_smear_image_available":false}'::jsonb,
    '2026-07-15T13:30:00Z'
  ),
  (
    '5b1ad239-5000-4000-8000-000000002013',
    '5b1ad239-5000-4000-8000-000000000013',
    '5b1ad239-5000-4000-8000-000000000001',
    '5b1ad239-5000-4000-8000-000000001001',
    'Metestrus', NULL, '{}'::jsonb,
    '/api/local-uploads/paper-demo-20260720/met-106.png',
    'Public S-BIAD2395 test label imported for local demonstration. The binary photo model abstained because clean and synthetic-dark predictions disagreed.',
    '{"observation_context":{"modality":"external_photo","capture_date":"2026-07-16","confirmation_source":"paper_dataset_import","label_status":"confirmed"},"evidence":{"external_binary":{"task":"external_photo_binary_estrus_group","binary_suggestion":"METESTRUS_OR_DIESTRUS","reference_backed_binary_suggestion":null,"decision_status":"abstain","abstention_reasons":["clean_dark_disagreement"],"probability_proestrus_or_estrus":0.503402,"threshold":0.579,"synthetic_dark_coat":{"binary_suggestion":"PROESTRUS_OR_ESTRUS","probability_proestrus_or_estrus":0.586979,"agrees_with_clean":false,"absolute_probability_shift":0.083577},"reference_domain":{"out_of_reference":false},"acquisition_domain":{"out_of_range":false,"outlier_metrics":[],"severe_outlier_metrics":[],"metrics":{}},"review_required":true,"review_reasons":["The clean and synthetic-dark predictions disagree."],"model_version":"s-biad2395-dinov2-robust-ensemble-20260719-v2"},"external_binary_agrees_with_stage_group":true}}'::jsonb,
    'external_photo', '2026-07-16', 'confirmed', 'paper_dataset_import', 'user_local_scientist',
    '{"dataset":"S-BIAD2395","partition":"official_test","source_filename":"metestrus (106).png","paper_stage_label":"Metestrus","paper_label_reference":"vaginal_smear_cytology","paired_smear_image_available":false}'::jsonb,
    '2026-07-16T13:30:00Z'
  ),
  (
    '5b1ad239-5000-4000-8000-000000002014',
    '5b1ad239-5000-4000-8000-000000000014',
    '5b1ad239-5000-4000-8000-000000000001',
    '5b1ad239-5000-4000-8000-000000001001',
    'Diestrus', NULL, '{}'::jsonb,
    '/api/local-uploads/paper-demo-20260720/die-135.png',
    'Public S-BIAD2395 test label imported for local demonstration. The paper reports cytology as the labeling reference; no paired smear image is included in the public archive.',
    '{"observation_context":{"modality":"external_photo","capture_date":"2026-07-17","confirmation_source":"paper_dataset_import","label_status":"confirmed"},"evidence":{"external_binary":{"task":"external_photo_binary_estrus_group","binary_suggestion":"METESTRUS_OR_DIESTRUS","reference_backed_binary_suggestion":"METESTRUS_OR_DIESTRUS","decision_status":"reference_backed_suggestion","abstention_reasons":[],"probability_proestrus_or_estrus":0.487258,"threshold":0.579,"synthetic_dark_coat":{"binary_suggestion":"METESTRUS_OR_DIESTRUS","probability_proestrus_or_estrus":0.499500,"agrees_with_clean":true,"absolute_probability_shift":0.012242},"reference_domain":{"out_of_reference":false},"acquisition_domain":{"out_of_range":false,"outlier_metrics":[],"severe_outlier_metrics":[],"metrics":{}},"review_required":true,"review_reasons":["Binary photo output is a review aid, not the saved exact stage."],"model_version":"s-biad2395-dinov2-robust-ensemble-20260719-v2"},"external_binary_agrees_with_stage_group":true}}'::jsonb,
    'external_photo', '2026-07-17', 'confirmed', 'paper_dataset_import', 'user_local_scientist',
    '{"dataset":"S-BIAD2395","partition":"official_test","source_filename":"diestrus (135).png","paper_stage_label":"Diestrus","paper_label_reference":"vaginal_smear_cytology","paired_smear_image_available":false}'::jsonb,
    '2026-07-17T13:30:00Z'
  ),
  (
    '5b1ad239-5000-4000-8000-000000002015',
    '5b1ad239-5000-4000-8000-000000000015',
    '5b1ad239-5000-4000-8000-000000000001',
    '5b1ad239-5000-4000-8000-000000001001',
    'Estrus', NULL, '{}'::jsonb,
    '/api/local-uploads/paper-demo-20260720/est-155.png',
    'Deliberate disagreement example: the cytology-derived paper label is Estrus, while the binary photo model gives a reference-backed late-group lead. The scientist-owned stage remains the saved record.',
    '{"observation_context":{"modality":"external_photo","capture_date":"2026-07-18","confirmation_source":"paper_dataset_import","label_status":"confirmed"},"evidence":{"external_binary":{"task":"external_photo_binary_estrus_group","binary_suggestion":"METESTRUS_OR_DIESTRUS","reference_backed_binary_suggestion":"METESTRUS_OR_DIESTRUS","decision_status":"reference_backed_suggestion","abstention_reasons":[],"probability_proestrus_or_estrus":0.253360,"threshold":0.579,"synthetic_dark_coat":{"binary_suggestion":"METESTRUS_OR_DIESTRUS","probability_proestrus_or_estrus":0.521522,"agrees_with_clean":true,"absolute_probability_shift":0.268162},"reference_domain":{"out_of_reference":false},"acquisition_domain":{"out_of_range":false,"outlier_metrics":[],"severe_outlier_metrics":[],"metrics":{}},"review_required":true,"review_reasons":["Binary photo output is a review aid, not the saved exact stage."],"model_version":"s-biad2395-dinov2-robust-ensemble-20260719-v2"},"external_binary_agrees_with_stage_group":false}}'::jsonb,
    'external_photo', '2026-07-18', 'confirmed', 'paper_dataset_import', 'user_local_scientist',
    '{"dataset":"S-BIAD2395","partition":"official_test","source_filename":"estrus (155).png","paper_stage_label":"Estrus","paper_label_reference":"vaginal_smear_cytology","paired_smear_image_available":false,"model_disagrees_with_paper_binary_group":true}'::jsonb,
    '2026-07-18T13:30:00Z'
  ),
  (
    '5b1ad239-5000-4000-8000-000000002016',
    '5b1ad239-5000-4000-8000-000000000016',
    '5b1ad239-5000-4000-8000-000000000001',
    '5b1ad239-5000-4000-8000-000000001001',
    'Metestrus', NULL, '{}'::jsonb,
    '/api/local-uploads/paper-demo-20260720/met-145.png',
    'Public S-BIAD2395 test label imported for local demonstration. The paper reports cytology as the labeling reference; no paired smear image is included in the public archive.',
    '{"observation_context":{"modality":"external_photo","capture_date":"2026-07-19","confirmation_source":"paper_dataset_import","label_status":"confirmed"},"evidence":{"external_binary":{"task":"external_photo_binary_estrus_group","binary_suggestion":"METESTRUS_OR_DIESTRUS","reference_backed_binary_suggestion":"METESTRUS_OR_DIESTRUS","decision_status":"reference_backed_suggestion","abstention_reasons":[],"probability_proestrus_or_estrus":0.266604,"threshold":0.579,"synthetic_dark_coat":{"binary_suggestion":"METESTRUS_OR_DIESTRUS","probability_proestrus_or_estrus":0.450600,"agrees_with_clean":true,"absolute_probability_shift":0.183996},"reference_domain":{"out_of_reference":false},"acquisition_domain":{"out_of_range":false,"outlier_metrics":[],"severe_outlier_metrics":[],"metrics":{}},"review_required":true,"review_reasons":["Binary photo output is a review aid, not the saved exact stage."],"model_version":"s-biad2395-dinov2-robust-ensemble-20260719-v2"},"external_binary_agrees_with_stage_group":true}}'::jsonb,
    'external_photo', '2026-07-19', 'confirmed', 'paper_dataset_import', 'user_local_scientist',
    '{"dataset":"S-BIAD2395","partition":"official_test","source_filename":"metestrus (145).png","paper_stage_label":"Metestrus","paper_label_reference":"vaginal_smear_cytology","paired_smear_image_available":false}'::jsonb,
    '2026-07-19T13:30:00Z'
  )
ON CONFLICT (id) DO UPDATE SET
  stage = EXCLUDED.stage,
  image_url = EXCLUDED.image_url,
  notes = EXCLUDED.notes,
  data = EXCLUDED.data,
  modality = EXCLUDED.modality,
  capture_date = EXCLUDED.capture_date,
  label_status = EXCLUDED.label_status,
  confirmation_source = EXCLUDED.confirmation_source,
  capture_metadata = EXCLUDED.capture_metadata;

INSERT INTO scan_items (
  id, session_id, image_url, cropped_image_url, status, ai_result,
  mouse_id, analysis_progress, created_at
) VALUES
  (
    '5b1ad239-5000-4000-8000-000000003017',
    '5b1ad239-5000-4000-8000-000000001002',
    '/api/local-uploads/paper-demo-20260720/pro-174.png',
    '/api/local-uploads/paper-demo-20260720/pro-174.png',
    'complete',
    '{"estrus_stage":"Proestrus","confidence_scores":{"Proestrus":0,"Estrus":0,"Metestrus":0,"Diestrus":0},"features":{},"reasoning":"No four-stage photo prediction is presented. The exact stage shown in this local demo comes from the paper dataset label and still requires the scientist to save it.","review_required":true,"review_reasons":["The photo model only provides an early-versus-late review aid.","The scientist must choose the exact stage."],"model_version":"s-biad2395-dinov2-robust-ensemble-20260719-v2","scientist_confirmed_stage":"Proestrus","evidence":{"method":"frozen_dinov2_robust_ensemble_with_abstention","external_binary":{"task":"external_photo_binary_estrus_group","binary_suggestion":"PROESTRUS_OR_ESTRUS","reference_backed_binary_suggestion":"PROESTRUS_OR_ESTRUS","decision_status":"reference_backed_suggestion","abstention_reasons":[],"probability_proestrus_or_estrus":0.580695,"threshold":0.579,"synthetic_dark_coat":{"binary_suggestion":"PROESTRUS_OR_ESTRUS","probability_proestrus_or_estrus":0.704952,"agrees_with_clean":true,"absolute_probability_shift":0.124257},"reference_domain":{"out_of_reference":false},"acquisition_domain":{"out_of_range":false,"outlier_metrics":[],"severe_outlier_metrics":[],"metrics":{}},"review_required":true,"review_reasons":["Binary photo output is a review aid, not the saved exact stage."],"model_version":"s-biad2395-dinov2-robust-ensemble-20260719-v2"},"external_binary_agrees_with_stage_group":true,"roi_confirmed":true},"demo_context":{"dataset":"S-BIAD2395","paper_stage_label":"Proestrus","paper_label_reference":"vaginal_smear_cytology","paired_smear_image_available":false}}'::jsonb,
    '5b1ad239-5000-4000-8000-000000000017',
    '{"step":"scientist_review","progress":1,"provenance":{"dataset":"S-BIAD2395","local_demo":true}}'::jsonb,
    '2026-07-20T20:10:00Z'
  ),
  (
    '5b1ad239-5000-4000-8000-000000003018',
    '5b1ad239-5000-4000-8000-000000001002',
    '/api/local-uploads/paper-demo-20260720/die-177.png',
    '/api/local-uploads/paper-demo-20260720/die-177.png',
    'complete',
    '{"estrus_stage":"Diestrus","confidence_scores":{"Proestrus":0,"Estrus":0,"Metestrus":0,"Diestrus":0},"features":{},"reasoning":"No four-stage photo prediction is presented. The exact stage shown in this local demo comes from the paper dataset label and still requires the scientist to save it.","review_required":true,"review_reasons":["The photo model only provides an early-versus-late review aid.","The scientist must choose the exact stage."],"model_version":"s-biad2395-dinov2-robust-ensemble-20260719-v2","evidence":{"method":"frozen_dinov2_robust_ensemble_with_abstention","external_binary":{"task":"external_photo_binary_estrus_group","binary_suggestion":"METESTRUS_OR_DIESTRUS","reference_backed_binary_suggestion":"METESTRUS_OR_DIESTRUS","decision_status":"reference_backed_suggestion","abstention_reasons":[],"probability_proestrus_or_estrus":0.229447,"threshold":0.579,"synthetic_dark_coat":{"binary_suggestion":"METESTRUS_OR_DIESTRUS","probability_proestrus_or_estrus":0.356649,"agrees_with_clean":true,"absolute_probability_shift":0.127202},"reference_domain":{"out_of_reference":false},"acquisition_domain":{"out_of_range":false,"outlier_metrics":[],"severe_outlier_metrics":[],"metrics":{}},"review_required":true,"review_reasons":["Binary photo output is a review aid, not the saved exact stage."],"model_version":"s-biad2395-dinov2-robust-ensemble-20260719-v2"},"external_binary_agrees_with_stage_group":true,"roi_confirmed":true},"demo_context":{"dataset":"S-BIAD2395","paper_stage_label":"Diestrus","paper_label_reference":"vaginal_smear_cytology","paired_smear_image_available":false}}'::jsonb,
    NULL,
    '{"step":"scientist_review","progress":1,"provenance":{"dataset":"S-BIAD2395","local_demo":true}}'::jsonb,
    '2026-07-20T20:20:00Z'
  )
ON CONFLICT (id) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  cropped_image_url = EXCLUDED.cropped_image_url,
  status = EXCLUDED.status,
  ai_result = EXCLUDED.ai_result,
  mouse_id = EXCLUDED.mouse_id,
  analysis_progress = EXCLUDED.analysis_progress;

COMMIT;
