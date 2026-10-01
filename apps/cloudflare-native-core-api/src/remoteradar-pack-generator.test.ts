import { describe, expect, it, vi } from 'vitest';
import { generateApplicationPack } from './remoteradar-pack-generator';

const input = {
  job: { title: 'Senior Engineer', company: 'Acme', location: 'Remote', description: 'Build TypeScript systems' },
  resume: { id: 'resume-1', name: 'Primary resume', summary: 'Engineer' },
  facts: [{ id: 'fact-1', kind: 'skill', label: 'TypeScript', value: '6 years' }],
  questions: { sponsorship: 'Do you need sponsorship?' },
};

describe('RemoteRadar application pack generator', () => {
  it('uses the AI API Hub contract before Workers AI and preserves confirmed facts verbatim', async () => {
    const aiRun = vi.fn();
    const hubFetch = vi.fn(async () => Response.json({ success: true, data: { raw: {
      choices: [{ message: { content: JSON.stringify({ resumeSummary: 'TypeScript engineer', coverLetter: 'Dear Acme team', answers: { sponsorship: 'No' } }) } }],
    } } }));
    const result = await generateApplicationPack({ AI_API_HUB: { fetch: hubFetch } as never, AI: { run: aiRun } as never }, input);
    expect(hubFetch).toHaveBeenCalledTimes(1);
    expect(aiRun).not.toHaveBeenCalled();
    expect(result.resumeSnapshot.confirmedFacts).toEqual(input.facts);
    expect(result.coverLetter).toBe('Dear Acme team');
  });

  it('falls back to Workers AI and accepts fenced JSON output', async () => {
    const run = vi.fn(async () => ({ response: '```json\n{"resumeSummary":"Grounded summary","coverLetter":"Hello","answers":{}}\n```' }));
    const result = await generateApplicationPack({ AI: { run } as never }, input);
    expect(run).toHaveBeenCalledWith('@cf/meta/llama-3.3-70b-instruct-fp8-fast', expect.objectContaining({ temperature: 0.2 }));
    expect(result.resumeSnapshot).toMatchObject({ resumeId: 'resume-1', summary: 'Grounded summary' });
  });

  it('rejects invalid provider output and empty confirmed facts', async () => {
    await expect(generateApplicationPack({ AI: { run: vi.fn(async () => ({ response: 'not json' })) } as never }, input)).rejects.toThrow('AI_INVALID_RESPONSE');
    await expect(generateApplicationPack({ AI: { run: vi.fn() } as never }, { ...input, facts: [] })).rejects.toThrow('CONFIRMED_RESUME_FACTS_REQUIRED');
  });
});
