import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { runInvestigation, getInvestigations, deleteInvestigation, getDashboard } from '../services/api';
import './Investigation.css';

const QUICK_PROMPTS = [
  { label: 'Why did profit decrease?', q: 'Why did profit decrease in the latest period?' },
  { label: 'Why did expenses increase?', q: 'Why did expenses increase compared to prior period?' },
  { label: 'Revenue increased but profit fell?', q: 'Revenue increased but net profit fell — investigate root cause.' },
  { label: 'Which products lost margin?', q: 'Which products lost margin and caused gross deficit?' },
  { label: 'Which supplier increased costs?', q: 'Which supplier increased procurement costs?' },
  { label: 'Are there unusual transactions?', q: 'Are there unusual transactions or anomalous refunds?' },
  { label: 'What changed this month?', q: 'What changed financially between the two periods?' },
];

export default function Investigation() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [currentPeriod, setCurrentPeriod] = useState('2026-02');
  const [comparisonPeriod, setComparisonPeriod] = useState('2026-01');
  const [availablePeriods, setAvailablePeriods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [recentInvs, setRecentInvs] = useState([]);

  const loadRecent = () => {
    getInvestigations()
      .then(r => setRecentInvs(r.data || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadRecent();
    getDashboard()
      .then(res => {
        const periods = res.data?.available_periods || [];
        if (periods.length > 0) {
          setAvailablePeriods(periods);
          const latest = periods[periods.length - 1];
          const prior = periods.length >= 2 ? periods[periods.length - 2] : periods[0];
          setCurrentPeriod(latest);
          setComparisonPeriod(prior);
        }
      })
      .catch(() => {});
  }, []);


  const handleDeleteRecent = async (invId, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete investigation ${invId}?`)) return;
    try {
      await deleteInvestigation(invId);
      setRecentInvs(prev => prev.filter(i => i.investigation_id !== invId));
    } catch (err) {
      alert(`Could not delete: ${err.message}`);
    }
  };

  const handlePrompt = (q) => setQuestion(q);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setWorkflowSteps([{ step: 'Starting investigation...', status: 'running' }]);

    try {
      const resp = await runInvestigation({
        question: question.trim(),
        current_period: currentPeriod,
        comparison_period: comparisonPeriod,
      });
      navigate(`/investigations/${resp.data.investigation_id}`, { state: resp.data });
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Investigation failed';
      setError(msg);
    } finally {
      setLoading(false);
      setWorkflowSteps([]);
    }
  };

  return (
    <div className="investigation-page">
      <div className="page-header">
        <h1 className="page-title">Financial Investigation</h1>
        <p className="page-sub">Ask any financial question — the system investigates the underlying data.</p>
      </div>

      {/* Quick prompts */}
      <div className="quick-prompts">
        <div className="prompts-label">Quick prompts:</div>
        <div className="prompts-grid">
          {QUICK_PROMPTS.map(p => (
            <button
              key={p.label}
              className="prompt-btn"
              onClick={() => handlePrompt(p.q)}
              disabled={loading}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Question form */}
      <form className="question-form" onSubmit={handleSubmit}>
        <div className="question-input-wrap">
          <textarea
            className="question-input"
            placeholder="What would you like to investigate? e.g. Why did profit decrease in February?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            rows={3}
            disabled={loading}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Current Period (Target)</label>
            <input
              type="text"
              className="period-input"
              list="avail-periods-current"
              value={currentPeriod}
              onChange={e => setCurrentPeriod(e.target.value)}
              placeholder="YYYY-MM"
              pattern="\d{4}-\d{2}"
              disabled={loading}
              required
            />
            <datalist id="avail-periods-current">
              {availablePeriods.map(p => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div className="form-group">
            <label>Comparison Period (Baseline)</label>
            <input
              type="text"
              className="period-input"
              list="avail-periods-compare"
              value={comparisonPeriod}
              onChange={e => setComparisonPeriod(e.target.value)}
              placeholder="YYYY-MM"
              pattern="\d{4}-\d{2}"
              disabled={loading}
              required
            />
            <datalist id="avail-periods-compare">
              {availablePeriods.map(p => <option key={p} value={p} />)}
            </datalist>
          </div>
          <button
            type="submit"
            className="submit-btn"
            disabled={loading || !question.trim()}
          >
            {loading ? 'Investigating...' : 'Investigate'}
          </button>
        </div>
        {availablePeriods.length > 0 && (
          <div style={{ fontSize: '12px', color: '#8892b0', marginTop: '6px' }}>
            Ledger Active Periods: {availablePeriods.map(p => (
              <span
                key={p}
                style={{
                  display: 'inline-block',
                  marginRight: '6px',
                  padding: '2px 8px',
                  background: '#1b2038',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: '1px solid #2e3354',
                  color: '#4f8ef7'
                }}
                onClick={() => setCurrentPeriod(p)}
                title="Click to set as Current Period"
              >
                {p}
              </span>
            ))}
          </div>
        )}

      </form>

      {/* Loading workflow */}
      {loading && (
        <div className="workflow-progress">
          <div className="workflow-title">Investigation in progress...</div>
          <div className="workflow-spinner" />
          <div className="workflow-steps">
            {['Understanding question', 'Creating investigation plan', 'Calculating metrics',
              'Analyzing supplier costs', 'Detecting anomalies', 'Retrieving evidence',
              'Verifying calculations', 'Generating explanation'].map((step, i) => (
              <div key={step} className="wf-step running">
                <span className="wf-icon">⟳</span> {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="error-box">
          <strong>Investigation Error:</strong> {error}
        </div>
      )}

      {/* Recent Investigations List with Removal Option */}
      {recentInvs.length > 0 && (
        <div className="recent-invs-section">
          <h2 className="recent-invs-title">Recent Investigation Reports</h2>
          <div className="recent-invs-grid">
            {recentInvs.map(inv => (
              <div key={inv.investigation_id} className="recent-inv-card">
                <div className="recent-inv-header">
                  <span className="recent-inv-badge">{inv.intent?.replace(/_/g, ' ') || 'Investigation'}</span>
                  <span className="recent-inv-period">{inv.current_period} vs {inv.comparison_period}</span>
                </div>
                <div className="recent-inv-q" onClick={() => navigate(`/investigations/${inv.investigation_id}`)}>
                  "{inv.question}"
                </div>
                <div className="recent-inv-footer">
                  <span className="recent-inv-id">{inv.investigation_id}</span>
                  <div className="recent-inv-actions">
                    <button
                      className="open-inv-btn"
                      onClick={() => navigate(`/investigations/${inv.investigation_id}`)}
                    >
                      Inspect →
                    </button>
                    <button
                      className="delete-recent-btn"
                      title="Delete this report"
                      onClick={(e) => handleDeleteRecent(inv.investigation_id, e)}
                    >
                      ✕ Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

