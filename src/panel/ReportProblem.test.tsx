import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeraApi } from '../shared/api';
import { ReportProblem } from './Apply';
import type { Row } from './rows';

const row = (over: Partial<Row>) => ({ label: 'Phone', kind: 'tel', purpose: 'phone', group: 'contact', required: true, options: [], status: 'filled', value: '+1 555 0100', ...over }) as unknown as Row;
const input = {
  phase: 'done', plan: null, error: '', warnings: [],
  rows: [row({}), row({ label: 'Gender', purpose: 'gender', group: 'self_id', value: 'Woman' })],
};

beforeEach(() => {
  vi.stubGlobal('chrome', { runtime: { getManifest: () => ({ version: '9.9.9' }), sendMessage: vi.fn(async () => ({ ok: true, value: [] })) } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('reporting a problem', () => {
  it('sends the note with the page, version and what Wera read, without self-identification answers', async () => {
    const reportProblem = vi.fn(async () => ({ id: 1 }));
    render(<ReportProblem api={{ reportProblem } as unknown as WeraApi} a={input} onClose={() => {}} />);
    const send = screen.getByRole('button', { name: 'Send report' });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText('What went wrong?'), 'The phone box was left empty.');
    await userEvent.click(send);
    expect(await screen.findByText(/Sent\. Thank you/)).toBeInTheDocument();
    const [sent] = reportProblem.mock.calls[0] as unknown as [{ note: string; page: string; version: string; details: string }];
    expect(sent.note).toBe('The phone box was left empty.');
    expect(sent.version).toBe('9.9.9');
    expect(sent.page).toBe(`${location.host}${location.pathname}`);
    expect(sent.details).toContain('+1 555 0100');
    expect(sent.details).not.toContain('Woman');
  });

  it('says so when it could not send, and keeps the note', async () => {
    const reportProblem = vi.fn(async () => { throw new Error('offline'); });
    render(<ReportProblem api={{ reportProblem } as unknown as WeraApi} a={input} onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText('What went wrong?'), 'Broken');
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText(/offline|Couldn't send/)).toBeInTheDocument();
    expect(screen.getByLabelText('What went wrong?')).toHaveValue('Broken');
  });
});
