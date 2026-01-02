export type ViewSpecRules = Record<string, unknown>;

export type ViewSpecDefinition = {
  name: string;
  projectionVersion: string;
  enabled: boolean;
};

export const DEFAULT_PROJECTION_VERSION = 'v1';

const viewSpecRulesByVersion: Record<string, ViewSpecRules> = {
  v1: {},
};

export function getViewSpecRules(projectionVersion: string): ViewSpecRules {
  return viewSpecRulesByVersion[projectionVersion] ?? viewSpecRulesByVersion[DEFAULT_PROJECTION_VERSION];
}
