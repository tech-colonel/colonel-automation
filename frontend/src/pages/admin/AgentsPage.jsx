import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { LayoutDashboard, Building2, Bot, Users as UsersIcon, Link as LinkIcon, Plus, Trash2, Database, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
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
      toast.success(`Agent "${agent.name}" deleted and tables dropped from all brand databases`);
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
              <li>Delete the agent from the system permanently</li>
            </ul>
          </div>

          <div>
            <Label className="text-slate-700">
              Type <strong>{agent?.name}</strong> to confirm
            </Label>
            <Input
              className="mt-1"
              placeholder={agent?.name}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!ready || loading}
              onClick={handleDelete}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</> : 'Delete Agent'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Manage Data Dialog (per brand SKU & ledger clear) ───────────────────────
const ManageDataDialog = ({ agent, open, onClose }) => {
  const [brands, setBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [clearingId, setClearingId] = useState(null);

  useEffect(() => {
    if (!open || !agent) return;
    setLoadingBrands(true);
    api.get(`/api/agents/${agent.id}/brands`)
      .then((res) => setBrands(res.data || []))
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
            <Database className="h-5 w-5 text-blue-600" />
            Manage Data — {agent?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Clear the SKU master and ledger master data for this agent per brand. This resets the master lists but does not delete processed records.
          </p>

          {loadingBrands ? (
            <div className="py-8 flex items-center justify-center text-slate-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading assignments...
            </div>
          ) : brands.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              <Database className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              This agent is not assigned to any brand yet.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              {brands.map((brand) => (
                <div key={brand.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-sm text-slate-900">{brand.name}</p>
                    <p className="text-xs text-slate-400">{brand.db_name}</p>
                  </div>
                  <button
                    onClick={() => handleClear(brand)}
                    disabled={clearingId === brand.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50"
                  >
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

// ─── Main Page ────────────────────────────────────────────────────────────────
const AgentsPage = () => {
  const [agents, setAgents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', useBasicColumns: true });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [manageTarget, setManageTarget] = useState(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await api.get('/api/agents');
      setAgents(response.data);
    } catch (error) {
      toast.error('Failed to load agents');
    }
  };

  const handleSubmit = async (e) => {
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

      const payload = {
        name: formData.name,
        description: formData.description,
        columns: formData.useBasicColumns ? basicColumns : defaultColumns
      };
      await api.post('/api/agents', payload);
      toast.success('Agent created successfully');
      setShowModal(false);
      setFormData({ name: '', description: '', useBasicColumns: true });
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create agent');
    }
  };

  const handleAgentDeleted = (agentId) => {
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
  };

  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="p-6" data-testid="agents-page">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Agents</h1>
            <p className="text-slate-600 mt-1">Manage processing agents for data automation</p>
          </div>
          <Button onClick={() => setShowModal(true)} data-testid="create-agent-button">
            <Plus className="mr-2 h-4 w-4" />
            Create Agent
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Agents</CardTitle>
            <CardDescription>Available processing agents in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <div className="py-8 text-center text-slate-600">
                <Bot className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                No agents created yet
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id} data-testid={`agent-row-${agent.id}`}>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell className="max-w-xs text-slate-500">{agent.description || 'N/A'}</TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {agent.createdAt ? format(new Date(agent.createdAt), 'dd MMM yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="success">Active</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setManageTarget(agent)}
                              title="Manage SKU & Ledger Data"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              <Database className="h-3.5 w-3.5" /> Manage Data
                            </button>
                            <button
                              onClick={() => setDeleteTarget(agent)}
                              title="Delete Agent"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Agent Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent onClose={() => setShowModal(false)}>
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Agent Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Sales-Myntra"
                required
                data-testid="agent-name-input"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter agent description"
                data-testid="agent-description-input"
              />
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="useBasicColumns"
                checked={formData.useBasicColumns}
                onChange={(e) => setFormData({ ...formData, useBasicColumns: e.target.checked })}
                className="rounded border-slate-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 h-4 w-4"
              />
              <Label htmlFor="useBasicColumns" className="font-normal cursor-pointer text-slate-700">
                Include basic columns (id, month, year, etc.)
              </Label>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1" data-testid="agent-submit-button">
                Create Agent
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Agent Dialog */}
      <DeleteAgentDialog
        agent={deleteTarget}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleAgentDeleted}
      />

      {/* Manage Data Dialog */}
      <ManageDataDialog
        agent={manageTarget}
        open={!!manageTarget}
        onClose={() => setManageTarget(null)}
      />
    </DashboardLayout>
  );
};

export default AgentsPage;
