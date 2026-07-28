# Next wave: scientist-ready Estrus Log

## 1. Finish the observation contract before collecting more data

**Progress:** single-entry logging now records modality and capture date, permits an explicit `Uncertain / transition` finding with a required note, and keeps cytology in a manual scientist-review path rather than sending it to the external-photo model. That provenance is visible on the subject record and is excluded from model-support averages.

**Progress:** batch sessions now persist modality and capture date in dedicated database fields, reject cytology at the analysis boundary, attach that provenance to each saved batch record, and require an explicit review acknowledgement for every predicted stage.

**Progress:** every new log now also writes modality, capture date, label status, confirmation source, and reviewer ID to queryable database columns; a migration backfills compatible JSON records. The flexible JSON remains for model evidence and backwards compatibility.

**Progress:** an external photo can now be explicitly linked to the vaginal-cytology image used to confirm its stage. The paired image, optional slide/sample ID, reviewer, subject, session, and date are queryable and included in cohort exports. SQL and server validation prevent a row from claiming paired cytology without the reference image.

**Progress:** coat colour and strain/stock are now scientist-entered, queryable subject fields. Missing coat metadata is visible in the cohort and subject views and is carried into the evaluation export rather than inferred from an image.

**Progress:** the single-entry form now captures optional collection session, camera/microscope, magnification, and stain/preparation. These values are stored as indexed capture metadata and shown with the saved observation.

**Still needed:** decide with the lab which additional protocol fields belong on the subject record, capture record, or both before collecting a large dataset.

Add these required-or-explicitly-unknown fields at upload:

- modality: `external_photo` or `vaginal_cytology`
- capture date/session and subject ID
- device/camera or microscope, magnification, stain, and strain where relevant
- expert label, reviewer, and label status: `confirmed`, `transition`, or `uncertain`

This makes a later training set usable instead of a folder of images with ambiguous provenance.

## 2. Make expert confirmation the source of truth

Keep the current “suggest → scientist confirms → save” interaction. Add a dedicated confirmation record rather than relying on free-form JSON, so the product can answer: who confirmed this stage, when, whether the AI suggestion changed, and why.

The single-entry flow also permits a deliberate manual external-photo review, so model availability never blocks a valid scientist observation.

## 3. Make image storage appropriate for research data

**Progress:** new uploads now store a canonical `gs://bucket/object` reference and the app creates short-lived signed read URLs only when an authorized server action returns records. Background analysis reads the private object directly. Existing direct HTTP URLs still display unchanged for backwards compatibility.

**Required deployment step:** make the production bucket private only after this code is deployed and verified with a non-sensitive image. Set the service account to sign/read objects, confirm signed uploads and reads work, then migrate or retire historical public objects under the lab's retention policy. The application deliberately does not change a cloud bucket's IAM policy on its own.

## 4. Build a real evaluation runner

**Progress:** the runner now evaluates frozen BioCLIP, a supervised transfer CNN, and the paper-aligned binary RCN with subject-held-out cross-validation, a deterministic two-mouse holdout, mouse-cluster confidence intervals, per-stage metrics, confusion matrices, and calibration diagnostics. It also fixed a seeded-split bug that previously depended on filesystem traversal order.

The new `split_by_subject.py` fixes the immediate leakage problem. The next runner should:

1. load one model's predictions plus confirmed labels;
2. perform grouped cross-validation by subject and capture session;
3. emit macro-F1, balanced accuracy, per-stage precision/recall, confusion matrix, calibration, abstention coverage, and reviewer agreement;
4. write a versioned report that names the dataset manifest and model version.

The paired-cytology export preflight now implements the collection-side gate: it accepts only explicit photo-to-cytology pairings, rejects incomplete records in strict mode, and creates a coat-stratified zero-subject-overlap split once at least five subjects are available. Its colour gate requires at least two recorded groups with configurable held-out subject and record support.

The exact held-out runner binds inference to the successful preflight manifest, skips training rows, resolves only external-photo references, and records that neither labels nor cytology images were used for inference. The binary evaluator then joins those fixed-model predictions one-to-one by log ID, rejects training or foreign records, counts abstentions conservatively, bootstraps by subject, and reports coat-colour, strain, device, and reviewer disparities. The complete path has a public-image wiring smoke test, but it still needs real paired observations before any real-coat result exists.

Do not promote a model based on the old random-image split. It overlaps all 11 current subjects between train and test.

The cohort page now exports a provenance-first CSV manifest: saved stage, capture contract, protocol metadata, model evidence, notes, and the canonical image object reference. This is the handoff format for the evaluation reporter; it intentionally does not turn private images into permanent public links.

## 5. Add a safe practice path

For a scientist trying the app alone, add a clearly labelled **Practice cohort** containing synthetic subjects and observations. It should never mix with real data and should be removable in one action. This makes the product explorable without uploading animal data on day one.

## 6. Then compare modality-specific models

- **Cytology:** ODES-style cell detection with cell-count overlays and a rule-based stage suggestion.
- **External photographs:** current BioCLIP probe versus a small supervised CNN, on a subject/session-held-out dataset.

**Pilot conclusion:** neither four-stage model is usable (best local macro-F1 0.284). The promoted, training-only-selected v2 threshold for the colour-robust DINOv2 ensemble exceeds the paper on the sealed public binary test (66/76, 86.8%, versus 63/76, 82.9%). Synthetic dark and brown transformations retain 64/76, while worst-case desaturation is 60/76; these are sensitivity tests, not real-coat evidence. Every one of the 222 local dark-mouse ROI images is outside its public training-reference range and the two plausible crop protocols agree on only 70.3% of raw suggestions. The app therefore exposes the model only as an optional, ROI-confirmed research cross-check; it abstains when clean/dark views disagree, representation evidence is out of domain, or colour/exposure is outside a training-only acquisition envelope. The guarded public test retains 65/76 reference-backed suggestions at 89.2% selective accuracy and withholds all seven globally shifted suites. This mitigates unknown acquisition conditions by failing safely; it does not prove real-coat generalization. The next model pass should follow a standardized close-ROI capture protocol, collect more independently confirmed local photo-plus-cytology labels, and reserve mice/operators/devices for a final untouched test set.

Only show a model as available after it meets the predeclared group-held-out thresholds and keeps a human-review route for low-evidence or transition cases.
