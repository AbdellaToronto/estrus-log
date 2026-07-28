# Estrus Log scientist-workflow design QA

## Source visual truth

- Daily Brief reference: `/Users/della/.codex/generated_images/019f783b-ec9b-77e3-81c7-bc9bbc53fc28/exec-3b7bf484-ecb7-47c2-984d-bc7068e61b21.png`
- Batch Review reference: `/Users/della/.codex/generated_images/019f783b-ec9b-77e3-81c7-bc9bbc53fc28/exec-824e8b93-e65a-46ea-96c4-09660b1e694b.png`
- Single-observation reference: `/Users/della/.codex/generated_images/019f783b-ec9b-77e3-81c7-bc9bbc53fc28/exec-1156f572-c995-4389-9d0d-a549620c3272.png`
- Visual contract: pale bone canvas, indigo serif hierarchy, thin neutral rules, compact uppercase labels, warm exception accents, and model evidence subordinate to the scientist's decision.
- Workflow contract: Daily Brief or cohort Today view → one observation or Bulk capture → confirm crop → receive optional binary review aid → scientist chooses the exact stage → save the lab record.

## Browser-rendered implementation

- Local routes: `http://localhost:3000/dashboard`, `http://localhost:3000/cohorts/730c89a9-223f-405e-9de4-c49a6f9e87f4/batch`, `http://localhost:3000/cohorts/730c89a9-223f-405e-9de4-c49a6f9e87f4/scans`, and `http://localhost:3000/scans/1947bd28-6237-459a-b878-dd2275537d84`.
- Desktop screenshots: `tmp/design-qa/daily-brief-due-list-1440x894.png`, `tmp/design-qa/single-observation-capture-progressive.png`, `tmp/design-qa/mouse-record-empty-state.png`, `tmp/design-qa/mouse-record-populated.png`, `tmp/design-qa/batch-review-1440x1024-v4.png`, `tmp/design-qa/batch-final-1440x1024.png`, `tmp/design-qa/batch-history-truthful.png`, and `tmp/design-qa/batch-session-action-needed.png`.
- Compact screenshots: `tmp/design-qa/batch-review-compact-960x683.png` and `tmp/design-qa/mouse-record-populated-compact.png`.
- Side-by-side comparison artifacts: `tmp/design-qa/daily-due-list-comparison.png`, `tmp/design-qa/mouse-record-comparison.png`, and `tmp/design-qa/batch-comparison.png`.
- Browser: in-app Browser. Desktop CSS viewport approximately 1440 × 894 at DPR 1.5; compact CSS viewport approximately 960 × 683.
- Local fixture state: one cohort, three active mice, two real external-photo uploads, two confirmed prepared crops, two conservative binary-model abstentions, and an exercised scientist stage selection. The fixture is labeled `local-rehearsal-fixture` and is not production evidence.

## Full-view comparison

The implementation retains the references' information architecture and visual system while using truthful local data. Daily Brief is a lab-wide due-work summary that now exposes the ordered mice due in each cohort. Its `Record` actions deep-link into the existing subject observation dialog, so researchers get a direct queue without creating a second record-entry surface. Batch Review preserves the reference's three-part workbench: context and batch controls, crop contact sheet, and a focused inspector.

Visible state differences are data- and contract-driven:

- The Daily reference contains six illustrative mice and a fictional current model lead. The live view shows the two real mice due in the local cohort, preserves their strain and coat metadata, and does not invent a model result before an image and crop exist.
- The Batch reference contains 12 illustrative crops. The live fixture contains two real portrait prepared crops and preserves the exact 83:128 processor-frame contract instead of stretching them into landscape thumbnails.
- The binary model appears only after crop confirmation and may return Early, Late, or Abstain. It never preselects the saved four-stage record.

## Focused comparison and iteration history

- P1 — primary analysis action fell below the first viewport: moved above progress/review receipts while crops are ready, then hidden once no confirmed crop remains to analyze.
- P1 — selecting a scientist stage called a route-revalidating server action from inside a React state updater: moved the mutation outside the updater. The interaction was re-run; the Next issue overlay did not return.
- P1 — the post-crop empty state said “Waiting for input” even when all crops were confirmed: corrected to “Ready for analysis.”
- P2 — legacy four-stage model output leaked onto crop cards: removed. It now appears only inside the collapsed `Legacy four-stage evidence` disclosure.
- P2 — model reasoning was being saved into the scientist notes field: separated into flexible model evidence; the notes field now contains only scientist-entered text.
- P2 — “3 mouses” appeared in assignment context: corrected to “3 mice.”
- P2 — fill images omitted responsive `sizes`: added explicit sizes for the crop grid and inspector.
- P2 — a disabled `Analyze confirmed crops (0)` action remained visually primary after analysis: hidden in review state.
- P2 — Daily Brief required researchers to open a cohort before discovering which mice were due: added a truthful ordered due list with direct `Record` actions and kept the existing observation dialog as the only entry surface.
- P2 — direct `?new=1` observation links produced React 19/Radix dialog ID hydration mismatches: deferred the subject-page dialogs until after hydration. The real link was clicked again and opened the capture dialog with no issue overlay.
- P2 — the initial single-observation screen gave cytology equal visual weight even though the current workflow is external-photo-first: moved cytology under `Other image types`, shortened capture copy, and hid crop confirmation and action controls until an image exists.
- P2 — a mouse with no records opened to empty charts, a blank image inspector, and an empty searchable library: replaced those inactive controls with one focused empty state and moved `Record observation` into the page header.
- P2 — populated mouse records opened with trend cards and summary statistics before the actual saved observation: moved the observation image, scientist-confirmed stage, capture date, and note immediately below subject identity; trends are now collapsed beneath the record.
- P2 — the populated image viewer showed non-functional zoom controls: removed them instead of presenting inactive core controls.
- P2 — provenance and legacy four-stage output competed with the scientist record: moved both into separate disclosures. A saved binary-model cross-check, when present, remains a distinct collapsed review-aid disclosure.
- P2 — at compact desktop width the large image pushed the saved stage below the fold: the stage/note panel now precedes the image until the two-column desktop breakpoint.
- P2 — the populated local rehearsal fixture labeled a visibly black C57BL/6J subject as white: corrected the local-only subject metadata to black before capture. No production record was changed.
- P1 — Batch History counted only permanent logs, so a real active session with two workflow photos appeared as `0/0 classified`: combined workflow-item and permanent-record sources without double-counting. The screen now says `2 photos`, `0 saved records`, and `2 photos still need scientist review`.
- P1 — the old receipt relabeled scientist-confirmed four-stage records as `AI result`, `confidence`, and `success rate`: replaced those semantics with a saved scientist stage and optional, separately disclosed binary-model evidence. Active sessions are now action-needed session pages rather than fake receipts.
- P1 — development Strict Mode hydrated the same persisted scan items twice, so following `Resume review` showed four photos even though the session contained two: resume hydration now merges by the persistent scan-item id. The full History → Resume review path was rerun and showed exactly two photos.
- P2 — date-only capture values were parsed as UTC and displayed one day early in Toronto: date-only values are now parsed as local calendar dates on both history and receipt screens.
- P2 — the post-batch history used generic scan/classification language and made every session look complete: changed the primary distinctions to `Need review`, `Saved records`, and `Photos across batches`, with unfinished work ordered first and a direct `Resume review` action.
- P3 — at compact desktop width the three-pane review remains usable but dense. This is acceptable for a review workstation; the app switches to its compact top navigation and each pane retains independent scrolling.

## Researcher-facing integrity checks

- Capture date is separate from upload time and is saved on every record.
- Subject identity is always chosen or created by the scientist; it is not inferred from the photograph or filename.
- Missing subject-days remain explicit. No stage is interpolated to fill a gap.
- Full source and prepared crop are shown together before the decision.
- The binary review aid is labeled as DINOv2, exposes abstention/domain reasons, and precedes but does not override the exact scientist stage decision.
- Scientist notes are optional, remain attributable to the human review, and are not replaced by model prose.
- Stable `data-tour` landmarks exist for Daily Brief, cohort continuation, model policy, Record one, and Bulk capture. A future coachmark tour can attach to these without becoming required navigation.

## Interaction and validation evidence

- Uploading two local photos restored/created prepared crops and rendered both full-source and prepared-crop views.
- `Analyze confirmed crops` was enabled in the correct state and removed after analysis.
- The first Daily Brief `Record` link was clicked in the browser and opened the correct mouse's `Capture one observation` dialog; no direct-route hydration issue remained.
- Initial capture now exposes the external-photo path, capture date, and a collapsed `Other image types` disclosure. Opening that disclosure reveals the manual cytology option without making it part of the default path.
- Populated record interactions exercised: selected history record, `Evidence and provenance`, `Legacy four-stage scores`, and `Cycle trends and summary`. Opening trends rendered both charts on demand; the issue overlay remained absent.
- A real stage button was clicked and reached `aria-pressed="true"`; the optional notes field accepted input; save remained gated by missing subject assignment and the remaining stage decision.
- The real post-batch route reported one session needing review, zero saved records, and two photos. Its `Resume review` action opened the existing batch workspace with two—not four—restored photos.
- The action-needed session view rendered both real workflow photos, labeled each `Awaiting scientist review`, exposed `Model: no suggestion` without fabricating a four-stage result, and opened its keyboard-accessible evidence dialog.
- History and action-needed session layouts were exercised at desktop and a narrow CSS viewport; headings, metrics, and primary actions remained readable without horizontal overflow.
- The final browser DOM exposed clear regions for `Abstain`, `Choose the stage to save`, notes, legacy evidence, and mouse assignment.
- Browser diagnostics after the stage-mutation fix contained no new application error. The remaining warnings are local Clerk development-key notices and Next image LCP guidance.
- `pnpm exec tsc --noEmit`: passed.
- Scoped ESLint over the Batch, Daily, cohort, layout, and action files: passed; only the dependency's stale Baseline-data notice was printed.
- `pnpm build`: passed, including the authenticated history and session routes.
- The existing workflow suite's most recent run passed 33/33. It was not rerun in this pass because direct Playwright CLI use requires an explicit approval under the active design workflow; the current authenticated routes were instead exercised in the in-app Browser.
- No deploy, remote database write, or production-service modification was performed.

## Final result

passed
