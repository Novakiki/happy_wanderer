import { describe, it, expect } from 'vitest';
import {
  mapLegacyPersonRole,
  mapToLegacyPersonRole,
  deriveProvenanceFromSource,
  provenanceToSource,
  type ProvenanceData,
} from './form-types';

describe('mapLegacyPersonRole', () => {
  it('maps legacy roles to unified roles', () => {
    expect(mapLegacyPersonRole('witness')).toBe('was_there');
    expect(mapLegacyPersonRole('heard_from')).toBe('told_me');
    expect(mapLegacyPersonRole('source')).toBe('told_me');
    expect(mapLegacyPersonRole('related')).toBe('might_remember');
  });

  it('passes through new role values', () => {
    expect(mapLegacyPersonRole('was_there')).toBe('was_there');
    expect(mapLegacyPersonRole('told_me')).toBe('told_me');
    expect(mapLegacyPersonRole('might_remember')).toBe('might_remember');
  });

  it('defaults unknown roles to was_there', () => {
    expect(mapLegacyPersonRole('')).toBe('was_there');
    expect(mapLegacyPersonRole('unknown')).toBe('was_there');
    expect(mapLegacyPersonRole(null)).toBe('was_there');
  });
});

describe('mapToLegacyPersonRole', () => {
  it('maps unified roles back to legacy values', () => {
    expect(mapToLegacyPersonRole('was_there')).toBe('witness');
    expect(mapToLegacyPersonRole('told_me')).toBe('heard_from');
    expect(mapToLegacyPersonRole('might_remember')).toBe('related');
  });
});

describe('deriveProvenanceFromSource', () => {
  it('treats missing or personal sources as firsthand', () => {
    expect(deriveProvenanceFromSource(null, null)).toEqual({ type: 'firsthand' });
    expect(deriveProvenanceFromSource('Personal memory', null)).toEqual({ type: 'firsthand' });
  });

  it('extracts told-by names from secondhand sources', () => {
    expect(deriveProvenanceFromSource('Told to me', null)).toEqual({
      type: 'secondhand',
      toldByName: '',
    });
    expect(deriveProvenanceFromSource('Told to me by Aunt Jane', null)).toEqual({
      type: 'secondhand',
      toldByName: 'Aunt Jane',
    });
    expect(deriveProvenanceFromSource('told to me by sam', null)).toEqual({
      type: 'secondhand',
      toldByName: 'sam',
    });
  });

  it('maps mixed sources to the mixed type', () => {
    expect(deriveProvenanceFromSource('Mixed / not sure', null)).toEqual({
      type: 'mixed',
      note: 'Mixed / not sure',
    });
  });

  it('treats other sources as references', () => {
    expect(deriveProvenanceFromSource('Her journal', 'https://example.com')).toEqual({
      type: 'from_references',
      referenceName: 'Her journal',
      referenceUrl: 'https://example.com',
    });
  });
});

describe('provenanceToSource', () => {
  it('formats firsthand and mixed sources', () => {
    expect(provenanceToSource({ type: 'firsthand' })).toEqual({
      source_name: 'Personal memory',
      source_url: '',
    });
    expect(provenanceToSource({ type: 'mixed', note: 'Not sure' })).toEqual({
      source_name: 'Not sure',
      source_url: '',
    });
  });

  it('formats secondhand sources with optional told-by names', () => {
    const withName: ProvenanceData = { type: 'secondhand', toldByName: 'Uncle John' };
    expect(provenanceToSource(withName)).toEqual({
      source_name: 'Told to me by Uncle John',
      source_url: '',
    });
    expect(provenanceToSource({ type: 'secondhand', toldByName: '' })).toEqual({
      source_name: 'Told to me',
      source_url: '',
    });
  });

  it('formats reference sources with name and url', () => {
    expect(provenanceToSource({
      type: 'from_references',
      referenceName: 'Photo album',
      referenceUrl: 'https://example.com',
    })).toEqual({
      source_name: 'Photo album',
      source_url: 'https://example.com',
    });
  });
});
