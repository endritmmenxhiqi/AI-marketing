import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Film,
  Sparkles,
  ArrowRight,
  Tags,
  Mic2,
  RefreshCcw,
  TrendingUp,
  Image as ImageIcon,
  PlayCircle,
} from 'lucide-react';
import {
  fetchGenerations,
  generateMarketingContent,
  refreshGenerationMedia as refreshGenerationMediaRequest,
  refreshGenerationVoice as refreshGenerationVoiceRequest,
  renderGenerationPreview as renderGenerationPreviewRequest,
} from '../services/api';

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [generations, setGenerations] = useState([]);
  const [meta, setMeta] = useState({ total: 0, ready: 0, platforms: 0 });
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingMedia, setRefreshingMedia] = useState(false);
  const [refreshingVoice, setRefreshingVoice] = useState(false);
  const [renderingPreview, setRenderingPreview] = useState(false);
  const [form, setForm] = useState({
    productDescription: '',
    keywords: '',
    style: 'bold and modern',
    platform: 'tiktok',
    objective: '',
  });

  const loadGenerations = async () => {
    try {
      setLoading(true);
      const response = await fetchGenerations({ limit: 8 });
      const nextGenerations = response.data.data || [];
      setGenerations(nextGenerations);
      setMeta(response.data.meta || { total: 0, ready: 0, platforms: 0 });
      setSelectedGeneration((current) => current || nextGenerations[0] || null);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'Failed to load saved generations.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGenerations();
  }, []);

  const stats = [
    { label: 'Saved jobs', value: String(meta.total || 0), icon: BarChart3, trend: `${meta.ready || 0} ready`, color: '#6366f1' },
    { label: 'Platforms', value: String(meta.platforms || 0), icon: Film, trend: 'TikTok, Reels, Shorts', color: '#10b981' },
    { label: 'Latest status', value: selectedGeneration?.status || 'idle', icon: Sparkles, trend: 'AI-driven workflow', color: '#f59e0b' },
  ];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.productDescription.trim()) {
      setFeedback({ type: 'error', message: 'Product description is required.' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback({ type: '', message: '' });
      const response = await generateMarketingContent(form);
      const newGeneration = response.data.data;

      setGenerations((prev) => [newGeneration, ...prev].slice(0, 8));
      setSelectedGeneration(newGeneration);
      setMeta((prev) => ({
        total: (prev.total || 0) + 1,
        ready: (prev.ready || 0) + 1,
        platforms: new Set([...generations.map((item) => item.platform), newGeneration.platform]).size,
      }));
      setFeedback({ type: 'success', message: 'Marketing content generated and saved.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'Failed to generate marketing content.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshMedia = async () => {
    if (!selectedGeneration?._id) return;

    try {
      setRefreshingMedia(true);
      const response = await refreshGenerationMediaRequest(selectedGeneration._id);
      const updatedGeneration = response.data.data;

      setGenerations((prev) =>
        prev.map((item) => (item._id === updatedGeneration._id ? updatedGeneration : item))
      );
      setSelectedGeneration(updatedGeneration);
      setFeedback({ type: 'success', message: 'Media suggestions refreshed.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'Failed to refresh media suggestions.',
      });
    } finally {
      setRefreshingMedia(false);
    }
  };

  const handleRefreshVoice = async () => {
    if (!selectedGeneration?._id) return;

    try {
      setRefreshingVoice(true);
      const response = await refreshGenerationVoiceRequest(selectedGeneration._id);
      const updatedGeneration = response.data.data;

      setGenerations((prev) =>
        prev.map((item) => (item._id === updatedGeneration._id ? updatedGeneration : item))
      );
      setSelectedGeneration(updatedGeneration);
      setFeedback({ type: 'success', message: 'Voiceover audio refreshed.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'Failed to refresh voiceover audio.',
      });
    } finally {
      setRefreshingVoice(false);
    }
  };

  const handleRenderPreview = async () => {
    if (!selectedGeneration?._id) return;

    try {
      setRenderingPreview(true);
      const response = await renderGenerationPreviewRequest(selectedGeneration._id);
      const updatedGeneration = response.data.data;

      setGenerations((prev) =>
        prev.map((item) => (item._id === updatedGeneration._id ? updatedGeneration : item))
      );
      setSelectedGeneration(updatedGeneration);
      setFeedback({
        type: updatedGeneration.assets?.videoUrl ? 'success' : 'error',
        message: updatedGeneration.assets?.videoUrl
          ? 'Preview video rendered successfully.'
          : updatedGeneration.render?.errorMessage || 'Preview render failed.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'Failed to render preview video.',
      });
    } finally {
      setRenderingPreview(false);
    }
  };

  const photoResults = selectedGeneration?.media?.photos || [];
  const videoResults = selectedGeneration?.media?.videos || [];

  return (
    <div className="dashboard-content">
      <header className="page-header">
        <div>
          <h1 className="auth-title">Generation Studio, {user?.email?.split('@')[0]}</h1>
          <p className="auth-subtitle">Create captions, hashtags, voiceover copy, and visual direction from a single brief.</p>
        </div>
        <button className="dashboard-refresh-btn" type="button" onClick={loadGenerations} disabled={loading}>
          <RefreshCcw size={16} />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </header>

      <div className="dashboard-grid">
        {stats.map((stat, idx) => (
          <div key={idx} className="stat-card">
            <div className="stat-header">
              <div className="stat-icon-wrapper" style={{ color: stat.color }}>
                <stat.icon size={24} />
              </div>
              <div className="stat-trend">
                <TrendingUp size={14} />
                <span>{stat.trend}</span>
              </div>
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {feedback.message ? (
        <div className={`dashboard-banner ${feedback.type}`}>
          {feedback.message}
        </div>
      ) : null}

      <div className="dashboard-panels">
        <section className="dashboard-panel generation-form-panel">
          <div className="panel-heading">
            <h3>Create Marketing Generation</h3>
            <p>Describe the product once and let the system generate the marketing building blocks for your short-form video.</p>
          </div>

          <form className="dashboard-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="productDescription">Product description</label>
              <textarea
                id="productDescription"
                name="productDescription"
                value={form.productDescription}
                onChange={handleChange}
                rows={5}
                placeholder="Describe your product, audience, offer, and what makes it useful."
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="keywords">Keywords</label>
                <input
                  id="keywords"
                  name="keywords"
                  value={form.keywords}
                  onChange={handleChange}
                  placeholder="AI tools, productivity, startup growth"
                />
              </div>
              <div className="form-group">
                <label htmlFor="style">Style</label>
                <input
                  id="style"
                  name="style"
                  value={form.style}
                  onChange={handleChange}
                  placeholder="Bold and modern"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="platform">Platform</label>
                <select id="platform" name="platform" value={form.platform} onChange={handleChange}>
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram Reels</option>
                  <option value="youtube">YouTube Shorts</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="objective">Objective</label>
                <input
                  id="objective"
                  name="objective"
                  value={form.objective}
                  onChange={handleChange}
                  placeholder="Drive demo bookings"
                />
              </div>
            </div>

            <button className="btn-primary dashboard-submit" type="submit" disabled={submitting}>
              {submitting ? 'Generating...' : 'Generate content pack'}
            </button>
          </form>
        </section>

        <section className="dashboard-panel generation-output-panel">
          <div className="panel-heading">
            <div>
              <h3>Latest Output</h3>
              <p>Use this as the source for your voiceover, text overlays, and media search.</p>
            </div>
            {selectedGeneration ? (
              <button
                type="button"
                className="dashboard-refresh-btn"
                onClick={handleRefreshMedia}
                disabled={refreshingMedia}
              >
                <RefreshCcw size={16} />
                <span>{refreshingMedia ? 'Refreshing media...' : 'Refresh media'}</span>
              </button>
            ) : null}
          </div>

          {selectedGeneration ? (
            <div className="generation-output">
              <div className="output-block">
                <div className="output-label">Caption</div>
                <p>{selectedGeneration.outputs?.caption || 'No caption generated yet.'}</p>
              </div>

              <div className="output-grid">
                <div className="output-block">
                  <div className="output-label"><Tags size={14} /> Hashtags</div>
                  <p>{(selectedGeneration.outputs?.hashtags || []).join(' ') || 'No hashtags yet.'}</p>
                </div>
                <div className="output-block">
                  <div className="output-label"><Mic2 size={14} /> Call to action</div>
                  <p>{selectedGeneration.outputs?.callToAction || 'No CTA yet.'}</p>
                </div>
              </div>

              <div className="output-block">
                <div className="output-label-row">
                  <div className="output-label">Voiceover script</div>
                  {selectedGeneration ? (
                    <button
                      type="button"
                      className="dashboard-refresh-btn output-refresh-btn"
                      onClick={handleRefreshVoice}
                      disabled={refreshingVoice}
                    >
                      <RefreshCcw size={14} />
                      <span>{refreshingVoice ? 'Refreshing voice...' : 'Refresh voice'}</span>
                    </button>
                  ) : null}
                </div>
                <p>{selectedGeneration.outputs?.voiceoverScript || 'No voiceover script yet.'}</p>

                {!selectedGeneration.voice?.configured ? (
                  <p className="output-note">Add `DEEPGRAM_API_KEY` in the backend `.env` to generate audio. `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` still work as fallbacks.</p>
                ) : selectedGeneration.voice?.errorMessage ? (
                  <p className="output-note">{selectedGeneration.voice.errorMessage}</p>
                ) : selectedGeneration.assets?.audioUrl ? (
                  <audio className="voice-player" controls src={selectedGeneration.assets.audioUrl}>
                    Your browser does not support audio playback.
                  </audio>
                ) : (
                  <p className="output-note">No audio file generated yet.</p>
                )}
              </div>

              <div className="output-grid">
                <div className="output-block">
                  <div className="output-label">On-screen text</div>
                  <ul className="output-list">
                    {(selectedGeneration.outputs?.onScreenText || []).map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="output-block">
                  <div className="output-label">Media keywords</div>
                  <ul className="output-list">
                    {(selectedGeneration.outputs?.mediaKeywords || []).map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="output-block">
                <div className="output-label">Visual direction</div>
                <p>{selectedGeneration.outputs?.visualDirection || 'No visual direction yet.'}</p>
              </div>

              <div className="output-block">
                <div className="output-label-row">
                  <div className="output-label">Preview render</div>
                  <button
                    type="button"
                    className="dashboard-refresh-btn output-refresh-btn"
                    onClick={handleRenderPreview}
                    disabled={renderingPreview}
                  >
                    <PlayCircle size={14} />
                    <span>{renderingPreview ? 'Rendering preview...' : 'Render preview'}</span>
                  </button>
                </div>

                {selectedGeneration.render?.errorMessage ? (
                  <p className="output-note">{selectedGeneration.render.errorMessage}</p>
                ) : selectedGeneration.assets?.videoUrl ? (
                  <div className="preview-player-wrap">
                    <video
                      className="preview-player"
                      controls
                      playsInline
                      src={selectedGeneration.assets.videoUrl}
                    />
                    <a
                      className="preview-link"
                      href={selectedGeneration.assets.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open preview in new tab
                    </a>
                  </div>
                ) : (
                  <p className="output-note">
                    Render a vertical preview from the current stock media, voiceover, and text overlays.
                  </p>
                )}
              </div>

              <div className="output-block">
                <div className="output-label">
                  <ImageIcon size={14} />
                  Stock media
                </div>

                {!selectedGeneration.media?.configured ? (
                  <p>Add `PEXELS_API_KEY` in the backend `.env` to fetch real photo and video suggestions.</p>
                ) : selectedGeneration.media?.errorMessage ? (
                  <p>{selectedGeneration.media.errorMessage}</p>
                ) : (
                  <>
                    <p className="media-query-text">
                      Search query: <strong>{selectedGeneration.media?.query || 'n/a'}</strong>
                    </p>

                    <div className="media-section">
                      <div className="media-section-header">
                        <span>Photos</span>
                        <span>{photoResults.length}</span>
                      </div>
                      {photoResults.length === 0 ? (
                        <p>No photo matches yet.</p>
                      ) : (
                        <div className="media-grid">
                          {photoResults.map((photo) => (
                            <a
                              key={`photo-${photo.externalId}`}
                              className="media-card"
                              href={photo.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img src={photo.thumbnailUrl} alt={photo.alt || 'Media suggestion'} />
                              <div className="media-card-meta">
                                <strong>{photo.photographer || 'Pexels photo'}</strong>
                                <span>{photo.width} x {photo.height}</span>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="media-section">
                      <div className="media-section-header">
                        <span>Videos</span>
                        <span>{videoResults.length}</span>
                      </div>
                      {videoResults.length === 0 ? (
                        <p>No video matches yet.</p>
                      ) : (
                        <div className="media-grid">
                          {videoResults.map((video) => (
                            <a
                              key={`video-${video.externalId}`}
                              className="media-card"
                              href={video.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <div className="media-thumb-wrap">
                                <img src={video.thumbnailUrl} alt="Video preview" />
                                <div className="media-play-badge">
                                  <PlayCircle size={18} />
                                </div>
                              </div>
                              <div className="media-card-meta">
                                <strong>Pexels video</strong>
                                <span>{video.duration}s • {video.width} x {video.height}</span>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="dashboard-empty">Run your first generation to see the saved output pack here.</div>
          )}
        </section>
      </div>

      <section className="dashboard-panel recent-generations-panel">
        <div className="panel-heading">
          <h3>Recent Generations</h3>
          <p>Each saved job represents a reusable piece of marketing work.</p>
        </div>

        <div className="dashboard-list">
          {generations.length === 0 ? (
            <div className="dashboard-empty">No generations saved yet.</div>
          ) : (
            generations.map((generation) => (
              <button
                key={generation._id}
                type="button"
                className={`dashboard-list-item ${selectedGeneration?._id === generation._id ? 'active' : ''}`}
                onClick={() => setSelectedGeneration(generation)}
              >
                <div>
                  <h4>{generation.title || generation.platform}</h4>
                  <p>{generation.platform} • {generation.style}</p>
                </div>
                <span className={`status-pill ${generation.status}`}>{generation.status}</span>
              </button>
            ))
          )}
        </div>
      </section>

      <div className="chat-link-card" onClick={() => navigate('/chat')} style={{ marginTop: '2.5rem' }}>
        <div className="chat-link-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Sparkles size={20} style={{ color: 'var(--accent)' }} />
            <h3>AI Assistant</h3>
          </div>
          <p>Use the assistant when you want to brainstorm freely outside the structured generation flow.</p>
        </div>
        <button className="btn-start-chat" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Open chat
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;
