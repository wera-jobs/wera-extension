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
      dashboardUrl: (p: string) => `https://w${p}`, answers: vi.fn(async () => []),
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
    const api = { applicant: vi.fn(async () => view({})), dashboardUrl: (p: string) => `https://w${p}`, answers: vi.fn(async () => []) } as unknown as WeraApi;
    render(<DetailsView api={api} onClose={() => {}} />);
    expect(await screen.findByRole('link', { name: 'Add them in Wera' })).toHaveAttribute('href', 'https://w/profile#application');
  });

  it('finds, copies and forgets saved answers, and copies the skills', async () => {
    const deleteAnswer = vi.fn(async () => {});
    const api = {
      applicant: vi.fn(async () => view({ first_name: 'Ada' }, { skills: ['Go', 'SQL'] })), dashboardUrl: (p: string) => `https://w${p}`,
      answers: vi.fn(async () => [
        { id: 1, question: 'Why do you want to work here?', answer: 'Because the work matters.', company: 'Acme', at: 2 },
        { id: 2, question: 'Expected start date?', answer: 'Two weeks after an offer.', company: '', at: 1 },
      ]),
      deleteAnswer,
    } as unknown as WeraApi;
    render(<DetailsView api={api} onClose={() => {}} />);
    expect(await screen.findByRole('region', { name: 'Skills' })).toHaveTextContent('Go, SQL');
    const saved = screen.getByRole('region', { name: 'Saved answers' });
    fireEvent.change(within(saved).getByLabelText('Search saved answers'), { target: { value: 'start' } });
    expect(within(saved).queryByText('Because the work matters.')).toBeNull();
    fireEvent.click(within(saved).getByRole('button', { name: 'Forget the answer to Expected start date?' }));
    expect(deleteAnswer).toHaveBeenCalledWith(2);
    expect(within(saved).getByText('No saved answer matches.')).toBeInTheDocument();
  });
});

describe('editing my details in the panel', () => {
  it('changes a detail and the veteran status (three states), and saves them to Wera', async () => {
    const saveApplicant = vi.fn(async (a: Record<string, string>) => ({ applicant: a, saved: true }));
    const api = {
      applicant: vi.fn(async () => view({ first_name: 'Ada', city: 'Dallas', veteran: 'I am not a protected veteran' })),
      dashboardUrl: (p: string) => `https://w${p}`, answers: vi.fn(async () => []), saveApplicant,
    } as unknown as WeraApi;
    render(<DetailsView api={api} onClose={() => {}} />);
    // The old dashboard value reads as "not a veteran".
    expect(await screen.findByRole('button', { name: 'Copy Veteran status: Not a veteran' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Austin' } });
    fireEvent.change(screen.getByLabelText('Veteran status'), { target: { value: 'I am a veteran, but not a protected veteran' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saveApplicant).toHaveBeenCalledWith(expect.objectContaining({ first_name: 'Ada', city: 'Austin', veteran: 'I am a veteran, but not a protected veteran' })));
    expect(await screen.findByRole('button', { name: 'Copy City: Austin' })).toBeInTheDocument();
  });
});
