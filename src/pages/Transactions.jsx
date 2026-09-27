import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  getTransactions,
  createTransaction,
  deleteTransaction,
  batchDeleteTransactions,
  purgeAllTransactions,
  generateScenario,
  seedDemoData,
  uploadTransactionsCsv,
} from '../services/api';
import './Transactions.css';

const fmt = (n) => {
  const num = Number(n || 0);
  const isNeg = num < 0;
  const abs = Math.abs(num);
  return `${isNeg ? '-' : ''}$${abs.toFixed(2)}`;
};

const TX_TYPES = ['', 'sale', 'purchase', 'expense', 'refund', 'fee'];

const CATEGORY_SUGGESTIONS = [
  'Electronics',
  'Cloud Infrastructure',
  'Software & SaaS',
  'Office Supplies',
  'Logistics & Freight',
  'Marketing & Growth',
  'Consulting & Legal',
  'Hardware Equipment',
];

const PRESET_TEMPLATES = [
  {
    label: '⚠️ Supplier Cost Shock',
    tag: 'Anomaly',
    color: '#f74f6a',
    data: {
      transaction_type: 'purchase',
      category: 'Electronics',
      amount: '18450.00',
      supplier: 'Supplier A',
      product: 'AI Cloud Workstation',
      description: 'Emergency microchip restock — expedited vendor surcharge applied',
      quantity: '10',
      cost: '18450.00',
    },
  },
  {
    label: '📈 Enterprise SaaS Inflow',
    tag: 'Revenue',
    color: '#4caf7d',
    data: {
      transaction_type: 'sale',
      category: 'Software & SaaS',
      amount: '38500.00',
      supplier: 'Supplier E',
      product: 'Enterprise SaaS Platform',
      customer: 'TechNova Global Corp',
      description: 'Annual enterprise multi-seat platform license',
      quantity: '1',
      cost: '3500.00',
    },
  },
  {
    label: '🔄 Hardware Defect Refunds',
    tag: 'Anomaly',
    color: '#f7a94f',
    data: {
      transaction_type: 'refund',
      category: 'Electronics',
      amount: '6800.00',
      product: 'Laptop Pro X1',
      customer: 'Client_Alpha',
      description: 'Batch recall refund wave — hardware motherboard defect',
      quantity: '4',
      cost: '0',
    },
  },
  {
    label: '☁️ Cloud Compute Surge',
    tag: 'Overhead',
    color: '#4fc3f7',
    data: {
      transaction_type: 'expense',
      category: 'Cloud Infrastructure',
      amount: '5200.00',
      supplier: 'AWS Cloud Systems',
      description: 'Peak cluster compute auto-scale surge during AI training',
      quantity: '1',
      cost: '5200.00',
    },
  },
  {
    label: '🚚 Air Freight Logistics',
    tag: 'Operations',
    color: '#9c88ff',
    data: {
      transaction_type: 'expense',
      category: 'Logistics & Freight',
      amount: '3400.00',
      supplier: 'Supplier D',
      description: 'Expedited air cargo tariff and customs clearance',
      quantity: '1',
      cost: '3400.00',
    },
  },
];

export default function Transactions() {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ period: '', transaction_type: '', category: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  const [isVerifyClearOpen, setIsVerifyClearOpen] = useState(false);
  const [verifyClearText, setVerifyClearText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const fileInputRef = useRef(null);

  // New Transaction Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    transaction_type: 'expense',
    category: 'Cloud Infrastructure',
    description: '',
    amount: '',
    supplier: '',
    customer: '',
    product: '',
    quantity: '1',
    cost: '',
  });

  // Scenario Generator Form State
  const [scenarioForm, setScenarioForm] = useState({
    scenario_type: 'cost_spike',
    period: '2026-03',
    company_name: 'TechNova Dynamics',
    record_count: 20,
  });

  const load = (f = filters) => {
    setLoading(true);
    const params = { limit: 1000 };
    if (f.period) params.period = f.period;
    if (f.transaction_type) params.transaction_type = f.transaction_type;
    if (f.category) params.category = f.category;
    getTransactions(params)
      .then(r => { setTxs(r.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const setFilter = (key, val) => {
    const next = { ...filters, [key]: val };
    setFilters(next);
    load(next);
  };

  // Dynamic Periods derived from actual database records
  const availablePeriods = useMemo(() => {
    const pSet = new Set(txs.map(t => t.period).filter(Boolean));
    return ['', ...Array.from(pSet).sort()];
  }, [txs]);

  // Dynamic Live Summary Metrics
  const stats = useMemo(() => {
    let salesTotal = 0;
    let outflowTotal = 0;
    txs.forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.transaction_type === 'sale') {
        salesTotal += amt;
      } else {
        outflowTotal += amt;
      }
    });
    return {
      count: txs.length,
      sales: salesTotal,
      outflow: outflowTotal,
      net: salesTotal - outflowTotal,
    };
  }, [txs]);

  const handleOpenModal = () => {
    setErrorMsg('');
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      transaction_type: 'expense',
      category: 'Cloud Infrastructure',
      description: '',
      amount: '',
      supplier: '',
      customer: '',
      product: '',
      quantity: '1',
      cost: '',
    });
    setIsModalOpen(true);
  };

  const applyPreset = (preset) => {
    setFormData(prev => ({
      ...prev,
      ...preset.data,
      date: prev.date || new Date().toISOString().slice(0, 10),
    }));
    setErrorMsg('');
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const amt = parseFloat(formData.amount);
    if (!formData.description.trim()) {
      setErrorMsg('Please enter a description for the transaction.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Amount must be a positive number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        date: formData.date,
        transaction_type: formData.transaction_type,
        category: formData.category,
        description: formData.description.trim(),
        amount: amt,
        quantity: parseFloat(formData.quantity) || 1.0,
        supplier: formData.supplier?.trim() || null,
        customer: formData.customer?.trim() || null,
        product: formData.product?.trim() || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
      };

      const res = await createTransaction(payload);
      setTxs(prev => [res.data, ...prev]);
      setIsModalOpen(false);
      setSuccessToast(`Dynamic Transaction ${res.data.transaction_id} committed to persistent ledger!`);
      setTimeout(() => setSuccessToast(''), 4500);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to create transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenClearVerify = () => {
    setVerifyClearText('');
    setIsVerifyClearOpen(true);
  };

  const handleConfirmPurge = async () => {
    if (verifyClearText.trim().toUpperCase() !== 'CLEAR') {
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await purgeAllTransactions();
      setTxs([]);
      setSelectedIds([]);
      setIsVerifyClearOpen(false);
      setSuccessToast(res.data.message || 'Ledger completely wiped. Purge state permanently recorded on disk.');
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err) {
      alert(`Wipe failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateScenarioSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await generateScenario({
        scenario_type: scenarioForm.scenario_type,
        period: scenarioForm.period,
        company_name: scenarioForm.company_name,
        record_count: parseInt(scenarioForm.record_count, 10) || 20,
      });
      setIsScenarioModalOpen(false);
      setSuccessToast(res.data.message || 'Dynamic scenario generated successfully!');
      load();
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err) {
      alert('Scenario generation failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeedDemoData = async () => {
    try {
      setLoading(true);
      await seedDemoData();
      setSuccessToast('Standard demo baseline dataset (900+ transactions) loaded successfully.');
      load();
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err) {
      alert('Failed to load demo dataset: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSingle = async (txId, e) => {
    e.stopPropagation();
    if (!window.confirm(`Permanently delete transaction ${txId}? This will remove it from disk immediately.`)) {
      return;
    }
    try {
      await deleteTransaction(txId);
      setTxs(prev => prev.filter(t => t.transaction_id !== txId));
      setSelectedIds(prev => prev.filter(id => id !== txId));
      setSuccessToast(`Transaction ${txId} permanently purged from database.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      alert(`Could not delete transaction: ${err.message}`);
    }
  };

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Are you sure you want to permanently delete all ${selectedIds.length} selected transactions from the database?`)) {
      return;
    }
    try {
      setLoading(true);
      await batchDeleteTransactions(selectedIds);
      setTxs(prev => prev.filter(t => !selectedIds.includes(t.transaction_id)));
      setSuccessToast(`Successfully removed ${selectedIds.length} transactions permanently.`);
      setSelectedIds([]);
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err) {
      alert(`Batch delete failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCsvFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      setLoading(true);
      const res = await uploadTransactionsCsv(fd);
      setSuccessToast(`Successfully imported ${res.data.inserted} transactions from ${file.name}!`);
      load();
    } catch (err) {
      alert('CSV upload failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(txs.map(t => t.transaction_id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (txId) => {
    setSelectedIds(prev =>
      prev.includes(txId) ? prev.filter(id => id !== txId) : [...prev, txId]
    );
  };

  return (
    <div className="transactions-page">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Ledger Transactions</h1>
          <p className="page-subtitle">Real-time ledger audit trail — records are stored and deleted permanently on disk</p>
        </div>

        <div className="header-actions-group">
          {/* Hidden File Input for CSV */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".csv"
            onChange={handleCsvFileChange}
          />

          <button className="scenario-gen-btn" onClick={() => setIsScenarioModalOpen(true)} title="Generate dynamic corporate scenario">
            ⚡ Custom Scenario
          </button>

          <button className="import-csv-btn" onClick={() => fileInputRef.current?.click()} title="Import transactions from CSV">
            📁 Import CSV
          </button>

          <button className="add-tx-btn" onClick={handleOpenModal}>
            <span className="plus-icon">+</span> Add Transaction
          </button>

          {txs.length > 0 ? (
            <button className="purge-all-btn" onClick={handleOpenClearVerify} title="Wipe all data with authorization check">
              🗑️ Clear All Data
            </button>
          ) : (
            <button className="seed-demo-btn" onClick={handleSeedDemoData} title="Load standard 900+ demo dataset">
              🔄 Load Demo Dataset
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successToast && (
        <div className="toast-banner">
          <span className="toast-icon">✓</span> {successToast}
        </div>
      )}

      {/* Live Financial Aggregates Bar */}
      <div className="tx-summary-strip">
        <div className="tx-summary-card">
          <span className="tx-summary-label">Reconciled Count</span>
          <span className="tx-summary-val">{stats.count} transactions</span>
        </div>
        <div className="tx-summary-card positive">
          <span className="tx-summary-label">Total Inflow (Sales)</span>
          <span className="tx-summary-val">{fmt(stats.sales)}</span>
        </div>
        <div className="tx-summary-card negative">
          <span className="tx-summary-label">Total Outflow (Costs & Fees)</span>
          <span className="tx-summary-val">{fmt(stats.outflow)}</span>
        </div>
        <div className={`tx-summary-card ${stats.net >= 0 ? 'positive' : 'negative'}`}>
          <span className="tx-summary-label">Net Ledger Cashflow</span>
          <span className="tx-summary-val">{stats.net >= 0 ? '+' : ''}{fmt(stats.net)}</span>
        </div>
      </div>

      {/* Batch Delete Floating Toolbar */}
      {selectedIds.length > 0 && (
        <div className="batch-action-bar">
          <span className="batch-count-tag">{selectedIds.length} records selected</span>
          <button className="batch-delete-btn" onClick={handleBatchDelete}>
            ✕ Permanently Delete Selected ({selectedIds.length})
          </button>
          <button className="batch-cancel-btn" onClick={() => setSelectedIds([])}>
            Deselect All
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <select value={filters.period} onChange={e => setFilter('period', e.target.value)} className="filter-select">
          {availablePeriods.map(p => <option key={p} value={p}>{p || 'All Periods'}</option>)}
        </select>
        <select value={filters.transaction_type} onChange={e => setFilter('transaction_type', e.target.value)} className="filter-select">
          {TX_TYPES.map(t => <option key={t} value={t}>{t ? t.toUpperCase() : 'All Types'}</option>)}
        </select>
        <input
          className="filter-input"
          placeholder="Filter by category (e.g. Cloud, Electronics)..."
          value={filters.category}
          onChange={e => setFilter('category', e.target.value)}
        />
        {(filters.period || filters.transaction_type || filters.category) && (
          <button className="reset-filter-btn" onClick={() => {
            const reset = { period: '', transaction_type: '', category: '' };
            setFilters(reset);
            load(reset);
          }}>
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">Processing ledger database...</div>
      ) : (
        <div className="tx-table-wrap">
          <table className="tx-table">
            <thead>
              <tr>
                <th className="checkbox-col">
                  <input
                    type="checkbox"
                    checked={txs.length > 0 && selectedIds.length === txs.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>TX ID</th>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Description</th>
                <th>Entity / Product</th>
                <th className="amount-col">Amount</th>
                <th>Status</th>
                <th className="action-col">Action</th>
              </tr>
            </thead>
            <tbody>
              {txs.map(tx => {
                const isSelected = selectedIds.includes(tx.transaction_id);
                const isDynamic = tx.transaction_id?.startsWith('TX-DYN') || tx.transaction_id?.startsWith('TX-');
                return (
                  <tr key={tx.transaction_id} className={isSelected ? 'selected-row' : ''}>
                    <td className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(tx.transaction_id)}
                      />
                    </td>
                    <td className="mono">
                      <span className="tx-id-label">{tx.transaction_id}</span>
                      {tx.transaction_id?.startsWith('TX-DYN') && (
                        <span className="dyn-badge" title="Dynamically Generated Record">DYN</span>
                      )}
                    </td>
                    <td>{tx.date}</td>
                    <td><span className={`type-badge ${tx.transaction_type}`}>{tx.transaction_type}</span></td>
                    <td>{tx.category}</td>
                    <td className="desc-col" title={tx.description}>{tx.description}</td>
                    <td>{tx.supplier || tx.customer || tx.product || '–'}</td>
                    <td className={`amount-col ${tx.transaction_type === 'sale' ? 'pos' : 'neg'}`}>
                      {tx.transaction_type === 'sale' ? '+' : '-'}{fmt(tx.amount)}
                    </td>
                    <td><span className={`status-dot ${tx.status}`}>{tx.status}</span></td>
                    <td className="action-col">
                      <button
                        className="tx-delete-btn"
                        title="Permanently remove from database"
                        onClick={(e) => handleDeleteSingle(tx.transaction_id, e)}
                      >
                        ✕ Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
              {txs.length === 0 && (
                <tr>
                  <td colSpan="10" className="no-tx-msg">
                    <div className="empty-state-box">
                      <span className="empty-icon">✨</span>
                      <h3>Clean Ledger Canvas — Zero Residual Records</h3>
                      <p>All records have been completely purged from disk. Your database is persistent and ready for dynamic live entries.</p>
                      <div className="empty-actions">
                        <button className="add-tx-btn" onClick={handleOpenModal}>+ Enter Dynamic Transaction</button>
                        <button className="scenario-gen-btn" onClick={() => setIsScenarioModalOpen(true)}>⚡ Generate Custom Scenario</button>
                        <button className="import-csv-btn" onClick={() => fileInputRef.current?.click()}>📁 Import CSV File</button>
                        <button className="seed-demo-btn" onClick={handleSeedDemoData}>🔄 Load 900+ Demo Dataset</button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Transaction Modal with Instant Realistic Presets */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Record Dynamic Transaction</h2>
                <p className="modal-sub">Create a custom financial transaction committed permanently to the SQL ledger</p>
              </div>
              <button className="modal-close-btn" onClick={() => !isSubmitting && setIsModalOpen(false)}>✕</button>
            </div>

            {/* Instant Realistic Scenario Presets */}
            <div className="presets-container">
              <span className="presets-label">⚡ Instant Realistic Presets (1-Click Fill):</span>
              <div className="presets-scroll">
                {PRESET_TEMPLATES.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="preset-chip"
                    onClick={() => applyPreset(p)}
                  >
                    <span>{p.label}</span>
                    <span className="chip-tag" style={{ background: p.color }}>{p.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="modal-form">
              {errorMsg && <div className="modal-error-box">{errorMsg}</div>}

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Transaction Type *</label>
                  <select
                    value={formData.transaction_type}
                    onChange={e => setFormData({ ...formData, transaction_type: e.target.value })}
                    required
                  >
                    <option value="expense">Expense (Operating / Overhead)</option>
                    <option value="purchase">Purchase (Inventory / Direct COGS)</option>
                    <option value="sale">Sale (Revenue Inflow)</option>
                    <option value="refund">Refund (Customer Reversal)</option>
                    <option value="fee">Fee (Bank / Gateway / Legal)</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Amount ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="e.g. 4500.00"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Category *</label>
                  <input
                    type="text"
                    list="cat-suggestions"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g. Cloud Infrastructure"
                    required
                  />
                  <datalist id="cat-suggestions">
                    {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              <div className="form-field">
                <label>Description *</label>
                <input
                  type="text"
                  placeholder="e.g. Server cluster compute hours - Invoice #1029"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="form-grid-3">
                <div className="form-field">
                  <label>Supplier / Vendor</label>
                  <input
                    type="text"
                    placeholder="e.g. CloudScale, Supplier A"
                    value={formData.supplier}
                    onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>Customer (for Sales)</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Corp, Client_10"
                    value={formData.customer}
                    onChange={e => setFormData({ ...formData, customer: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>Product / SKU</label>
                  <input
                    type="text"
                    placeholder="e.g. Laptop Pro X1"
                    value={formData.product}
                    onChange={e => setFormData({ ...formData, product: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="save-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Recording...' : 'Commit to Database Permanently'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verification Modal for Clear All Data */}
      {isVerifyClearOpen && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setIsVerifyClearOpen(false)}>
          <div className="modal-card verify-modal-card" onClick={e => e.stopPropagation()}>
            <div className="verify-header">
              <span className="verify-warn-icon">⚠️</span>
              <div>
                <h2 className="verify-title">Authorize Ledger Data Purge</h2>
                <p className="verify-sub">Permanent operation — prevents accidental data wipe</p>
              </div>
            </div>

            <div className="verify-body">
              <p className="verify-alert-text">
                This action will <strong>permanently purge all transactions, active investigations, and evidence logs</strong> from disk.
                The ledger will be reset to 0 records, giving you a fresh canvas for your dynamic entries.
              </p>
              <div className="verify-guarantee-box">
                🔒 <strong>Persistence Guaranteed:</strong> The purge state is saved in the database settings table.
                <strong> Refreshing the page will NEVER resurrect deleted data.</strong>
              </div>

              <div className="verify-input-group">
                <label className="verify-label">
                  To confirm authorization, type <span className="highlight-code">CLEAR</span> below:
                </label>
                <input
                  type="text"
                  className="verify-input"
                  autoFocus
                  placeholder="Type CLEAR to confirm..."
                  value={verifyClearText}
                  onChange={e => setVerifyClearText(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setIsVerifyClearOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="purge-confirm-btn"
                disabled={verifyClearText.trim().toUpperCase() !== 'CLEAR' || isSubmitting}
                onClick={handleConfirmPurge}
              >
                {isSubmitting ? 'Purging Database...' : 'Permanently Wipe All Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Scenario Generator Modal */}
      {isScenarioModalOpen && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setIsScenarioModalOpen(false)}>
          <div className="modal-card scenario-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">⚡ Dynamic Corporate Scenario Generator</h2>
                <p className="modal-sub">Inject an authentic corporate dataset to demonstrate AI investigation live</p>
              </div>
              <button className="modal-close-btn" onClick={() => !isSubmitting && setIsScenarioModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleGenerateScenarioSubmit} className="modal-form">
              <div className="form-field">
                <label>Target Business Scenario *</label>
                <select
                  value={scenarioForm.scenario_type}
                  onChange={e => setScenarioForm({ ...scenarioForm, scenario_type: e.target.value })}
                  className="scenario-select"
                >
                  <option value="cost_spike">🚨 Vendor Cost Shock (Supplier A surges 45%, operating expenses jump)</option>
                  <option value="refund_wave">🔄 Quality Defect & Refund Surge (Customer RMA returns spike by $14,000)</option>
                  <option value="profitable_growth">📈 Profitable Growth Scale (Strong high-margin enterprise software sales)</option>
                  <option value="margin_drop">📉 Margin Compression Crisis (Hardware COGS jump, gross margin drops to 12%)</option>
                  <option value="balanced">⚖️ Balanced Multi-Category Baseline (Normal healthy operations)</option>
                </select>
              </div>

              <div className="form-grid-3">
                <div className="form-field">
                  <label>Company / Entity Name</label>
                  <input
                    type="text"
                    value={scenarioForm.company_name}
                    onChange={e => setScenarioForm({ ...scenarioForm, company_name: e.target.value })}
                    placeholder="e.g. TechNova Dynamics"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Period (YYYY-MM) *</label>
                  <input
                    type="text"
                    value={scenarioForm.period}
                    pattern="^\d{4}-\d{2}$"
                    onChange={e => setScenarioForm({ ...scenarioForm, period: e.target.value })}
                    placeholder="2026-03"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Transactions Count</label>
                  <select
                    value={scenarioForm.record_count}
                    onChange={e => setScenarioForm({ ...scenarioForm, record_count: e.target.value })}
                  >
                    <option value="12">12 Transactions (Fast Overview)</option>
                    <option value="20">20 Transactions (Standard Demo)</option>
                    <option value="35">35 Transactions (Comprehensive Audit)</option>
                    <option value="50">50 Transactions (Deep Investigation)</option>
                  </select>
                </div>
              </div>

              <div className="scenario-preview-box">
                <span className="preview-title">Scenario Preview:</span>
                <p>
                  Generates mathematically coherent transactions with realistic pricing, suppliers, customers, and deliberate financial patterns matching the chosen archetype.
                </p>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setIsScenarioModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="scenario-submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Generating Dynamic Records...' : '⚡ Inject Scenario Records'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
