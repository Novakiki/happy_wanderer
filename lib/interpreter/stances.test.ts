import { describe, it, expect } from 'vitest';
import {
  routeToStance,
  detectStanceSwitch,
  buildMixedIntentResponse,
} from './stances';

describe('routeToStance', () => {
  describe('routes to Guide for action requests', () => {
    it('detects "add a memory"', () => {
      const result = routeToStance('I want to add a memory about her cooking');
      expect(result.stance).toBe('guide');
      expect(result.confidence).toBe('high');
    });

    it('detects "edit my submission"', () => {
      const result = routeToStance('How do I edit my submission?');
      expect(result.stance).toBe('guide');
    });

    it('detects "can I delete"', () => {
      const result = routeToStance('Can I delete the memory I added?');
      expect(result.stance).toBe('guide');
    });

    it('detects "show me my memories"', () => {
      const result = routeToStance('Show me my submitted memories');
      expect(result.stance).toBe('guide');
    });
  });

  describe('routes to Guide for tool questions', () => {
    it('detects "how does this work"', () => {
      const result = routeToStance('How does the visibility system work?');
      expect(result.stance).toBe('guide');
    });

    it('detects "who can see"', () => {
      const result = routeToStance('Who can see my memories?');
      expect(result.stance).toBe('guide');
    });

    it('detects "what happens when"', () => {
      const result = routeToStance('What happens when I submit a memory?');
      expect(result.stance).toBe('guide');
    });
  });

  describe('routes to Listener for feedback', () => {
    it('detects "you should"', () => {
      const result = routeToStance('You should add a search feature');
      expect(result.stance).toBe('listener');
      expect(result.confidence).toBe('high');
    });

    it('detects "it would be better if"', () => {
      const result = routeToStance('It would be better if there was a timeline view');
      expect(result.stance).toBe('listener');
    });

    it('detects "this feels confusing"', () => {
      const result = routeToStance("This feels confusing, I'm not sure what to do");
      expect(result.stance).toBe('listener');
    });

    it('detects "feature request"', () => {
      const result = routeToStance('Feature request: add photo uploads');
      expect(result.stance).toBe('listener');
    });

    it('detects "bug"', () => {
      const result = routeToStance("I found a bug in the form");
      expect(result.stance).toBe('listener');
    });
  });

  describe('routes to Interpreter for Valerie questions', () => {
    it('detects "what was she like"', () => {
      const result = routeToStance('What was she like as a mother?');
      expect(result.stance).toBe('interpreter');
      expect(result.confidence).toBe('high');
    });

    it('detects "tell me about Val"', () => {
      const result = routeToStance('Tell me about Val');
      expect(result.stance).toBe('interpreter');
    });

    it('detects "patterns"', () => {
      const result = routeToStance('What patterns do you see in the memories?');
      expect(result.stance).toBe('interpreter');
    });

    it('detects "what do the notes say"', () => {
      const result = routeToStance('What do the notes say about her humor?');
      expect(result.stance).toBe('interpreter');
    });

    it('detects "stories about her"', () => {
      const result = routeToStance('Are there stories about her childhood?');
      expect(result.stance).toBe('interpreter');
    });
  });

  describe('handles mixed intents', () => {
    it('prioritizes guide over interpreter', () => {
      const result = routeToStance('How do I add a memory about Val?');
      expect(result.stance).toBe('guide');
      expect(result.confidence).toBe('medium');
      expect(result.mixedIntents).toBeDefined();
    });

    it('prioritizes guide over listener', () => {
      const result = routeToStance("This is confusing, how do I submit?");
      expect(result.stance).toBe('guide');
    });
  });

  describe('defaults safely', () => {
    it('defaults to interpreter for ambiguous messages', () => {
      const result = routeToStance('Hello');
      expect(result.stance).toBe('interpreter');
      expect(result.confidence).toBe('low');
    });

    it('defaults to interpreter for general questions', () => {
      const result = routeToStance('What can you tell me?');
      expect(result.stance).toBe('interpreter');
    });
  });
});

describe('detectStanceSwitch', () => {
  it('detects request to switch to interpreter', () => {
    const result = detectStanceSwitch('Switch to interpreter mode');
    expect(result.requested).toBe(true);
    expect(result.targetStance).toBe('interpreter');
  });

  it('detects request to switch to guide', () => {
    const result = detectStanceSwitch('Switch to guide mode please');
    expect(result.requested).toBe(true);
    expect(result.targetStance).toBe('guide');
  });

  it('detects request to switch to listener', () => {
    const result = detectStanceSwitch('I want to give feedback');
    expect(result.requested).toBe(true);
    expect(result.targetStance).toBe('listener');
  });

  it('detects implicit interpreter switch', () => {
    const result = detectStanceSwitch('Tell me about her patterns');
    expect(result.requested).toBe(true);
    expect(result.targetStance).toBe('interpreter');
  });

  it('returns false for non-switch messages', () => {
    const result = detectStanceSwitch('Hello there');
    expect(result.requested).toBe(false);
    expect(result.targetStance).toBeUndefined();
  });
});

describe('buildMixedIntentResponse', () => {
  it('builds response for interpreter with guide secondary', () => {
    const result = buildMixedIntentResponse('interpreter', ['action_request']);
    expect(result).toContain('interpreting patterns');
    expect(result).toContain('Guide');
  });

  it('builds response for guide with interpreter secondary', () => {
    const result = buildMixedIntentResponse('guide', ['valerie_question']);
    expect(result).toContain('helping you use the tool');
    expect(result).toContain('Interpreter');
  });

  it('returns empty for no secondary intents', () => {
    const result = buildMixedIntentResponse('interpreter', []);
    expect(result).toBe('');
  });
});
