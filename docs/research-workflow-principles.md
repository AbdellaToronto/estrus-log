# Research workflow principles

These rules translate laboratory-recordkeeping evidence into the default Estrus Log workflow. They are product constraints, not claims that every lab runs the same protocol.

## Default path

1. **Today is a due-work queue.** Start with active cohorts and mice that do not yet have a capture-date record. A missing day stays visibly missing; it is never inferred from the previous stage.
2. **Capture repetitive context once.** Subject, cohort, external-photo modality, and capture date remain visible and are stored with every observation. Upload time is not substituted for capture date.
3. **Confirm framing before analysis.** Bulk uploads receive automatic crop proposals. Ready crops can be confirmed together; low-quality proposals and weak anchors move to an exception-first queue.
4. **Show assistance only when evidence exists.** The binary model runs only on confirmed prepared crops and may return an early-group lead, late-group lead, or abstention. It never supplies the exact saved stage.
5. **The scientist closes the record.** A scientist selects the four-stage label, assigns the mouse, optionally adds a note, and explicitly saves the reviewed batch.
6. **Keep provenance inspectable, not dominant.** Legacy model output, versions, acquisition checks, and reasoning live behind an Evidence disclosure and remain available for audit/export.

## Simplicity rules

- One primary action per state: upload, suggest crops, confirm crops, analyze, then save.
- No model output on the Daily Brief before an image has been captured and reviewed.
- Defaults support external photos; cytology-specific work remains out of the primary workflow until it has its own validated experience.
- The interface must be understandable without a tour. Future coachmarks attach to stable `data-tour` landmarks and explain only unfamiliar concepts.
- Preserve flexibility for lab-specific terminology and exports, but keep customization outside the daily path.

## Evidence used

- The [ARRIVE 2.0 guidelines](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.3000410) emphasize transparent reporting, methodological rigour, and reproducibility.
- A [mouse estrous-cycle monitoring protocol](https://pubmed.ncbi.nlm.nih.gov/32695847/) treats consecutive-day observations and temporal pattern review as central to interpretation; this product applies that temporal principle without importing its cytology workflow.
- A field study of [electronic laboratory notebook practices](https://pmc.ncbi.nlm.nih.gov/articles/PMC5443717/) found varied researcher work patterns and argues against a rigid one-size-fits-all system.
- The [Ten simple rules for implementing electronic laboratory notebooks](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1012170) recommends testing workflows and documentation with researchers and lab assistants in parallel.
- An [adaptable electronic laboratory notebook approach](https://doi.org/10.5334/jors.391) describes automated metadata capture as a way to reduce documentation effort and human error.

## Validation gate

Run the Daily Brief, single-observation, and batch-review tasks with the scientist collaborator and at least one frequent recorder such as a lab assistant or intern. Measure whether they can complete the normal path without explanation, where they hesitate, and whether the saved export contains the context they expect.
