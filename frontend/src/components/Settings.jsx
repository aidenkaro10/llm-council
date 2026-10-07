import { useState, useEffect } from 'react';
import * as storage from '../lib/storage';
import { getCredits } from '../lib/openrouter';
import './Settings.css';

/**
 * Settings panel: paste your OpenRouter key and pick who sits on the council.
 * The key is sent to the local server, written to .env, and never sent back.
 */
export default function Settings({ settings, models, onClose, onSaved }) {
  const [search, setSearch] = useState('');
  const [council, setCouncil] = useState(settings.councilModels);
  const [chairman, setChairman] = useState(settings.chairmanModel);
  const [apiKey, setApiKey] = useState('');
  const [credits, setCredits] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.apiKey) {
      getCredits(settings.apiKey).then(setCredits).catch(() => {});
    }
  }, [settings.apiKey]);

  const toggleJudge = (id) => {
    setCouncil((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const key = apiKey.trim();
      if (key && !key.startsWith('sk-or-')) {
        throw new Error("That doesn't look like an OpenRouter key. They start with sk-or-");
      }

      const saved = storage.saveSettings({
        ...(key ? { apiKey: key } : {}),
        councilModels: council,
        chairmanModel: council.includes(chairman) ? chairman : council[0],
      });

      setApiKey('');
      onSaved(saved);
      setStatus({ type: 'ok', text: 'Saved. It applies to your next question.' });
      getCredits(saved.apiKey).then(setCredits).catch(() => {});
    } catch (e) {
      setStatus({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  // Show the chosen judges first, then whatever matches the search box
  const query = search.trim().toLowerCase();
  const visible = (models || [])
    .filter((m) => !query || m.id.toLowerCase().includes(query))
    .slice(0, 60);
  const chosen = (models || []).filter((m) => council.includes(m.id));
  const listed = [...chosen, ...visible.filter((m) => !council.includes(m.id))];

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-button" onClick={onClose}>x</button>
        </div>

        <div className="settings-body">
          <section>
            <h3>OpenRouter API key</h3>
            {settings.apiKey ? (
              <p className="settings-note">
                A key is saved ({storage.keyPreview()}). Paste a new one below to replace it.
                {credits && (
                  <>
                    {' '}Balance left:{' '}
                    <strong>${(credits.remaining ?? 0).toFixed(2)}</strong>
                  </>
                )}
              </p>
            ) : (
              <p className="settings-note">
                No key saved yet. Get one at{' '}
                <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">
                  openrouter.ai/settings/keys
                </a>
                . It is stored in this browser only and sent straight to
                OpenRouter. There is no server in between.
              </p>
            )}
            <input
              type="password"
              className="settings-input"
              placeholder="sk-or-v1-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </section>

          <section>
            <h3>The council ({council.length} judges)</h3>
            <p className="settings-note">
              Every judge answers your question, then reviews everyone else. More
              judges means a better answer and a bigger bill.
            </p>
            <input
              className="settings-input"
              placeholder="Search models, e.g. claude, gemini, free"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="model-list">
              {listed.map((model) => (
                <label
                  key={model.id}
                  className={`model-row ${council.includes(model.id) ? 'chosen' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={council.includes(model.id)}
                    onChange={() => toggleJudge(model.id)}
                  />
                  <span className="model-id">{model.id}</span>
                  <span className="model-price">
                    ${model.promptPrice.toFixed(2)} in / $
                    {model.completionPrice.toFixed(2)} out per 1M
                  </span>
                </label>
              ))}
              {listed.length === 0 && <p className="settings-note">No models match that.</p>}
            </div>
          </section>

          <section>
            <h3>Chairman</h3>
            <p className="settings-note">
              Reads everything and writes the final answer. Usually your strongest judge.
            </p>
            <select
              className="settings-input"
              value={chairman}
              onChange={(e) => setChairman(e.target.value)}
            >
              {council.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </section>
        </div>

        <div className="settings-footer">
          {status && (
            <span className={`settings-status ${status.type}`}>{status.text}</span>
          )}
          <button
            className="save-button"
            onClick={handleSave}
            disabled={saving || council.length === 0}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
