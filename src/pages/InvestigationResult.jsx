import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { getInvestigation, deleteInvestigation, askInvestigationFollowUp } from '../services/api';
import './InvestigationResult.css';
const fmt = (n) => {
  const num = Number(n || 0);
  const isNeg = num < 0;
  const abs = Math.abs(num);
  return `${isNeg ? '-' : ''}$${Math.round(abs)}`;
};
const fmtAbs = (n) => `$${Math.round(Math.abs(Number(n || 0)))}`;

function WorkflowTrace({ steps }) {
  return (
    <div className="workflow-trace">
      <h3 className="section-title">Agentic LangGraph Workflow</h3>
      <div className="trace-steps">
        {steps.map((s, i) => (
          <div key={i} className={`trace-step ${s.status}`}>
            <span className="trace-icon">
              {s.status === 'completed' ? '✓' : s.status === 'failed' ? '✗' : s.status === 'skipped' ? '–' : '⟳'}
            </span>
            <span className="trace-label">{s.step}</span>
            {s.details && <span className="trace-detail">{s.details}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function FindingCard({ finding, onViewEvidence }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const isPositive = (finding.impact || 0) > 0;
  const severityClass = finding.severity || 'medium';

  return (
    <div className={`finding-card ${severityClass}`}>
      <div className="finding-header">
        <span className={`finding-badge ${isPositive ? 'increase' : 'decrease'}`}>
          {isPositive ? '+' : ''}{fmt(finding.impact)}
        </span>
        <span className={`verified-badge ${finding.verified}`}>{finding.verified}</span>
        <span className="severity-badge">{finding.severity || 'high'}</span>
      </div>
      <p className="finding-desc">{finding.description}</p>
      {finding.entity && <div className="finding-entity">Entity: {finding.entity}</div>}
      {finding.evidence_ids && finding.evidence_ids.length > 0 && (
        <button
          className="evidence-btn"
          onClick={() => { setShowEvidence(!showEvidence); onViewEvidence && onViewEvidence(finding); }}
        >
          {showEvidence ? 'Hide Evidence' : `View Ledger Evidence (${finding.evidence_ids.length} txs)`}
        </button>
      )}
    </div>
  );
}

function EvidenceRows({ rows }) {
  return (
    <div className="evidence-table-wrap">
      <table className="evidence-table">
        <thead>
          <tr>
            <th>TX ID</th>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th>Category</th>
            <th>Supplier / Product</th>
            <th className="amount-col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx, i) => (
            <tr key={tx.transaction_id || i}>
              <td className="mono">{tx.transaction_id}</td>
              <td>{tx.date}</td>
              <td><span className={`type-badge ${tx.transaction_type}`}>{tx.transaction_type}</span></td>
              <td className="desc-col">{tx.description}</td>
              <td>{tx.category}</td>
              <td>{tx.supplier || tx.product || '–'}</td>
              <td className="amount-col">{fmt(tx.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const QUICK_QUESTIONS = [
  'What were the top 3 supplier cost increases?',
  'What actionable remediation plan do you recommend?',
  'Are there any anomalous or duplicate transactions?',
  'Explain the net margin contraction drivers',
];

export default function InvestigationResult() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState(location.state || null);
  const [loading, setLoading] = useState(!location.state);
  const [error, setError] = useState(null);
  const [activeEvidence, setActiveEvidence] = useState(null);
  const [showAllEvidence, setShowAllEvidence] = useState(false);

  // Conversational AI State
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: "👋 I'm your AI Forensic Investigator. I've audited the ledger records for this inquiry. Ask me any follow-up question regarding suppliers, anomalies, or recommendations.",
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!result) {
      getInvestigation(id)
        .then(r => { setResult(r.data); setLoading(false); })
        .catch(e => { setError(e.message); setLoading(false); });
    }
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleAskQuestion = async (queryText) => {
    const q = queryText || chatInput;
    if (!q.trim() || isChatLoading) return;

    const userMsg = { sender: 'user', text: q.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const resp = await askInvestigationFollowUp(id, q.trim());
      const aiReply = {
        sender: 'ai',
        text: resp.data.answer,
        evidenceIds: resp.data.evidence_ids || [],
      };
      setChatMessages(prev => [...prev, aiReply]);
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        { sender: 'ai', text: `Failed to answer: ${err.message || 'Investigation server error'}` }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDeleteInvestigation = async () => {
    if (!window.confirm(`Delete this investigation report (${id})?`)) return;
    try {
      await deleteInvestigation(id);
      navigate('/investigate');
    } catch (err) {
      alert(`Could not delete investigation: ${err.message}`);
    }
  };

  if (loading) return <div className="loading">Retrieving audited investigation details...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!result) return <div className="error">Investigation not found</div>;

  const profitCmp = result.comparison?.net_profit;
  const profitChange = profitCmp?.change;

  // Build chart data for findings
  const findingChartData = (result.findings || [])
    .filter(f => f.impact && Math.abs(f.impact) > 100)
    .slice(0, 8)
    .map(f => ({
      name: (f.entity || f.finding_type || 'Variance').substring(0, 22),
      impact: Math.round(f.impact),
    }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  const verification = result.verification || {};
  const verificationPassed = verification.status === 'passed';

  return (
    <div className="result-page">
      {/* Header */}
      <div className="result-header">
        <div className="header-left">
          <div className="result-badge">{result.intent?.replace(/_/g, ' ') || 'Financial Investigation'}</div>
          <h1 className="result-question">"{result.question}"</h1>
          <div className="result-meta">
            <span>{result.current_period} vs {result.comparison_period}</span>
            <span className="sep">|</span>
            <span>ID: {result.investigation_id}</span>
            <span className="sep">|</span>
            <span className={`status-badge ${result.status}`}>{result.status}</span>
          </div>
        </div>
        <div className="header-right">
          <button className="delete-inv-btn" onClick={handleDeleteInvestigation} title="Delete this investigation">
            ✕ Delete Report
          </button>
        </div>
      </div>

      {/* Key financial change */}
      {profitCmp && (
        <div className="key-change-card">
          <div className="key-change-metric">Net Ledger Profit Variance</div>
          <div className={`key-change-value ${profitChange < 0 ? 'neg' : 'pos'}`}>
            {profitChange >= 0 ? '+' : ''}{fmt(profitChange)}
          </div>
          <div className="key-change-detail">
            {fmt(profitCmp.comparison_value)} ({result.comparison_period}) → {fmt(profitCmp.current_value)} ({result.current_period})
            <span className="pct-change">
              ({profitCmp.change_pct >= 0 ? '+' : ''}{Number(profitCmp.change_pct || 0).toFixed(1)}%)
            </span>
          </div>
        </div>
      )}

      {/* Verification status */}
      <div className={`verification-bar ${verification.status}`}>
        <span className="v-icon">{verificationPassed ? '✓' : verification.status === 'partial' ? '⚠' : '✗'}</span>
        <span>Independent Ledger Verification: <strong>{verification.status?.toUpperCase() || 'PASSED'}</strong></span>
        {verification.errors && verification.errors.length > 0 && (
          <span className="v-errors"> | {verification.errors.filter(Boolean).slice(0, 2).join(', ')}</span>
        )}
      </div>

      <div className="result-grid">
        {/* Left column */}
        <div className="result-left">
          {/* Contributing factors */}
          {result.findings && result.findings.length > 0 && (
            <div className="section-card">
              <h3 className="section-title">Audited Contributing Factors</h3>
              <div className="findings-list">
                {result.findings.slice(0, 8).map((f, i) => (
                  <FindingCard
                    key={i}
                    finding={f}
                    onViewEvidence={(f) => setActiveEvidence(
                      activeEvidence?.entity === f.entity ? null : f
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Evidence panel for selected item */}
          {activeEvidence && result.evidence && (
            <div className="section-card">
              <h3 className="section-title">Ledger Evidence: {activeEvidence.entity}</h3>
              <p className="evidence-context">{activeEvidence.description}</p>
              <EvidenceRows rows={result.evidence.filter(e => !activeEvidence.entity || (e.finding_ref && e.finding_ref.includes(activeEvidence.entity)))} />
            </div>
          )}

          {/* All evidence records */}
          <div className="section-card">
            <div className="section-title-row">
              <h3 className="section-title">Complete Transaction Evidence ({(result.evidence || []).length})</h3>
              <button className="toggle-btn" onClick={() => setShowAllEvidence(!showAllEvidence)}>
                {showAllEvidence ? 'Hide' : 'Show All'}
              </button>
            </div>
            {showAllEvidence && result.evidence && (
              <EvidenceRows rows={result.evidence.slice(0, 50)} />
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="result-right">
          {/* AI Briefing */}
          {result.explanation && (
            <div className="section-card explanation-card">
              <div className="explanation-header">
                <span className="ibm-badge">IBM BOB 2.0 AI Reasoning</span>
                <h3 className="section-title">Executive Forensic Briefing</h3>
              </div>
              <div className="explanation-text">
                {result.explanation.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Dynamic Chat Box (Fixes "static question answer"!) */}
          <div className="section-card chat-card">
            <div className="chat-card-header">
              <div className="chat-indicator-dot" />
              <h3 className="section-title">Ask AI Investigator (Dynamic Follow-Up)</h3>
            </div>
            <p className="chat-sub">Ask any open-ended question to interrogate the underlying ledger & findings:</p>

            {/* Quick Prompts */}
            <div className="chat-quick-prompts">
              {QUICK_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  className="quick-q-btn"
                  onClick={() => handleAskQuestion(q)}
                  disabled={isChatLoading}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Message History */}
            <div className="chat-messages-container">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`chat-bubble-wrap ${msg.sender}`}>
                  <div className={`chat-bubble ${msg.sender}`}>
                    <div className="chat-bubble-text">
                      {msg.text.split('\n').map((p, pIdx) => (
                        <p key={pIdx}>{p}</p>
                      ))}
                    </div>
                    {msg.evidenceIds && msg.evidenceIds.length > 0 && (
                      <div className="chat-evidence-tags">
                        <span>Corroborated by:</span>
                        {msg.evidenceIds.slice(0, 4).map(eId => (
                          <span key={eId} className="evidence-tag">{eId}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="chat-bubble-wrap ai">
                  <div className="chat-bubble ai typing">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Box */}
            <form
              className="chat-input-row"
              onSubmit={(e) => { e.preventDefault(); handleAskQuestion(); }}
            >
              <input
                type="text"
                placeholder="Ask about this investigation (e.g. Which supplier spiked the most?)..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                disabled={isChatLoading}
              />
              <button type="submit" disabled={isChatLoading || !chatInput.trim()}>
                Send
              </button>
            </form>
          </div>

          {/* Impact chart */}
          {findingChartData.length > 0 && (
            <div className="section-card">
              <h3 className="section-title">Variance Impact by Entity ($)</h3>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={findingChartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222842" />
                  <XAxis type="number" stroke="#8892b0" tickFormatter={v => `$${(Math.abs(v)/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" stroke="#8892b0" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#121626', border: '1px solid #2e3354' }} />
                  <ReferenceLine x={0} stroke="#8892b0" />
                  <Bar dataKey="impact" name="Impact ($)" radius={[0, 4, 4, 0]}>
                    {findingChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.impact < 0 ? '#f74f6a' : '#4caf7d'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Workflow trace */}
          {result.workflow && result.workflow.length > 0 && (
            <WorkflowTrace steps={result.workflow} />
          )}
        </div>
      </div>
    </div>
  );
}
