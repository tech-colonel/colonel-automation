import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Upload, Download, FileText, Loader2, CheckCircle, X, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import api from '../../lib/api';
import { toast } from 'sonner';

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (n) => (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub }) => (
  <div className="bg-white border border-slate-200 rounded-lg p-4">
    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
    <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
  </div>
);

const FileSlot = ({ label, hint, accept, multiple, file, files, onChange, required, savedIndicator }) => {
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = multiple ? Array.from(e.dataTransfer.files) : e.dataTransfer.files[0];
    onChange(dropped);
  };

  const displayName = multiple
    ? (files && files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : null)
    : (file ? file.name : null);

  const hasFile = multiple ? (files && files.length > 0) : !!file;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {savedIndicator && !hasFile && (
          <span className="text-xs text-emerald-600 font-medium">✓ Saved in DB</span>
        )}
      </div>
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
          ${hasFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {hasFile ? (
          <div className="flex items-center justify-center gap-2 text-emerald-700">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium truncate max-w-xs">{displayName}</span>
          </div>
        ) : (
          <div className="text-slate-400">
            <Upload className="h-5 w-5 mx-auto mb-1" />
            <p className="text-xs">{hint || 'Click or drag to upload'}</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            const val = multiple ? Array.from(e.target.files) : e.target.files[0];
            onChange(val);
          }}
        />
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const Gstr3bTallyWorkspace = ({ brandId }) => {
  const [gstr3bFiles, setGstr3bFiles] = useState([]);
  const [coaFile, setCoaFile] = useState(null);
  const [vtFile, setVtFile] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [activeMonth, setActiveMonth] = useState('all');
  const [coaStatus, setCoaStatus] = useState({ hasLedger: false, count: 0, hasVt: false, vtCount: 0 });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (brandId) {
      fetchCoaStatus();
      fetchHistory();
    }
  }, [brandId]);

  const fetchCoaStatus = async () => {
    try {
      const res = await api.get(`/api/brands/${brandId}/gstr3b/coa-status`);
      setCoaStatus(res.data);
    } catch (_) {}
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/api/brands/${brandId}/gstr3b/history`);
      setHistory(res.data || []);
    } catch (_) {}
  };

  const handleRun = async () => {
    if (gstr3bFiles.length === 0) {
      toast.error('Please select at least one GSTR-3B file');
      return;
    }
    setIsRunning(true);
    try {
      const form = new FormData();
      for (const f of gstr3bFiles) form.append('gstr3b', f);
      if (coaFile) form.append('coa', coaFile);
      if (vtFile) form.append('vouchertype', vtFile);

      const res = await api.post(`/api/brands/${brandId}/gstr3b/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      });

      setResult(res.data);
      setActiveMonth('all');
      toast.success('GSTR-3B processed successfully');
      fetchCoaStatus();
      fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Processing failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleDownload = async (jobId) => {
    try {
      const res = await api.get(`/api/brands/${brandId}/gstr3b/download/${jobId}`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `gstr3b_tally_entry_${jobId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Download failed');
    }
  };

  // ── Data derived from result ────────────────────────────────────────────────

  const monthlyData = result?.monthly_data || [];

  const chartData = monthlyData.map(m => {
    const entries = (m.entries || []).filter(e => e._type === 'data');
    const debit = entries.reduce((s, e) => s + (typeof e.debit === 'number' ? e.debit : 0), 0);
    const credit = entries.reduce((s, e) => s + (typeof e.credit === 'number' ? e.credit : 0), 0);
    return { month: m.period, debit, credit };
  });

  const activeMonthData = activeMonth === 'all'
    ? monthlyData
    : monthlyData.filter(m => m.period === activeMonth);

  const aggregateStats = (months) => {
    const allEntries = months.flatMap(m => (m.entries || []).filter(e => e._type === 'data'));
    const totalDebit = allEntries.reduce((s, e) => s + (typeof e.debit === 'number' ? e.debit : 0), 0);
    const totalCredit = allEntries.reduce((s, e) => s + (typeof e.credit === 'number' ? e.credit : 0), 0);
    return { entries: allEntries.length, totalDebit, totalCredit };
  };

  const stats = result ? aggregateStats(activeMonthData) : null;

  const activeEntries = activeMonthData.flatMap(m => m.entries || []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Upload Panel */}
      <Card>
        <CardHeader>
          <CardTitle>GSTR-3B Tally Entry Generator</CardTitle>
          <CardDescription>Upload GSTR-3B PDF/Excel files to generate Tally journal entries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileSlot
            label="GSTR-3B Files"
            hint="Upload 1–15 GSTR-3B PDF or Excel files"
            accept=".pdf,.xlsx,.xls"
            multiple
            files={gstr3bFiles}
            onChange={setGstr3bFiles}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <FileSlot
              label="Chart of Accounts (Optional)"
              hint=".xlsx/.xls — upload once to save"
              accept=".xlsx,.xls"
              file={coaFile}
              onChange={setCoaFile}
              savedIndicator={coaStatus.hasLedger}
            />
            <FileSlot
              label="Voucher Type Master (Optional)"
              hint=".xls/.xlsx — maps Journal → Journal UP"
              accept=".xlsx,.xls"
              file={vtFile}
              onChange={setVtFile}
              savedIndicator={coaStatus.hasVt}
            />
          </div>

          {(coaStatus.hasLedger || coaStatus.hasVt) && (
            <div className="flex gap-4 text-xs text-slate-500">
              {coaStatus.hasLedger && <span>✓ COA: {coaStatus.count} ledgers saved</span>}
              {coaStatus.hasVt && <span>✓ Voucher Types: {coaStatus.vtCount} saved</span>}
            </div>
          )}

          <Button onClick={handleRun} disabled={isRunning} className="w-full">
            {isRunning ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
            ) : (
              <><Plus className="mr-2 h-4 w-4" /> Run Agent</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Download + Stats */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Results</h2>
            <Button
              variant="outline"
              onClick={() => handleDownload(result.job_id)}
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            >
              <Download className="mr-2 h-4 w-4" /> Download Excel (5 sheets)
            </Button>
          </div>

          {stats && (
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Journal Entries" value={stats.entries.toLocaleString('en-IN')} />
              <StatCard label="Total Debit" value={`₹${fmt(stats.totalDebit)}`} />
              <StatCard label="Total Credit" value={`₹${fmt(stats.totalCredit)}`} />
            </div>
          )}

          {/* Month tabs */}
          {monthlyData.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveMonth('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                  ${activeMonth === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                All Months
              </button>
              {monthlyData.map(m => (
                <button
                  key={m.period}
                  onClick={() => setActiveMonth(m.period)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${activeMonth === m.period ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {m.period}
                </button>
              ))}
            </div>
          )}

          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Debit vs Credit by Month</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => {
                        const parts = v.split(' ');
                        return parts.length === 2 ? `${parts[0].slice(0, 3)} ${parts[1].slice(2)}` : v;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value, name) => [`₹${fmt(value)}`, name === 'debit' ? 'Total Debit' : 'Total Credit']}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Legend formatter={(v) => v === 'debit' ? 'Total Debit' : 'Total Credit'} />
                    <Bar dataKey="debit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="credit" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Entries table for active month(s) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Journal Entries
                {activeMonth !== 'all' && <span className="ml-2 text-slate-400 font-normal">— {activeMonth}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">S.No</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Particulars</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Debit (₹)</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Credit (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEntries.map((entry, idx) => {
                      if (entry._type === 'section') {
                        return (
                          <tr key={idx} className="bg-slate-100">
                            <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                              {entry.particulars}
                            </td>
                          </tr>
                        );
                      }
                      if (entry._type === 'info') {
                        return (
                          <tr key={idx} className="bg-blue-50">
                            <td colSpan={4} className="px-4 py-1.5 text-xs text-blue-700 font-medium">
                              {entry.particulars}
                            </td>
                          </tr>
                        );
                      }
                      if (entry._type === 'blank') return <tr key={idx} className="h-4" />;
                      return (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="px-4 py-1.5 text-slate-400 text-xs">{entry.sno || ''}</td>
                          <td className="px-4 py-1.5 text-slate-700">{entry.particulars}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-slate-800">
                            {typeof entry.debit === 'number' ? fmt(entry.debit) : ''}
                          </td>
                          <td className="px-4 py-1.5 text-right font-mono text-slate-800">
                            {typeof entry.credit === 'number' ? fmt(entry.credit) : ''}
                          </td>
                        </tr>
                      );
                    })}
                    {activeEntries.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">
                          No entries for selected period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Runs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Period</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">Entries</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">Total Debit</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">Total Credit</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 5).map((run, idx) => (
                  <tr key={run.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-2 text-slate-700">{run.period || '—'}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{run.total_entries}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-800">₹{fmt(run.total_debit)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-800">₹{fmt(run.total_credit)}</td>
                    <td className="px-4 py-2 text-right">
                      {run.job_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownload(run.job_id)}
                          className="h-7 px-2 text-slate-500 hover:text-emerald-700"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Gstr3bTallyWorkspace;
