import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeraApi } from '../shared/api';
import { DetailsView } from './DetailsView';

afterEach(cleanup);

const view = (applicant: Record<string, string>, more = {}) => ({
  applicant, saved: true, sources: {}, skills: [], experience: [], education: [], ...more,
});

describe('My details', () => {
  it('groups every filled detail, hides empty ones, and copies one on a tap', async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    const api = {
      applicant: vi.fn(async () => view(
        { first_name: 'Ada', last_name: 'Byrne', email: 'ada@example.com', phone: '', linkedin: 'https://linkedin.com/in/ada', salary_expectation: '120000' },
        { experience: [{ title: 'SRE', company: 'Globex', start: '2022-01', current: true }] },
      )),
      dashboardUrl: (p: string) => `https://w${p}`,
    } as unknown as WeraApi;
    render(<DetailsView api={api} onClose={() => {}} />);
    const contact = await screen.findByRole('region', { name: 'Contact' });
    expect(within(contact).queryByText('Phone')).toBeNull();
    fireEvent.click(within(contact).getByRole('button', { name: 'Copy Email: ada@example.com' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('ada@example.com'));
    expect(screen.getByRole('region', { name: 'Answers' })).toHaveTextContent('120000');
    expect(screen.getByRole('region', { name: 'Past jobs' })).toHaveTextContent('2022-01 to present');
    expect(screen.queryByRole('region', { name: 'Address' })).toBeNull();
  });

  it('says where to add details when there are none', async () => {
    const api = { applicant: vi.fn(async () => view({})), dashboardUrl: (p: string) => `https://w${p}` } as unknown as WeraApi;
    render(<DetailsView api={api} onClose={() => {}} />);
    expect(await screen.findByRole('link', { name: 'Add them in Wera' })).toHaveAttribute('href', 'https://w/profile#application');
  });
});
