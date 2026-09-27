import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  getTransactions,
  createTransaction,
  deleteTransaction,
  batchDeleteTransactions,
  purgeAllTransactions,
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

export default function Transactions() {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ period: '', transaction_type: '', category: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    product: '',
    quantity: '1',
    cost: '',
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
      product: '',
      quantity: '1',
      cost: '',
    });
    setIsModalOpen(true);
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
        supplier: formData.supplier.trim() || null,
        product: formData.product.trim() || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
      };

      const res = await createTransaction(payload);
      setTxs(prev => [res.data, ...prev]);
      setIsModalOpen(false);
      setSuccessToast(`Transaction ${res.data.transaction_id} created and committed to DB permanently!`);
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to create transaction');
    } finally {
      setIsSubmitting(false);
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

  const handlePurgeAll = async () => {
    const confirmation = window.prompt(
      "⚠️ PERMANENT WIPE WARNING:\nThis will permanently delete ALL transactions, investigations, and dummy data from the database.\n\nType 'PURGE' to confirm:"
    );
    if (confirmation !== 'PURGE') return;

    try {
      setLoading(true);
      const res = await purgeAllTransactions();
      setTxs([]);
      setSelectedIds([]);
      setSuccessToast(res.data.message || 'All dummy data wiped permanently. Database is 100% clean.');
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err) {
      alert(`Wipe failed: ${err.message}`);
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
          <button className="import-csv-btn" onClick={() => fileInputRef.current?.click()} title="Import transactions from CSV">
            📁 Import CSV
          </button>

          <button className="add-tx-btn" onClick={handleOpenModal}>
            <span className="plus-icon">+</span> Add Transaction
          </button>

          {txs.length > 0 && (
            <button className="purge-all-btn" onClick={handlePurgeAll} title="Wipe all data from database completely">
              🗑️ Wipe All Data
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
                <th>Supplier / Product</th>
                <th className="amount-col">Amount</th>
                <th>Status</th>
                <th className="action-col">Action</th>
              </tr>
            </thead>
            <tbody>
              {txs.map(tx => {
                const isSelected = selectedIds.includes(tx.transaction_id);
                return (
                  <tr key={tx.transaction_id} className={isSelected ? 'selected-row' : ''}>
                    <td className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(tx.transaction_id)}
                      />
                    </td>
                    <td className="mono">{tx.transaction_id}</td>
                    <td>{tx.date}</td>
                    <td><span className={`type-badge ${tx.transaction_type}`}>{tx.transaction_type}</span></td>
                    <td>{tx.category}</td>
                    <td className="desc-col" title={tx.description}>{tx.description}</td>
                    <td>{tx.supplier || tx.product || '–'}</td>
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
                      <span className="empty-icon">📂</span>
                      <h3>The ledger is currently 100% clean</h3>
                      <p>No dummy records exist. You can record custom transactions or import an audited CSV file.</p>
                      <div className="empty-actions">
                        <button className="add-tx-btn" onClick={handleOpenModal}>+ Record First Transaction</button>
                        <button className="import-csv-btn" onClick={() => fileInputRef.current?.click()}>📁 Import CSV File</button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Record Financial Transaction</h2>
              <button className="modal-close-btn" onClick={() => !isSubmitting && setIsModalOpen(false)}>✕</button>
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

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Supplier / Vendor (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. CloudScale Inc, Acme Corp"
                    value={formData.supplier}
                    onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>Product / SKU (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Enterprise Tier A"
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
                  {isSubmitting ? 'Recording...' : 'Save Permanently to DB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
