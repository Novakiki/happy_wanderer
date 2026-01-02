-- Remove subject-name people and prevent re-creating them.

WITH subject_people AS (
  SELECT DISTINCT p.id
  FROM people p
  LEFT JOIN person_aliases pa ON pa.person_id = p.id
  WHERE lower(trim(p.canonical_name)) IN (
    'val',
    'valerie',
    'valeri',
    'valera',
    'valeria',
    'valerius',
    'valerie anderson',
    'valerie park anderson'
  )
  OR lower(trim(pa.alias)) IN (
    'val',
    'valerie',
    'valeri',
    'valera',
    'valeria',
    'valerius',
    'valerie anderson',
    'valerie park anderson'
  )
)
DELETE FROM event_references er
USING subject_people sp
WHERE er.person_id = sp.id;

WITH subject_people AS (
  SELECT DISTINCT p.id
  FROM people p
  LEFT JOIN person_aliases pa ON pa.person_id = p.id
  WHERE lower(trim(p.canonical_name)) IN (
    'val',
    'valerie',
    'valeri',
    'valera',
    'valeria',
    'valerius',
    'valerie anderson',
    'valerie park anderson'
  )
  OR lower(trim(pa.alias)) IN (
    'val',
    'valerie',
    'valeri',
    'valera',
    'valeria',
    'valerius',
    'valerie anderson',
    'valerie park anderson'
  )
)
DELETE FROM people p
USING subject_people sp
WHERE p.id = sp.id;

DELETE FROM person_aliases
WHERE lower(trim(alias)) IN (
  'val',
  'valerie',
  'valeri',
  'valera',
  'valeria',
  'valerius',
  'valerie anderson',
  'valerie park anderson'
);

ALTER TABLE people
  ADD CONSTRAINT people_subject_name_check
  CHECK (
    lower(trim(canonical_name)) NOT IN (
      'val',
      'valerie',
      'valeri',
      'valera',
      'valeria',
      'valerius',
      'valerie anderson',
      'valerie park anderson'
    )
  );

ALTER TABLE person_aliases
  ADD CONSTRAINT person_aliases_subject_name_check
  CHECK (
    lower(trim(alias)) NOT IN (
      'val',
      'valerie',
      'valeri',
      'valera',
      'valeria',
      'valerius',
      'valerie anderson',
      'valerie park anderson'
    )
  );
