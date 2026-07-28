-- Make real coat colour queryable so model performance can be audited by
-- subject phenotype rather than inferred from pixels or free-form notes.
ALTER TABLE mice
  ADD COLUMN IF NOT EXISTS coat_colour text,
  ADD COLUMN IF NOT EXISTS strain text;

ALTER TABLE mice
  ADD CONSTRAINT mice_coat_colour_check
  CHECK (
    coat_colour IS NULL
    OR coat_colour IN (
      'white',
      'black',
      'brown_agouti',
      'grey_blue',
      'mixed_patched',
      'other',
      'unknown'
    )
  );

CREATE INDEX IF NOT EXISTS idx_mice_cohort_coat_colour
  ON mice (cohort_id, coat_colour);

COMMENT ON COLUMN mice.coat_colour IS
  'Scientist-recorded coat-colour category for prospective model subgroup evaluation; never inferred by the classifier.';

COMMENT ON COLUMN mice.strain IS
  'Optional scientist-recorded strain or stock designation, for example C57BL/6J or BALB/c.';
