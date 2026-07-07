import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import {
  LayoutDashboard, Building2, Bot, Users as UsersIcon, Link as LinkIcon,
  Plus, Trash2, Database, AlertTriangle, Loader2, GitBranch, ChevronLeft,
  TableIcon, GitMerge, Layers, Link2
} from 'lucide-react';
import WorkflowManagerModal from './WorkflowManagerModal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/modal';
import { Badge } from '../../components/ui/badge';
import api from '../../lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

const sidebarItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, testId: 'nav-dashboard' },
  { path: '/admin/brands', label: 'Brands', icon: Building2, testId: 'nav-brands' },
  { path: '/admin/agents', label: 'Agents', icon: Bot, testId: 'nav-agents' },
  { path: '/admin/users', label: 'Users', icon: UsersIcon, testId: 'nav-users' },
  { path: '/admin/assignments', label: 'Assignments', icon: LinkIcon, testId: 'nav-assignments' }
];

// ─── Delete Agent Confirm Dialog ──────────────────────────────────────────────
const DeleteAgentDialog = ({ agent, open, onClose, onDeleted }) => {
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState('');

  const handleDelete = async () => {
    setLoading(true);
    try {
      await api.delete(`/api/agents/${agent.id}`);
      toast.success(`Agent "${agent.name}" deleted`);
      onDeleted(agent.id);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete agent');
    } finally {
      setLoading(false);
      setConfirm('');
    }
  };

  const ready = confirm === agent?.name;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" /> Delete Agent
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 space-y-2">
            <p className="font-semibold">This action is irreversible. It will:</p>
            <ul className="list-disc list-inside space-y-1 text-red-700">
              <li>Drop the <strong>{agent?.name?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}</strong> table from every brand database</li>
              <li>Remove all brand–agent assignments</li>
              <li>Delete the agent and all its workflows permanently</li>
            </ul>
          </div>
          <div>
            <Label className="text-slate-700">Type <strong>{agent?.name}</strong> to confirm</Label>
            <Input className="mt-1" placeholder={agent?.name} value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>Cancel</Button>
            <Button type="button" disabled={!ready || loading} onClick={handleDelete}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</> : 'Delete Agent'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Manage Data Dialog ───────────────────────────────────────────────────────
const ManageDataDialog = ({ agent, open, onClose }) => {
  const [brands, setBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [clearingId, setClearingId] = useState(null);

  useEffect(() => {
    if (!open || !agent) return;
    setLoadingBrands(true);
    api.get(`/api/agents/${agent.id}/brands`)
      .then(res => setBrands(res.data || []))
      .catch(() => toast.error('Failed to load brand assignments'))
      .finally(() => setLoadingBrands(false));
  }, [open, agent]);

  const handleClear = async (brand) => {
    setClearingId(brand.id);
    try {
      await api.delete(`/api/brands/${brand.id}/agents/${agent.id}/data`);
      toast.success(`SKU & ledger data cleared for "${brand.name}"`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to clear data');
    } finally {
      setClearingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" /> Manage Data — {agent?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Clear SKU master and ledger master data per brand.</p>
          {loadingBrands ? (
            <div className="py-8 flex items-center justify-center text-slate-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
            </div>
          ) : brands.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              <Database className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              Not assigned to any brand yet.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              {brands.map(brand => (
                <div key={brand.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-sm text-slate-900">{brand.name}</p>
                    <p className="text-xs text-slate-400">{brand.db_name}</p>
                  </div>
                  <button onClick={() => handleClear(brand)} disabled={clearingId === brand.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50">
                    {clearingId === brand.id
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Clearing...</>
                      : <><Trash2 className="h-3 w-3" /> Clear SKU & Ledger</>}
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Assign Workflow to Brand Dialog ─────────────────────────────────────────
const AssignWorkflowDialog = ({ workflow, agent, open, onClose }) => {
  const [brands, setBrands] = useState([]);
  const [assignedIds, setAssignedIds] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !agent) return;
    setLoading(true);
    setSelectedBrand('');
    Promise.all([
      api.get('/api/brands'),
      api.get(`/api/agents/${agent.id}/brands`).catch(() => ({ data: [] }))
    ])
      .then(([brandsRes, assignedRes]) => {
        setBrands(brandsRes.data || []);
        setAssignedIds((assignedRes.data || []).map(b => String(b.id)));
      })
      .catch(() => toast.error('Failed to load brands'))
      .finally(() => setLoading(false));
  }, [open, agent]);

  const handleAssign = async () => {
    if (!selectedBrand) { toast.error('Select a brand'); return; }
    setSaving(true);
    try {
      await api.post('/api/agents/assign', { brand_id: selectedBrand, agent_id: agent.id });
      toast.success(`"${agent.name}" agent assigned to brand — workflow "${workflow.name}" is now available`);
      setAssignedIds(prev => [...prev, String(selectedBrand)]);
      setSelectedBrand('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign');
    } finally {
      setSaving(false);
    }
  };

  const availableBrands = brands.filter(b => !assignedIds.includes(String(b.id)));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-indigo-600" /> Assign Workflow to Brand
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-indigo-800">{workflow?.name}</p>
            <p className="text-xs text-indigo-500">via agent: <strong>{agent?.name}</strong></p>
            <p className="text-xs text-slate-500 mt-1">
              Assigning makes this agent (and all its workflows) available to the selected brand.
            </p>
          </div>

          {loading ? (
            <div className="py-4 flex items-center justify-center text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading brands...
            </div>
          ) : (
            <>
              {assignedIds.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Already assigned to</p>
                  <div className="flex flex-wrap gap-1.5">
                    {brands.filter(b => assignedIds.includes(String(b.id))).map(b => (
                      <span key={b.id} className="rounded-full bg-emerald-100 text-emerald-700 text-xs px-2.5 py-0.5 font-medium">
                        ✓ {b.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {availableBrands.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-2">
                  {brands.length === 0 ? 'No brands created yet.' : 'Already assigned to all brands.'}
                </p>
              ) : (
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Assign to Brand</Label>
                  <div className="flex gap-2 mt-1.5">
                    <select
                      value={selectedBrand}
                      onChange={e => setSelectedBrand(e.target.value)}
                      className="flex-1 h-9 text-sm border border-slate-200 rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                    >
                      <option value="">— select brand —</option>
                      {availableBrands.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <Button onClick={handleAssign} disabled={!selectedBrand || saving} className="shrink-0">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end pt-1">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Agent Card ───────────────────────────────────────────────────────────────
const AgentCard = ({ agent, workflowCount, onManageData, onDelete }) => (
  <div className="flex flex-col rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-150">
    <div className="flex-1 p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm leading-tight">{agent.name}</p>
            {agent.createdAt && (
              <p className="text-xs text-slate-400 mt-0.5">{format(new Date(agent.createdAt), 'dd MMM yyyy')}</p>
            )}
          </div>
        </div>
        <Badge variant="success" className="text-xs shrink-0">Active</Badge>
      </div>

      {agent.description && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{agent.description}</p>
      )}

      <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium bg-indigo-50 rounded-full px-2.5 py-0.5">
        <GitBranch className="h-3 w-3" /> {workflowCount} workflow{workflowCount !== 1 ? 's' : ''}
      </span>
    </div>

    <div className="border-t border-slate-100 px-4 py-2.5 flex items-center gap-1.5">
      <button onClick={onManageData}
        className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
        <Database className="h-3 w-3" /> Manage Data
      </button>
      <button onClick={onDelete}
        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-100 transition-colors">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);

// ─── Workflow Card ─────────────────────────────────────────────────────────────
const WorkflowCard = ({ workflow, agentName, onEdit, onAssign, onDelete, deleting }) => {
  const sheets        = workflow.sheets || [];
  const sheetCount    = sheets.length;
  const computedCount = sheets.reduce((n, s) => n + (s.columns || []).filter(c => c.type === 'computed').length, 0);
  const excelCount    = sheets.reduce((n, s) => n + (s.columns || []).filter(c => c.type === 'excel').length, 0);
  const mergeCount    = sheets.filter(s => s.type === 'merge').length;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white hover:border-violet-200 hover:shadow-md transition-all duration-150">
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <Layers className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm leading-tight">{workflow.name}</p>
              <p className="text-xs text-violet-500 font-medium mt-0.5">{agentName}</p>
            </div>
          </div>
        </div>

        {workflow.description && (
          <p className="text-xs text-slate-500 line-clamp-1 mb-2">{workflow.description}</p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
          <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
            <TableIcon className="h-3 w-3" /> {sheetCount} sheet{sheetCount !== 1 ? 's' : ''}
          </span>
          {mergeCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 rounded-full px-2 py-0.5">
              <GitMerge className="h-3 w-3" /> {mergeCount} merge
            </span>
          )}
          {computedCount > 0 && (
            <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
              ✦ {computedCount} math
            </span>
          )}
          {excelCount > 0 && (
            <span className="text-xs text-sky-700 bg-sky-50 rounded-full px-2 py-0.5">
              Σ {excelCount} excel
            </span>
          )}
        </div>

        {sheets.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {sheets.slice(0, 4).map(s => (
              <span key={s.id}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${s.type === 'merge' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                {s.type === 'merge' ? <><GitMerge className="inline h-2.5 w-2.5 mr-0.5" /></> : null}{s.name}
              </span>
            ))}
            {sheets.length > 4 && (
              <span className="rounded px-1.5 py-0.5 text-[10px] text-slate-400">+{sheets.length - 4} more</span>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-4 py-2.5 flex items-center gap-1.5">
        <button onClick={onEdit}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
          Edit
        </button>
        <button onClick={onAssign}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors">
          <Link2 className="h-3 w-3" /> Assign
        </button>
        <button onClick={onDelete} disabled={deleting}
          className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50">
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const AgentsPage = () => {
  const [agents, setAgents]         = useState([]);
  const [workflows, setWorkflows]   = useState([]); // flat: { ...wf, agentId, agentName }
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingWf, setLoadingWf]   = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData]     = useState({ name: '', description: '', useBasicColumns: true });
  const [deleteTarget, setDeleteTarget]     = useState(null);
  const [manageTarget, setManageTarget]     = useState(null);
  const [workflowTarget, setWorkflowTarget] = useState(null); // { agent } — full-page builder
  const [assignTarget, setAssignTarget]     = useState(null); // { workflow, agent }
  const [deletingWfId, setDeletingWfId]     = useState(null);
  const [showNewWfPicker, setShowNewWfPicker] = useState(false);
  const [newWfAgentId, setNewWfAgentId]     = useState('');

  useEffect(() => { fetchAgents(); }, []);

  const fetchAgents = async () => {
    setLoadingAgents(true);
    try {
      const res = await api.get('/api/agents');
      const fetchedAgents = res.data || [];
      setAgents(fetchedAgents);
      fetchAllWorkflows(fetchedAgents);
    } catch {
      toast.error('Failed to load agents');
    } finally {
      setLoadingAgents(false);
    }
  };

  const fetchAllWorkflows = async (agentList) => {
    if (!agentList.length) { setWorkflows([]); return; }
    setLoadingWf(true);
    try {
      const results = await Promise.all(
        agentList.map(agent =>
          api.get(`/api/agents/${agent.id}/workflows`)
            .then(r => (r.data || []).map(wf => ({ ...wf, agentId: agent.id, agentName: agent.name })))
            .catch(() => [])
        )
      );
      setWorkflows(results.flat());
    } finally {
      setLoadingWf(false);
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    try {
      const basicColumns = [
        { name: 'id', type: 'UUID', primaryKey: true, defaultValue: 'UUIDV4' },
        { name: 'month', type: 'INTEGER' },
        { name: 'year', type: 'INTEGER' },
        { name: 'inventory_type', type: 'STRING' },
        { name: 'filename', type: 'STRING' },
        { name: 'created_at', type: 'DATE', defaultValue: 'NOW' },
        { name: 'date', type: 'DATE' }
      ];
      const defaultColumns = [
        { name: 'SKU', type: 'STRING' },
        { name: 'Product_Name', type: 'STRING' },
        { name: 'Quantity', type: 'INTEGER' },
        { name: 'Amount', type: 'DECIMAL' },
        { name: 'State', type: 'STRING' }
      ];
      await api.post('/api/agents', {
        name: formData.name,
        description: formData.description,
        columns: formData.useBasicColumns ? basicColumns : defaultColumns
      });
      toast.success('Agent created');
      setShowCreateModal(false);
      setFormData({ name: '', description: '', useBasicColumns: true });
      fetchAgents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create agent');
    }
  };

  const handleAgentDeleted = (agentId) => {
    setAgents(prev => prev.filter(a => a.id !== agentId));
    setWorkflows(prev => prev.filter(wf => wf.agentId !== agentId));
  };

  const handleWorkflowDeleted = async (wfId) => {
    setDeletingWfId(wfId);
    try {
      await api.delete(`/api/workflows/${wfId}`);
      toast.success('Workflow deleted');
      setWorkflows(prev => prev.filter(wf => wf.id !== wfId));
    } catch {
      toast.error('Failed to delete workflow');
    } finally {
      setDeletingWfId(null);
    }
  };

  // Workflow count per agent
  const wfCountMap = workflows.reduce((acc, wf) => {
    acc[wf.agentId] = (acc[wf.agentId] || 0) + 1;
    return acc;
  }, {});

  // ── Workflow builder full-page view ──
  if (workflowTarget) {
    return (
      <DashboardLayout sidebarItems={sidebarItems}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => { setWorkflowTarget(null); fetchAgents(); }}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
              <ChevronLeft className="h-4 w-4" /> Back to Agents & Workflows
            </button>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-indigo-600" />
              <h1 className="text-xl font-semibold text-slate-900">Workflows — <span className="text-indigo-600">{workflowTarget.agent.name}</span></h1>
            </div>
          </div>
          <WorkflowManagerModal
            agent={workflowTarget.agent}
            open={true}
            onClose={() => { setWorkflowTarget(null); fetchAgents(); }}
            inline={true}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="p-6 space-y-10" data-testid="agents-page">

        {/* ── Agents Section ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Bot className="h-5 w-5 text-indigo-500" /> Agents
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">Processing agents and their configuration</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} data-testid="create-agent-button">
              <Plus className="mr-1.5 h-4 w-4" /> New Agent
            </Button>
          </div>

          {loadingAgents ? (
            <div className="flex items-center gap-2 text-slate-400 py-8">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading agents...
            </div>
          ) : agents.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-400">
              <Bot className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium">No agents yet</p>
              <p className="text-xs mt-1">Create an agent to start building workflows</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {agents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  workflowCount={wfCountMap[agent.id] || 0}
                  onManageData={() => setManageTarget(agent)}
                  onDelete={() => setDeleteTarget(agent)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Workflows Section ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Layers className="h-5 w-5 text-violet-500" /> Workflows
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">All workflows — create, edit, and assign to brands</p>
            </div>
            <div className="flex items-center gap-2">
              {loadingWf && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              )}
              <Button
                onClick={() => {
                  if (agents.length === 1) {
                    setWorkflowTarget({ agent: agents[0] });
                  } else {
                    setNewWfAgentId(agents[0]?.id || '');
                    setShowNewWfPicker(true);
                  }
                }}
                disabled={agents.length === 0}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Create Workflow
              </Button>
            </div>
          </div>

          {!loadingWf && workflows.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-400">
              <Layers className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium">No workflows yet</p>
              <p className="text-xs mt-1">Click "Create Workflow" to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {workflows.map(wf => {
                const agent = agents.find(a => a.id === wf.agentId);
                return (
                  <WorkflowCard
                    key={wf.id}
                    workflow={wf}
                    agentName={wf.agentName}
                    deleting={deletingWfId === wf.id}
                    onEdit={() => agent && setWorkflowTarget({ agent })}
                    onAssign={() => agent && setAssignTarget({ workflow: wf, agent })}
                    onDelete={() => handleWorkflowDeleted(wf.id)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Create Agent Modal ── */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent onClose={() => setShowCreateModal(false)}>
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateAgent} className="space-y-4">
            <div>
              <Label htmlFor="name">Agent Name *</Label>
              <Input id="name" value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Sales-Myntra" required data-testid="agent-name-input" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional" data-testid="agent-description-input" />
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <input type="checkbox" id="useBasicColumns" checked={formData.useBasicColumns}
                onChange={e => setFormData({ ...formData, useBasicColumns: e.target.checked })}
                className="rounded border-slate-300 text-indigo-600 h-4 w-4" />
              <Label htmlFor="useBasicColumns" className="font-normal cursor-pointer text-slate-700">
                Include basic columns (id, month, year, etc.)
              </Label>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)} className="flex-1">Cancel</Button>
              <Button type="submit" className="flex-1" data-testid="agent-submit-button">Create Agent</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Agent Dialog ── */}
      <DeleteAgentDialog
        agent={deleteTarget}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleAgentDeleted}
      />

      {/* ── Manage Data Dialog ── */}
      <ManageDataDialog
        agent={manageTarget}
        open={!!manageTarget}
        onClose={() => setManageTarget(null)}
      />

      {/* ── Assign Workflow Dialog ── */}
      {assignTarget && (
        <AssignWorkflowDialog
          workflow={assignTarget.workflow}
          agent={assignTarget.agent}
          open={!!assignTarget}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {/* ── New Workflow: pick agent dialog ── */}
      <Dialog open={showNewWfPicker} onOpenChange={setShowNewWfPicker}>
        <DialogContent onClose={() => setShowNewWfPicker(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-violet-600" /> Create Workflow
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Select which agent this workflow belongs to.</p>
            <div>
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Agent</Label>
              <select
                value={newWfAgentId}
                onChange={e => setNewWfAgentId(e.target.value)}
                className="mt-1.5 w-full h-9 text-sm border border-slate-200 rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
              >
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowNewWfPicker(false)} className="flex-1">Cancel</Button>
              <Button
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                onClick={() => {
                  const agent = agents.find(a => a.id === newWfAgentId);
                  if (!agent) return;
                  setShowNewWfPicker(false);
                  setWorkflowTarget({ agent });
                }}
              >
                Continue →
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AgentsPage;
