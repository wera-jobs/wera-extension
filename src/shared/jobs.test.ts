import { describe, expect, it } from 'vitest';
import { prettyReason } from './jobs';

describe('why a job is ruled out, in words', () => {
  it('names the rule as the dashboard does', () => {
    expect(prettyReason('title:no_category')).toBe('Not one of your roles');
    expect(prettyReason('llm:years>3')).toBe('Needs more than 3 years');
    expect(prettyReason('sponsorship:explicit_no')).toBe('Sponsorship explicitly refused');
    expect(prettyReason('title:engineering_manager')).toBe('Engineering manager title');
    expect(prettyReason('something new')).toBe('something new');
  });
});
