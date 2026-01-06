import fs from 'node:fs';
import path from 'node:path';

type IdentityFixture = {
  personId: string;
  personName: string;
};

type IdentityNoteFixture = {
  id: string;
  title: string;
};

export type E2EFixtures = {
  identity?: IdentityFixture;
  identityNotes?: IdentityNoteFixture[];
};

const fixtureDir = path.join(process.cwd(), 'test-results');
const fixturePath = path.join(fixtureDir, 'e2e-fixtures.json');

export function readFixtures(): E2EFixtures {
  try {
    const raw = fs.readFileSync(fixturePath, 'utf8');
    return JSON.parse(raw) as E2EFixtures;
  } catch {
    return {};
  }
}

export function writeFixtures(data: E2EFixtures): void {
  if (!fs.existsSync(fixtureDir)) {
    fs.mkdirSync(fixtureDir, { recursive: true });
  }

  fs.writeFileSync(fixturePath, JSON.stringify(data, null, 2));
}

export function clearFixtures(): void {
  try {
    fs.unlinkSync(fixturePath);
  } catch {
    // ignore missing file
  }
}
