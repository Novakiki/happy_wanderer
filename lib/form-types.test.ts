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
    expect(mapLegacyPersonRole('witness')).toBe('witness');
    expect(mapLegacyPersonRole('heard_from')).toBe('heard_from');
    expect(mapLegacyPersonRole('source')).toBe('heard_from');
    expect(mapLegacyPersonRole('related')).toBe('related');
  });

  it('passes through new role values', () => {
    expect(mapLegacyPersonRole('was_there')).toBe('witness');
    expect(mapLegacyPersonRole('told_me')).toBe('heard_from');
    expect(mapLegacyPersonRole('might_remember')).toBe('related');
  });

  it('defaults unknown roles to witness', () => {
    expect(mapLegacyPersonRole('')).toBe('witness');
    expect(mapLegacyPersonRole('unknown')).toBe('witness');
    expect(mapLegacyPersonRole(null)).toBe('witness');
  });
});

describe('mapToLegacyPersonRole', () => {
  it('maps unified roles back to legacy values', () => {
    expect(mapToLegacyPersonRole('witness')).toBe('witness');
    expect(mapToLegacyPersonRole('heard_from')).toBe('heard_from');
    expect(mapToLegacyPersonRole('related')).toBe('related');
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

  it('maps legacy mixed sources to secondhand', () => {
    expect(deriveProvenanceFromSource('Mixed / not sure', null)).toEqual({
      type: 'secondhand',
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
  it('formats firsthand sources', () => {
    expect(provenanceToSource({ type: 'firsthand' })).toEqual({
      source_name: 'Personal memory',
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
