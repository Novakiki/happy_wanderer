import { describe, it, expect, vi } from 'vitest';
import {
  normalizeLinkReferenceInput,
  normalizeReferenceRole,
  resolvePersonReferenceId,
} from './edit-references';

describe('normalizeReferenceRole', () => {
  it('returns valid role inputs', () => {
    expect(normalizeReferenceRole('witness', 'source')).toBe('witness');
    expect(normalizeReferenceRole('heard_from', 'source')).toBe('heard_from');
    expect(normalizeReferenceRole('source', 'related')).toBe('source');
    expect(normalizeReferenceRole('related', 'source')).toBe('related');
  });

  it('falls back for invalid roles', () => {
    expect(normalizeReferenceRole('invalid', 'source')).toBe('source');
    expect(normalizeReferenceRole(null, 'witness')).toBe('witness');
  });
});

describe('normalizeLinkReferenceInput', () => {
  it('returns null when required fields are missing', () => {
    expect(normalizeLinkReferenceInput({ display_name: 'Example' }, 'source')).toBeNull();
    expect(normalizeLinkReferenceInput({ url: 'https://example.com' }, 'source')).toBeNull();
  });

  it('trims fields and normalizes role', () => {
    const result = normalizeLinkReferenceInput(
      { display_name: ' Example ', url: ' https://example.com ', role: 'invalid' },
      'related'
    );

    expect(result).toEqual({
      id: undefined,
      display_name: 'Example',
      url: 'https://example.com',
      role: 'related',
    });
  });
});

describe('resolvePersonReferenceId', () => {
  it('uses submitted person_id when allowed', async () => {
    const canUse = vi.fn().mockResolvedValue(true);
    const resolveByName = vi.fn();

    const result = await resolvePersonReferenceId({
      ref: { person_id: 'person-1', name: 'Julie' },
      canUsePersonId: canUse,
      resolvePersonIdByName: resolveByName,
    });

    expect(result).toBe('person-1');
    expect(canUse).toHaveBeenCalledWith('person-1');
    expect(resolveByName).not.toHaveBeenCalled();
  });

  it('falls back to name when person_id is not allowed', async () => {
    const canUse = vi.fn().mockResolvedValue(false);
    const resolveByName = vi.fn().mockResolvedValue('person-2');

    const result = await resolvePersonReferenceId({
      ref: { person_id: 'person-1', name: 'Julie' },
      canUsePersonId: canUse,
      resolvePersonIdByName: resolveByName,
    });

    expect(result).toBe('person-2');
    expect(resolveByName).toHaveBeenCalledWith('Julie');
  });

  it('returns existing person id when no other resolution works', async () => {
    const canUse = vi.fn().mockResolvedValue(false);
    const resolveByName = vi.fn().mockResolvedValue(null);

    const result = await resolvePersonReferenceId({
      ref: { name: 'Unknown' },
      existingPersonId: 'person-3',
      canUsePersonId: canUse,
      resolvePersonIdByName: resolveByName,
    });

    expect(result).toBe('person-3');
  });

  it('returns null when no identifiers are provided', async () => {
    const canUse = vi.fn().mockResolvedValue(false);
    const resolveByName = vi.fn().mockResolvedValue(null);

    const result = await resolvePersonReferenceId({
      ref: {},
      canUsePersonId: canUse,
      resolvePersonIdByName: resolveByName,
    });

    expect(result).toBeNull();
  });
});
