import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { getDashboard, seedDemoData, API_BASE_URL } from '../services/api';
import './Dashboard.css';

const COLORS = ['#4f8ef7', '#7c5cd8', '#4caf7d', '#f7a94f', '#f74f6a', '#4fc3f7'];

const fmt = (n) => {
  const val = Number(n || 0);
  const isNeg = val < 0;
  const abs = Math.abs(val);
  const rounded = Math.round(abs);
  return isNeg ? `-$${rounded}` : `$${rounded}`;
};
const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`;

function MetricCard({ title, value, change, changePct, sub, status }) {
  const positive = (change || 0) >= 0;
  const isLoss = status === 'loss' || (typeof value === 'string' && value.startsWith('-$'));
  return (
    <div className={`metric-card ${isLoss ? 'card-loss' : ''}`}>
      <div className="metric-header-row">
        <div className="metric-title">{title}</div>
        {status === 'loss' && <span className="status-badge loss-badge">NET DEFICIT</span>}
        {status === 'profit' && <span className="status-badge profit-badge">HEALTHY</span>}
      </div>
      <div className={`metric-value ${isLoss ? 'val-loss' : ''}`}>{value}</div>
      {change !== undefined && (
        <div className={`metric-change ${positive ? 'pos' : 'neg'}`}>
          {positive ? '▲' : '▼'} {fmt(Math.abs(change))} ({fmtPct(Math.abs(changePct))})
        </div>
      )}
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('');
  const [error, setError] = useState(null);

  // Executive Projection & Scenario Simulator Controls
  const [simRevChange, setSimRevChange] = useState(0); // -30% to +30%
  const [simCostChange, setSimCostChange] = useState(0); // -30% to +30%

  useEffect(() => {
    setLoading(true);
    getDashboard(period || undefined)
      .then(r => {
        setData(r.data);
        if (!period && r.data.current_period) {
          setPeriod(r.data.current_period);
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [period]);

  const simulationMetrics = useMemo(() => {
    if (!data || !data.metrics) return null;
    const m = data.metrics;
    const baseRev = m.revenue;
    const baseExp = m.expenses;
    const simRev = baseRev * (1 + simRevChange / 100);
    const simExp = baseExp * (1 + simCostChange / 100);
    const baseProfit = m.profit;
    const simProfit = simRev - m.cogs - simExp;
    const profitDelta = simProfit - baseProfit;
    return {
      simRev,
      simExp,
      simProfit,
      profitDelta,
      marginPct: simRev > 0 ? ((simRev - m.cogs) / simRev) * 100 : 0,
    };
  }, [data, simRevChange, simCostChange]);

  if (loading) return <div className="loading">Connecting to ledger database...</div>;
  if (error) {
    return (
      <div className="dashboard-error-banner">
        <div className="error-card">
          <span className="error-icon">⚠️</span>
          <h3 className="error-title">Backend Connection Required</h3>
          <p className="error-desc">{error}</p>
          <div className="error-instructions">
            <p style={{ marginTop: 0, marginBottom: '10px', fontSize: '0.85rem' }}>
              <strong>Target URL:</strong> <code>{API_BASE_URL || '(relative to current domain)'}</code>
            </p>
            <strong>Vercel Deployment Checklist:</strong>
            <ul>
              <li>Open your Frontend Project on Vercel → <strong>Settings</strong> → <strong>Environment Variables</strong>.</li>
              <li>Ensure <code>VITE_API_URL</code> points to your deployed backend (e.g. <code>https://ibm-hackathon-backend.vercel.app</code> without a trailing slash).</li>
              <li>Trigger a redeploy of the frontend so the new environment variable takes effect.</li>
            </ul>
          </div>
          <button className="error-retry-btn" onClick={() => window.location.reload()}>
            ↻ Retry Connection
          </button>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const m = data.metrics || {};
  const prior = data.prior_metrics;
  const profitChange = prior ? m.profit - prior.profit : undefined;
  const profitChangePct = prior && prior.profit !== 0 ? (profitChange / Math.abs(prior.profit)) * 100 : 0;
  const revChange = prior ? m.revenue - prior.revenue : undefined;
  const revChangePct = prior && prior.revenue !== 0 ? (revChange / Math.abs(prior.revenue)) * 100 : 0;

  const hasData = (data.available_periods || []).length > 0 && m.transaction_count > 0;
  const dailyData = (data.daily_trend || []).map(d => ({
    date: d.date.length > 5 ? d.date.slice(5) : d.date,
    revenue: d.revenue,
    expenses: d.expenses,
    profit: d.profit,
  }));

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Intelligence Dashboard</h1>
          <p className="page-subtitle">Real-time ledger reconciliation & anomaly detection overview</p>
        </div>

        {hasData ? (
          <div className="period-selector">
            {data.available_periods.map(p => (
              <button
                key={p}
                className={`period-btn ${p === period ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        ) : (
          <button
            className="period-btn active"
            style={{
              background: 'linear-gradient(135deg, #4f8ef7, #7c5cd8)',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              color: '#ffffff',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={async () => {
              setLoading(true);
              try {
                await seedDemoData();
                const res = await getDashboard();
                setData(res.data);
                if (res.data.current_period) setPeriod(res.data.current_period);
              } catch (err) {
                console.error("Seeding failed:", err);
              } finally {
                setLoading(false);
              }
            }}
          >
            ⚡ Load Demo Dataset (900+ Records)
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="metric-grid">
        <MetricCard
          title="Gross Revenue"
          value={fmt(m.revenue)}
          change={revChange}
          changePct={revChangePct}
          sub="Reconciled Sales Inflow"
        />
        <MetricCard
          title="Total Operating Costs"
          value={fmt(m.expenses)}
          change={prior ? m.expenses - prior.expenses : undefined}
          changePct={prior && prior.expenses ? ((m.expenses - prior.expenses) / Math.abs(prior.expenses)) * 100 : 0}
          sub="Purchases + Ops + Fees"
        />
        <MetricCard
          title="Net Ledger Profit"
          value={fmt(m.profit)}
          status={m.profit < 0 ? 'loss' : m.profit > 0 ? 'profit' : undefined}
          change={profitChange}
          changePct={profitChangePct}
          sub="Revenue - COGS - Overhead"
        />
        <MetricCard
          title="Gross Margin"
          value={fmtPct(m.gross_margin_pct)}
          change={prior ? m.gross_margin_pct - prior.gross_margin_pct : undefined}
          changePct={prior ? m.gross_margin_pct - prior.gross_margin_pct : 0}
          sub="(Revenue - COGS) / Revenue"
        />
        <MetricCard
          title="Refund Rate"
          value={fmtPct(m.refund_rate_pct)}
          change={prior ? m.refund_rate_pct - prior.refund_rate_pct : undefined}
          changePct={prior ? m.refund_rate_pct - prior.refund_rate_pct : 0}
          sub="Refunds / Sales"
        />
        <MetricCard
          title="Audited Records"
          value={m.transaction_count || 0}
          sub="Ledger Transactions"
        />
      </div>

      {/* Clean Database Prompt if No Data */}
      {!hasData && (
        <div className="clean-db-banner">
          <div className="clean-db-content">
            <span className="clean-db-icon">✨</span>
            <div className="clean-db-text">
              <h3>Clean Database Ready — Zero Dummy Data</h3>
              <p>All synthetic records have been permanently wiped from disk. Add custom transactions or import an audited CSV to render dynamic visualizations in real time.</p>
            </div>
            <div className="clean-db-actions">
              <button className="clean-add-btn" onClick={() => navigate('/transactions')}>
                + Go to Transactions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Main Cashflow & Margin Trajectory */}
        <div className="chart-card wide">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-title">Cashflow & Profit Trajectory</h3>
              <p className="chart-subtitle">
                Daily breakdown of revenue, operating costs, and net margin for {period || 'active period'}
              </p>
            </div>
          </div>

          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={dailyData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f74f6a" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f74f6a" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4caf7d" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4caf7d" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222842" />
                <XAxis dataKey="date" stroke="#8892b0" tick={{ fontSize: 11 }} />
                <YAxis stroke="#8892b0" tickFormatter={v => `$${Math.round(v)}`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val, name) => [fmt(val), name]}
                  contentStyle={{ background: '#121626', border: '1px solid #2e3354', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                <ReferenceLine y={0} stroke="rgba(247, 79, 106, 0.4)" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Gross Revenue"
                  stroke="#4f8ef7"
                  strokeWidth={2.5}
                  fill="url(#revGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Operating Costs"
                  stroke="#f74f6a"
                  strokeWidth={2.5}
                  fill="url(#costGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Net Ledger Profit"
                  stroke="#4caf7d"
                  strokeWidth={2.5}
                  fill="url(#profitGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart-notice">
              <span>No transactions recorded for {period || 'selected period'}. Record or import transactions to plot live dynamic lines.</span>
            </div>
          )}
        </div>

        {/* Cost Composition Pie */}
        <div className="chart-card">
          <h3 className="chart-title">Cost Composition</h3>
          <p className="chart-subtitle">Operating vs Procurement vs Transactional Fees</p>
          {(data.expense_breakdown || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.expense_breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                >
                  {data.expense_breakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#121626', border: '1px solid #2e3354', borderRadius: '8px' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart-notice">No expense records found.</div>
          )}
        </div>

        {/* Category Performance Bar */}
        <div className="chart-card">
          <h3 className="chart-title">Product Category Revenue & Margin</h3>
          <p className="chart-subtitle">Gross Profit generated per department</p>
          {(data.category_performance || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.category_performance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222842" />
                <XAxis dataKey="category" stroke="#8892b0" tick={{ fontSize: 11 }} />
                <YAxis stroke="#8892b0" tickFormatter={v => `$${Math.round(v)}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#121626', border: '1px solid #2e3354', borderRadius: '8px' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                <Bar dataKey="revenue" name="Revenue" fill="#4f8ef7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gross_profit" name="Gross Profit" fill="#4caf7d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart-notice">No categorized sales found.</div>
          )}
        </div>

        {/* Executive Projection & Scenario Modeling Card */}
        {hasData && (
          <div className="chart-card wide simulator-card">
            <div className="simulator-header">
              <div>
                <span className="simulator-badge">⚡ Executive Forecasting</span>
                <h3 className="chart-title">Financial Projection & Scenario Modeling</h3>
                <p className="chart-subtitle">Simulate real-time P&L sensitivity under varying sales growth and vendor cost swings</p>
              </div>
              {simulationMetrics && (
                <div className="simulator-impact-badge">
                  <span>Projected Impact: </span>
                  <strong className={simulationMetrics.profitDelta >= 0 ? 'pos' : 'neg'}>
                    {simulationMetrics.profitDelta >= 0 ? '+' : ''}{fmt(simulationMetrics.profitDelta)}
                  </strong>
                </div>
              )}
            </div>

            <div className="simulator-body">
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Sales Volume / Price Adjustment:</span>
                  <strong className={simRevChange >= 0 ? 'pos' : 'neg'}>
                    {simRevChange > 0 ? '+' : ''}{simRevChange}%
                  </strong>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="5"
                  value={simRevChange}
                  onChange={e => setSimRevChange(Number(e.target.value))}
                  className="slider-input"
                />
              </div>

              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Vendor Cost Variation:</span>
                  <strong className={simCostChange <= 0 ? 'pos' : 'neg'}>
                    {simCostChange > 0 ? '+' : ''}{simCostChange}%
                  </strong>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="5"
                  value={simCostChange}
                  onChange={e => setSimCostChange(Number(e.target.value))}
                  className="slider-input"
                />
              </div>

              {(simRevChange !== 0 || simCostChange !== 0) && (
                <button
                  className="reset-sim-btn"
                  onClick={() => { setSimRevChange(0); setSimCostChange(0); }}
                >
                  Reset Baseline
                </button>
              )}
            </div>

            {simulationMetrics && (
              <div className="sim-kpi-grid">
                <div className="sim-kpi">
                  <span className="sim-kpi-label">Projected Revenue</span>
                  <span className="sim-kpi-val">{fmt(simulationMetrics.simRev)}</span>
                </div>
                <div className="sim-kpi">
                  <span className="sim-kpi-label">Projected Operating Costs</span>
                  <span className="sim-kpi-val">{fmt(simulationMetrics.simExp)}</span>
                </div>
                <div className="sim-kpi">
                  <span className="sim-kpi-label">Projected Net Profit / (Loss)</span>
                  <span className={`sim-kpi-val ${simulationMetrics.simProfit >= 0 ? 'pos' : 'neg'}`}>
                    {fmt(simulationMetrics.simProfit)}
                  </span>
                </div>
                <div className="sim-kpi">
                  <span className="sim-kpi-label">Projected Gross Margin</span>
                  <span className="sim-kpi-val">{fmtPct(simulationMetrics.marginPct)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
