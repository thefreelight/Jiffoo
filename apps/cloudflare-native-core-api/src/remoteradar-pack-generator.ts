export interface RemoteRadarPackGeneratorEnv {
  AI?: Ai;
  AI_API_HUB?: Fetcher;
  REMOTERADAR_AI_MODEL?: string;
}

export interface ConfirmedResumeFact {
  id: string;
  kind: string;
  label: string;
  value: string;
}

export interface ApplicationPackGenerationInput {
  job: { title: string; company: string; location: string | null; description: string };
  resume: { id: string; name: string; summary: string };
  facts: ConfirmedResumeFact[];
  questions: Record<string, unknown>;
}

export interface GeneratedApplicationPack {
  resumeSnapshot: Record<string, unknown>;
  coverLetter: string;
  answers: Record<string, unknown>;
}

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function jsonText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? value;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  return start >= 0 && end > start ? fenced.slice(start, end + 1) : null;
}

function providerText(payload: unknown): string | null {
  const root = object(payload);
  const data = object(root?.data);
  const raw = object(data?.raw) ?? object(root?.raw) ?? root;
  if (typeof raw?.response === 'string') return raw.response;
  const choices = Array.isArray(raw?.choices) ? raw.choices : [];
  const firstChoice = object(choices[0]);
  const message = object(firstChoice?.message);
  if (typeof message?.content === 'string') return message.content;
  const content = Array.isArray(raw?.content) ? raw.content : [];
  const textPart = content.map(object).find((item) => item?.type === 'text' && typeof item.text === 'string');
  if (typeof textPart?.text === 'string') return textPart.text;
  const candidates = Array.isArray(raw?.candidates) ? raw.candidates : [];
  const candidate = object(candidates[0]);
  const candidateContent = object(candidate?.content);
  const parts = Array.isArray(candidateContent?.parts) ? candidateContent.parts : [];
  const part = parts.map(object).find((item) => typeof item?.text === 'string');
  return typeof part?.text === 'string' ? part.text : null;
}

function parseGenerated(text: string): { resumeSummary: string; coverLetter: string; answers: Record<string, unknown> } {
  const candidate = jsonText(text);
  if (!candidate) throw new Error('AI_INVALID_RESPONSE');
  let parsed: Record<string, unknown> | null = null;
  try { parsed = object(JSON.parse(candidate)); } catch { throw new Error('AI_INVALID_RESPONSE'); }
  const resumeSummary = typeof parsed?.resumeSummary === 'string' ? parsed.resumeSummary.trim() : '';
  const coverLetter = typeof parsed?.coverLetter === 'string' ? parsed.coverLetter.trim() : '';
  const answers = object(parsed?.answers);
  if (!resumeSummary || resumeSummary.length > 4000 || !coverLetter || coverLetter.length > 20000 || !answers) {
    throw new Error('AI_INVALID_RESPONSE');
  }
  if (JSON.stringify(answers).length > 20000) throw new Error('AI_INVALID_RESPONSE');
  return { resumeSummary, coverLetter, answers };
}

function messages(input: ApplicationPackGenerationInput) {
  const groundedFacts = input.facts.map(({ id, kind, label, value }) => ({ id, kind, label, value }));
  const prompt = [
    {
      role: 'system' as const,
      content: [
        'You create truthful remote-job application materials.',
        'Use only the confirmed resume facts supplied by the user. Never invent employers, dates, skills, metrics, education, credentials, or contact details.',
        'Return JSON only with keys resumeSummary (string), coverLetter (string), and answers (object).',
        'If the confirmed facts do not support a claim, omit it. Do not mention job sources, URLs, competitors, or provenance.',
      ].join(' '),
    },
    {
      role: 'user' as const,
      content: JSON.stringify({ job: input.job, resume: { id: input.resume.id, name: input.resume.name }, confirmedFacts: groundedFacts, questions: input.questions }),
    },
  ];
  if (prompt[1].content.length > 60000) throw new Error('AI_INPUT_TOO_LARGE');
  return prompt;
}

async function callAiHub(env: RemoteRadarPackGeneratorEnv, promptMessages: ReturnType<typeof messages>): Promise<string | null> {
  if (!env.AI_API_HUB) return null;
  const response = await env.AI_API_HUB.fetch(new Request('https://ai-api-hub.internal/chat/text', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-jiffoo-caller': 'api-internal' },
    body: JSON.stringify({ messages: promptMessages, temperature: 0.2, maxTokens: 2400 }),
  }));
  const payload = await response.json<unknown>().catch(() => null);
  if (!response.ok) throw new Error('AI_PROVIDER_ERROR');
  return providerText(payload);
}

async function callWorkersAi(env: RemoteRadarPackGeneratorEnv, promptMessages: ReturnType<typeof messages>): Promise<string | null> {
  if (!env.AI) return null;
  const model = env.REMOTERADAR_AI_MODEL?.trim() || DEFAULT_MODEL;
  const output = await env.AI.run(model, {
    messages: promptMessages,
    temperature: 0.2,
    max_tokens: 2400,
    response_format: { type: 'json_object' },
  });
  return providerText(output);
}

export async function generateApplicationPack(
  env: RemoteRadarPackGeneratorEnv,
  input: ApplicationPackGenerationInput,
): Promise<GeneratedApplicationPack> {
  if (input.facts.length === 0) throw new Error('CONFIRMED_RESUME_FACTS_REQUIRED');
  const promptMessages = messages(input);
  const generatedText = await callAiHub(env, promptMessages) ?? await callWorkersAi(env, promptMessages);
  if (!generatedText) throw new Error('AI_PROVIDER_UNAVAILABLE');
  const generated = parseGenerated(generatedText);
  return {
    resumeSnapshot: {
      resumeId: input.resume.id,
      name: input.resume.name,
      summary: generated.resumeSummary,
      confirmedFacts: input.facts.map(({ id, kind, label, value }) => ({ id, kind, label, value })),
    },
    coverLetter: generated.coverLetter,
    answers: generated.answers,
  };
}
