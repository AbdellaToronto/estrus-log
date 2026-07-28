# Estrus image-classification upgrade plan

## Decision first: identify the input modality

The current app contains two different tasks and should not score them with one model contract:

- **External genital photographs**: use an external-image model.
- **Vaginal cytology / smear images**: use cell detection and cell proportions.

The UI and saved scan metadata should record the modality, camera or microscope, staining, mouse ID, capture session, and whether an expert confirmed the stage.

## What not to do

Do not fine-tune a general-purpose LLM as the primary classifier. Its output is hard to calibrate, difficult to validate on a new lab's images, and should remain an optional assistive observation—not a biological ground truth label.

## Strongest practical candidates

### Cytology

Benchmark an interpretable ODES-style detector: detect leukocytes, cornified cells, and nucleated epithelial cells; derive the stage from proportions and display the counts/overlay for human review. ODES reports 80% average stage accuracy on its held-out images and includes quality or biological-plausibility flags. It is much closer to how cytology is actually interpreted than a vision-language prompt.

- [ODES paper](https://www.nature.com/articles/s44277-024-00020-x)
- [ODES code](https://github.com/rrosslab/ODES_Object_Detection_For_Estrous_Staging)
- [EstrousBank / EstrousNet dataset and baseline](https://www.omicsdi.org/dataset/bioimages/S-BIAD545)

### External photographs

Benchmark the current frozen BioCLIP embedding/probe against a small supervised CNN trained for this exact modality. The 2025 Repro Cycle Net preprint reports over 83% for a **binary** task that merges proestrus + estrus and metestrus + diestrus. It does not report 83% four-stage staging, and it is not proof that a model transfers to this lab, strain, lighting, or capture protocol.

- [Repro Cycle Net preprint](https://labs.sciety.org/articles/by?article_doi=10.1101%2F2025.10.03.680273)
- [Associated external-image dataset](https://www.omicsdi.org/dataset/bioimages/S-BIAD2395)

### 2026-07-19 pilot result

The subject-held-out local evaluation used 222 external photographs from 11 mice. Every cross-validation fold had zero mouse overlap.

- Four-stage BioCLIP probe: macro-F1 0.284, balanced accuracy 0.286.
- Four-stage supervised ResNet-18: macro-F1 0.267, balanced accuracy 0.281. The CNN was badly overconfident and did not beat BioCLIP on class-balanced performance.
- Paper-aligned binary RCN on the public official split: 72.4% balanced accuracy and ROC-AUC 0.789. Subject independence cannot be verified because public mouse IDs are absent.
- A repeated-training-only-CV DINOv2-small/base ensemble plus its independently selected v2 threshold improves the same sealed public official split to 66/76 correct (86.8% balanced accuracy) and ROC-AUC 0.914, exceeding the paper's reported 63/76 and 0.90. The official test had already been inspected during exploratory comparison, so this is a promising reproduced benchmark rather than a pristine independent confirmation.
- Under the independent colour-suite coat-dark condition, the v2 ensemble retains 64/76 correct (84.2%) and ROC-AUC 0.925; the exact app inference stress view scores 63/76. Requiring clean/app-dark agreement and an in-reference embedding produces 67/76 reference-backed suggestions with 60/67 correct (89.6% selective accuracy); the remaining nine abstain.
- The same public-pretrained binary RCN on local full frames: balanced accuracy 0.485 and ROC-AUC 0.488.
- With uniform, label-blind local ROI crops: balanced accuracy 0.569 and ROC-AUC 0.601; mouse-cluster bootstrap ROC-AUC interval 0.552–0.659.
- All 222 local dark-mouse ROI images fall below the DINOv2 ensemble's public training-reference floor, so the guarded service produces zero reference-backed local suggestions. Clean/dark raw suggestions agree on 85.1–85.6%, while the two ROI protocols agree on only 72.5%. These are domain and framing diagnostics; intern visual-guess folders are not treated as accuracy ground truth.

These are research results, not deployment evidence. Keep four-stage automation unavailable. The binary result is only a lead for a better standardized-ROI dataset and still requires scientist confirmation.

Reproducible runners:

```bash
python python-service/evaluate_external_cnn.py --help
python python-service/evaluate_external_binary_rcn.py --help
python python-service/prepare_session_anchored_roi.py --help
python python-service/benchmark_public_external_binary.py --help
python python-service/validate_public_binary_candidates.py --help
python python-service/verify_public_binary_inference.py --help
python python-service/evaluate_inference_guardrails.py --help
```

## Evaluation protocol

1. Collect **200–400 local labelled images** first, with two expert labels where possible. Include an explicit `transition/uncertain` option.
2. Split by **mouse and capture session**—never randomly by image. Near-duplicate images from one mouse/session otherwise leak across train and test and produce misleading scores. The existing cropped split proves the problem: all **11 subjects** occur in both its 177-image training set and its 45-image test set, because `python-service/split_data.py` shuffles individual files within each label.
3. Keep a final held-out set from another device, day, operator, strain, or lab if available.
4. Compare the current model, the modality-specific baseline above, and an optional frozen vision-foundation embedding + linear probe.
5. Report macro-F1, balanced accuracy, per-stage sensitivity/PPV, confusion matrix, calibration (Brier or ECE), abstention coverage, and expert agreement (kappa).
6. Deploy only a model that beats the baseline on the held-out group split. Keep the product's review threshold and show evidence rather than a raw “confidence” percentage.

## Reproducible split command

Use `python-service/split_by_subject.py`, not the legacy random-image splitter. It holds every subject completely in train or test and writes a manifest containing the seed and subject IDs:

```bash
python python-service/split_by_subject.py \
  --source dataset_raw \
  --output dataset_subject_split \
  --test-ratio 0.2 \
  --seed 20260719
```

Run it with `--dry-run` before copying images. A valid report always states `subject overlap: 0`.

## Evaluation report command

Export one row per held-out image with `subject_id`, `true_stage`,
`predicted_stage`, and (when available) `relative_support`. Then use the
manifest-aware reporter. It refuses predictions from a training subject,
separates transition/uncertain labels from the four-stage score, and writes
macro-F1, balanced accuracy, per-stage metrics, a confusion matrix,
abstention coverage, and top-label calibration diagnostics.

```bash
python python-service/evaluate_predictions.py \
  --predictions heldout_predictions.csv \
  --manifest dataset_subject_split/split_manifest.json \
  --model-version bioclip-linear-v1 \
  --output reports/bioclip-linear-v1.json
```

## Paired local ground-truth collection

For an external-photo record to qualify as local cytology-grounded evidence, save it with **Paired vaginal cytology** in the single-entry review flow. The app requires a private paired smear image and records its object reference, optional slide/sample ID, reviewer, subject, capture date, and capture session in queryable fields. A database constraint rejects `paired_cytology_review` records without that evidence. On each subject page, record the scientist-observed coat colour and strain/stock; these are structured subject attributes and are never inferred from the photograph.

Export the cohort CSV, then run the strict preflight before training or evaluation:

```bash
work/model-eval/.venv/bin/python \
  python-service/prepare_cytology_grounded_evaluation.py \
  --export cohort-export.csv \
  --output-dir work/model-eval/local-cytology-ground-truth \
  --require-coat-colour \
  --strict
```

The preflight excludes visual-review and model-suggestion rows, rejects incomplete pairings, flags duplicate/reused image references, and creates a deterministic coat-stratified, subject-held-out split only when at least five subjects are available. The coat-colour gate additionally requires at least two evaluable colour groups, representation in both train and test, and configurable minimum held-out subject and record support per group.

Run the exact guarded app model on only the generated `subject_split=test` rows. The preflight seals the records CSV with SHA-256; the runner verifies that hash and the split counts, skips every training row, never opens the paired cytology image, and does not use `true_stage` during inference. Resolve private external-photo references with an explicit two-column image map (`object_reference,local_path`), an image root, or the opt-in GCS download flag:

```bash
PYTHONPATH=python-service work/model-eval/.venv/bin/python \
  python-service/run_cytology_grounded_binary_holdout.py \
  --records work/model-eval/local-cytology-ground-truth/cytology-grounded-records.csv \
  --preflight-report work/model-eval/local-cytology-ground-truth/cytology-ground-truth-preflight.json \
  --image-map private-external-photo-map.csv \
  --require-coat-colour \
  --model-dir work/model-eval/public-confirmatory-20260719 \
  --benchmark-dir work/model-eval/public-foundation-benchmark-20260719 \
  --public-data-dir "work/model-eval/public/S-BIAD2395/estrus images" \
  --output-dir work/model-eval/local-cytology-ground-truth/heldout-inference
```

Then join the cytology-derived labels by `log_id` in the separate evaluator and produce the subgroup report:

```bash
work/model-eval/.venv/bin/python \
  python-service/evaluate_cytology_grounded_binary_predictions.py \
  --records work/model-eval/local-cytology-ground-truth/cytology-grounded-records.csv \
  --predictions work/model-eval/local-cytology-ground-truth/heldout-inference/binary-heldout-predictions.csv \
  --model-version s-biad2395-dinov2-robust-ensemble-20260719-v2 \
  --threshold 0.579 \
  --strict-coat-colour \
  --output work/model-eval/local-cytology-ground-truth/binary-subgroup-report.json
```

The evaluator rejects missing, duplicate, extra, or training-row predictions; counts abstentions as incorrect in the primary accuracy; computes a subject-cluster bootstrap; and reports accuracy, balanced accuracy, sensitivity, specificity, AUC, coverage, and disparities by coat colour, strain, device, and reviewer. A structurally valid split is not enough for deployment; retain the 200–400-image target, class coverage, and a final untouched mouse/session/operator/device test cohort.

## Product rule

Every automated result is a suggestion. Low evidence, low support, missing reference images, or biologically implausible output must require scientist confirmation before it becomes a log entry. The refreshed app now retains the model version, evidence, and review reasons for that audit trail.

## Coat-colour and acquisition stress contract

The fixed eight-head DINOv2 ensemble is also audited under deterministic, label-preserving synthetic shifts: dark coat, near-black coat, brown coat, low light, warm and cool white balance, and desaturation. This follows the general robustness pattern behind [AugMix](https://openreview.net/pdf?id=S1gmrxHFvB) and test-time augmentation research such as [MEMO](https://arxiv.org/abs/2110.09506), while retaining the frozen [DINOv2](https://arxiv.org/abs/2304.07193) representation. These papers motivate the stress dimensions; they do not validate this mouse task.

```bash
work/model-eval/.venv/bin/python \
  python-service/evaluate_public_colour_shift_suite.py \
  --data "work/model-eval/public/S-BIAD2395/estrus images" \
  --baseline-model-dir work/model-eval/public-confirmatory-20260719 \
  --candidate-model-dir work/model-eval/public-multiscale-confirmatory-20260719 \
  --output-dir work/model-eval/public-colour-shift-suite-20260719 \
  --device auto
```

After restoring one accidentally overwritten public test image and sealing the released 758-image manifest, the retained ensemble's original 0.557 threshold scores 65/76 clean, 63/76 under dark and near-black coat transformations, and 60/76 in its worst condition (desaturation). A training-only-selected ROI/multiscale ensemble, DINOv2-with-registers model, DINOv2-large extension, and soft coat-neutralization representation all failed the promotion gate. The separately training-selected 0.579 policy is now the hash-bound app default: it reaches 66/76 clean, 64/76 under dark and brown transformations, increases clean/dark agreement coverage from 66 to 67 records, slightly raises mean synthetic-condition accuracy, and leaves the 60/76 worst condition unchanged. The exact dataset manifest and DINOv2 backbone revisions are pinned. Synthetic shifts still do not establish real-coat validity.

The serving policy now adds an acquisition-domain guard fitted only to the 682 public training images. Its seven simple colour/exposure measurements cover luminance, saturation, channel balance, clipped shadows/highlights, and centre-to-edge illumination. On the untouched 76-image test export, raw performance remains 66/76. The complete guarded policy emits 65 reference-backed suggestions, with 58/65 correct (89.2% selective accuracy), and abstains on 11. Each of the seven predeclared global shifts is withheld for all 76 test images. This is a deliberately conservative failure-detection result, not evidence that the model generalizes to real dark- or brown-coated mice. The acquisition report, tail threshold, metric list, model artifacts, training-only threshold selection, dataset manifest, and backbone revisions are hash-bound by `verify_public_binary_policy.py`.

These are synthetic sensitivity tests, not a fairness or external-validity claim. Promotion still requires cytology-grounded images from real light-, brown-, grey-, and dark-coated mice, grouped by mouse and capture session, with device and operator represented in the held-out cohort.
