import * as React from "react";
import { fetchSuggestions, Suggestion } from "./api";
import { getSelectedWord } from "./office";

type Status = "idle" | "loading" | "error";

export default function Taskpane(): JSX.Element {
  const [word, setWord] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [explanations, setExplanations] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string | null>(null);

  const checkSelection = React.useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const selected = await getSelectedWord();
      if (!selected) {
        setStatus("idle");
        setError("Select an Afaan Oromo word in the document first.");
        return;
      }
      setWord(selected);
      const result = await fetchSuggestions(selected);
      setMessage(result.message);
      setSuggestions(result.suggestions);
      setExplanations(result.explanations);
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <div className="taskpane">
      <h1>Afaan Oromo Assistant</h1>

      <button onClick={checkSelection} disabled={status === "loading"}>
        {status === "loading" ? "Checking…" : "Check Selected Word"}
      </button>

      {error && <p className="error">{error}</p>}

      {word && (
        <section>
          <h2>Detected word</h2>
          <p className="detected-word">{word}</p>
        </section>
      )}

      {suggestions.length > 0 && (
        <section>
          <h2>Possible meanings</h2>
          <ol>
            {suggestions.map((s) => (
              <li key={s.word}>
                <strong>{s.word}</strong> <em>({s.pos})</em>
                <p className="meaning">Meaning: {s.meaning}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {message && (
        <section>
          <h2>Suggestion</h2>
          <p>{message}</p>
        </section>
      )}

      {explanations.length > 0 && (
        <section>
          <h2>Explanation</h2>
          <ul>
            {explanations.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
