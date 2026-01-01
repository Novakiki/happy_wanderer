'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formStyles } from '@/lib/styles';
import {
  PERSON_ROLE_LABELS,
  RELATIONSHIP_OPTIONS,
} from '@/lib/terminology';
import type { PersonReference, PersonRole } from '@/lib/form-types';

type PersonSearchResult = {
  person_id: string;
  display_name: string;
  relationship: string | null;
  linked: boolean;
  mention_count: number;
};

type Props = {
  value: PersonReference[];
  onChange: (people: PersonReference[]) => void;
  mode?: 'inline' | 'cards'; // inline = add form style, cards = edit form style
  showTypeahead?: boolean;
  showPhone?: boolean;
  label?: string;
  emptyMessage?: string;
};

const RELATIONSHIP_GROUPS = {
  family: [
    'parent',
    'child',
    'sibling',
    'cousin',
    'aunt_uncle',
    'niece_nephew',
    'grandparent',
    'grandchild',
    'in_law',
    'spouse',
  ],
  social: ['friend', 'neighbor', 'coworker', 'classmate'],
  other: ['acquaintance', 'other', 'unknown'],
} as const;

function renderRelationshipOptions(customValue?: string) {
  return (
    <>
      <option value="">Relationship to Val</option>
      {customValue ? (
        <optgroup label="Custom">
          <option value={customValue}>{customValue}</option>
        </optgroup>
      ) : null}
      <optgroup label="Family">
        {RELATIONSHIP_GROUPS.family.map((key) => (
          <option key={key} value={key}>
            {RELATIONSHIP_OPTIONS[key]}
          </option>
        ))}
      </optgroup>
      <optgroup label="Social">
        {RELATIONSHIP_GROUPS.social.map((key) => (
          <option key={key} value={key}>
            {RELATIONSHIP_OPTIONS[key]}
          </option>
        ))}
      </optgroup>
      <optgroup label="Other">
        {RELATIONSHIP_GROUPS.other.map((key) => (
          <option key={key} value={key}>
            {RELATIONSHIP_OPTIONS[key]}
          </option>
        ))}
      </optgroup>
    </>
  );
}

export default function PeopleSection({
  value,
  onChange,
  mode = 'inline',
  showTypeahead = true,
  showPhone = true,
  label = 'Who else was part of this?',
  emptyMessage = 'Add others who were there, told you this, or might remember more.',
}: Props) {
  // New person form state
  const [newName, setNewName] = useState('');
  const [newRelationship, setNewRelationship] = useState('');
  const [newRole, setNewRole] = useState<PersonRole>('witness');
  const [newPersonId, setNewPersonId] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState('');

  // Typeahead state
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search for people
  useEffect(() => {
    if (!showTypeahead || newName.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/people/search?q=${encodeURIComponent(newName)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
          setShowDropdown(data.results?.length > 0);
        }
      } catch (e) {
        console.error('Person search error:', e);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [newName, showTypeahead]);

  const selectPerson = (person: PersonSearchResult) => {
    setNewName(person.display_name);
    setNewPersonId(person.person_id);
    setNewRelationship(person.relationship || '');
    setShowDropdown(false);
    setSearchResults([]);
  };

  const addPerson = () => {
    if (!newName.trim()) return;

    const person: PersonReference = {
      name: newName.trim(),
      relationship: newRelationship || undefined,
      role: newRole,
      personId: newPersonId || undefined,
      phone: newPhone.trim() || undefined,
    };

    onChange([...value, person]);
    resetForm();
  };

  const removePerson = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updatePerson = (index: number, field: keyof PersonReference, fieldValue: string) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: fieldValue };
    onChange(updated);
  };

  const resetForm = () => {
    setNewName('');
    setNewRelationship('');
    setNewRole('witness');
    setNewPersonId(null);
    setNewPhone('');
    setShowDropdown(false);
  };

  // Cards mode (for edit form)
  if (mode === 'cards') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className={formStyles.label}>{label}</label>
          <button
            type="button"
            onClick={() => onChange([...value, { name: '', role: 'witness' }])}
            className={formStyles.buttonGhost}
          >
            + Add person
          </button>
        </div>
        <p className={formStyles.hint}>
          Names are masked per note.{' '}
          <Link href="/identity" className="text-[#e07a5f] hover:text-white transition-colors">
            How identity works
          </Link>
        </p>

        {value.length === 0 && (
          <p className={`${formStyles.hint} italic`}>{emptyMessage}</p>
        )}

        {value.map((person, index) => (
          <div
            key={person.id || index}
            className="space-y-2 p-3 rounded-lg bg-white/5 border border-white/10"
          >
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/50">Person {index + 1}</label>
              <button
                type="button"
                onClick={() => removePerson(index)}
                className="text-xs text-white/50 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
            <input
              type="text"
              value={person.name}
              onChange={(e) => updatePerson(index, 'name', e.target.value)}
              placeholder="Name"
              className={formStyles.input}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={person.relationship || ''}
                onChange={(e) => updatePerson(index, 'relationship', e.target.value)}
                className={formStyles.select}
              >
                {renderRelationshipOptions(
                  person.relationship && !(person.relationship in RELATIONSHIP_OPTIONS)
                    ? person.relationship
                    : undefined
                )}
              </select>
              <select
                value={person.role}
                onChange={(e) => updatePerson(index, 'role', e.target.value)}
                className={formStyles.select}
              >
                {Object.entries(PERSON_ROLE_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
            {showPhone && (
              <input
                type="tel"
                value={person.phone || ''}
                onChange={(e) => updatePerson(index, 'phone', e.target.value)}
                placeholder="Phone (optional - to invite them)"
                className={formStyles.input}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Inline mode (for add form)
  return (
    <div>
      <label className={formStyles.label}>{label}</label>
      <p className={formStyles.hint}>
        Names are masked per note.{' '}
        <Link href="/identity" className="text-[#e07a5f] hover:text-white transition-colors">
          How identity works
        </Link>
      </p>
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr,auto,auto]">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setNewPersonId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPerson();
                } else if (e.key === 'Escape') {
                  setShowDropdown(false);
                }
              }}
              onFocus={() => {
                if (searchResults.length > 0) {
                  setShowDropdown(true);
                }
              }}
              onBlur={() => {
                setTimeout(() => setShowDropdown(false), 150);
              }}
              placeholder="Name"
              className={formStyles.inputSmall}
              autoComplete="off"
            />
            {/* Typeahead dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl border border-white/10 bg-[#1a1a1a] shadow-lg overflow-hidden">
                {searchResults.map((person) => (
                  <button
                    key={person.person_id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectPerson(person)}
                    className="w-full px-3 py-2 text-left hover:bg-white/10 transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="text-sm text-white truncate">
                      {person.display_name}
                    </span>
                    <span className="text-xs text-white/50 flex-shrink-0">
                      {person.relationship &&
                        RELATIONSHIP_OPTIONS[
                          person.relationship as keyof typeof RELATIONSHIP_OPTIONS
                        ]}
                      {person.linked && (
                        <span className="ml-1 text-green-400">&#10003;</span>
                      )}
                      {!person.linked && person.mention_count > 0 && (
                        <span className="ml-1">{person.mention_count}&times;</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <select
            value={newRelationship}
            onChange={(e) => setNewRelationship(e.target.value)}
            className={`${formStyles.select} text-sm py-2`}
          >
            {renderRelationshipOptions()}
          </select>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as PersonRole)}
            className={`${formStyles.select} text-sm py-2`}
          >
            {Object.entries(PERSON_ROLE_LABELS).map(([val, lbl]) => (
              <option key={val} value={val}>
                {lbl}
              </option>
            ))}
          </select>
        </div>

        {/* Phone input - shown when name is entered */}
        {showPhone && newName.trim() && (
          <div className="flex items-center gap-2">
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone (optional - to invite them)"
              className={`flex-1 ${formStyles.inputSmall}`}
            />
            <span className="text-xs text-white/50 whitespace-nowrap">
              They can add their side
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={addPerson}
          disabled={!newName.trim() || !newRelationship}
          className={formStyles.buttonSecondary}
        >
          Add
        </button>
      </div>

      {/* Added people tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {value.map((person, i) => (
            <span key={i} className={formStyles.tag}>
              {person.name}
              {person.relationship && person.relationship !== 'unknown' && (
                <span className="text-[#e07a5f]/60 ml-1">
                  (
                  {RELATIONSHIP_OPTIONS[
                    person.relationship as keyof typeof RELATIONSHIP_OPTIONS
                  ] || person.relationship}
                  )
                </span>
              )}
              <span className="text-[#e07a5f]/40 ml-1 text-xs">
                &middot; {PERSON_ROLE_LABELS[person.role]}
              </span>
              {person.phone && (
                <span
                  className="text-[#e07a5f]/60 ml-1"
                  title={`Will invite: ${person.phone}`}
                >
                  +
                </span>
              )}
              <button
                type="button"
                onClick={() => removePerson(i)}
                className={formStyles.tagRemove}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
