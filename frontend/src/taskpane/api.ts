export interface Suggestion {
  word: string;
  meaning: string;
  pos: string;
  explanation: string;
  score: number;
}

export interface SuggestResponse {
  input_word: string;
  message: string;
  suggestions: Suggestion[];
  explanations: string[];
}

// Points at the local FastAPI dev server by default; override via env/build
// config when deploying (see docs/architecture.md, "Deployment").
const API_BASE_URL = "http://127.0.0.1:8000";

export async function fetchSuggestions(word: string, context?: string): Promise<SuggestResponse> {
  const params = new URLSearchParams({ word });
  if (context) params.set("context", context);

  const response = await fetch(`${API_BASE_URL}/suggest?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Spelling assistance service returned ${response.status}`);
  }
  return (await response.json()) as SuggestResponse;
}
