const SUBJECT_NAME_VARIANTS = new Set([
  'val',
  'valerie',
  'valeri',
  'valera',
  'valeria',
  'valerius',
  'valerie anderson',
  'valerie park anderson',
]);

export function isSubjectName(name: string): boolean {
  return SUBJECT_NAME_VARIANTS.has(name.toLowerCase().trim());
}
