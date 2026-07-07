import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { LayoutDashboard, Bot, Layers, TableIcon, GitMerge, Play, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import WorkflowApplyModal from './WorkflowApplyModal';
import api from '../../lib/api';
import { toast } from 'sonner';

const BrandAgentsInventory = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const [allAgents, setAllAgents]         = useState([]);
  const [assignedAgents, setAssignedAgents] = useState([]);
  const [workflows, setWorkflows]         = useState([]); // { ...wf, agentId, agentName }
  const [loading, setLoading]             = useState(true);
  const [loadingWf, setLoadingWf]         = useState(false);
  const [applyTarget, setApplyTarget]     = useState(null); // { workflow, agentId }

  const sidebarItems = [
    { path: `/brands/${brandId}/dashboard`, label: 'Dashboard', icon: LayoutDashboard, testId: 'nav-dashboard' },
    { path: `/brands/${brandId}/agents`,    label: 'Agents',    icon: Bot,             testId: 'nav-agents' }
  ];

  useEffect(() => { fetchData(); }, [brandId]);

  const fetchData = async () => {
    try {
      const [allAgentsRes, assignedAgentsRes] = await Promise.all([
        api.get('/api/agents'),
        api.get(`/api/brands/${brandId}/agents`)
      ]);
      const all      = allAgentsRes.data || [];
      const assigned = assignedAgentsRes.data || [];
      setAllAgents(all);
      setAssignedAgents(assigned);
      fetchWorkflowsForAssigned(assigned);
    } catch {
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowsForAssigned = async (assigned) => {
    if (!assigned.length) return;
    setLoadingWf(true);
    try {
      const results = await Promise.all(
        assigned.map(agent =>
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

  const isAssigned = (agentId) => assignedAgents.some(a => a.id === agentId);

  const handleAgentClick = (agent) => {
    if (isAssigned(agent.id)) {
      navigate(`/brands/${brandId}/agents/${agent.id}`);
    } else {
      toast.info('This agent is not assigned to this brand');
    }
  };

  if (loading) {
    return (
      <DashboardLayout sidebarItems={sidebarItems}>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="p-6 space-y-10" data-testid="agents-inventory-page">

        {/* ── Agents Section ── */}
        <section>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Bot className="h-6 w-6 text-indigo-500" /> Agents
            </h1>
            <p className="text-slate-500 mt-1 text-sm">All available processing agents — assigned ones are clickable</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="agents-inventory-grid">
            {allAgents.map(agent => {
              const assigned = isAssigned(agent.id);
              return (
                <Card
                  key={agent.id}
                  className={`hover:shadow-lg transition-shadow ${assigned ? 'cursor-pointer' : 'opacity-60'}`}
                  onClick={() => handleAgentClick(agent)}
                  data-testid={`agent-inventory-card-${agent.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-3">
                        <Bot className="h-6 w-6 text-slate-600" />
                      </div>
                      {assigned
                        ? <Badge variant="success"  data-testid={`agent-assigned-badge-${agent.id}`}>Assigned</Badge>
                        : <Badge variant="secondary" data-testid={`agent-not-assigned-badge-${agent.id}`}>Not Assigned</Badge>}
                    </div>
                    <CardTitle>{agent.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {agent.description || 'No description available'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-500">
                      {assigned ? 'Click to open agent workspace' : 'Contact admin to assign this agent'}
                    </p>
                  </CardContent>
                </Card>
              );
            })}

            {allAgents.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-12 text-center">
                  <Bot className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No Agents Available</h3>
                  <p className="text-slate-600">No agents have been created in the system yet.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* ── Workflows Section ── */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="h-6 w-6 text-violet-500" /> Workflows
              {loadingWf && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            </h2>
            <p className="text-slate-500 mt-1 text-sm">Assigned workflows — apply to your files to get processed output</p>
          </div>

          {!loadingWf && workflows.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 py-14 text-center text-slate-400">
              <Layers className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium">No workflows assigned</p>
              <p className="text-xs mt-1">Workflows become available once an agent is assigned to this brand</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {workflows.map(wf => {
                const sheets        = wf.sheets || [];
                const sheetCount    = sheets.length;
                const computedCount = sheets.reduce((n, s) => n + (s.columns || []).filter(c => c.type === 'computed').length, 0);
                const excelCount    = sheets.reduce((n, s) => n + (s.columns || []).filter(c => c.type === 'excel').length, 0);
                const mergeCount    = sheets.filter(s => s.type === 'merge').length;
                return (
                  <div key={wf.id}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white hover:border-violet-300 hover:shadow-md transition-all duration-150">
                    <div className="flex-1 p-5">
                      {/* Header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                          <Layers className="h-5 w-5 text-violet-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm leading-snug">{wf.name}</p>
                          <p className="text-xs text-violet-500 font-medium mt-0.5">via {wf.agentName}</p>
                        </div>
                      </div>

                      {/* Description */}
                      {wf.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{wf.description}</p>
                      )}

                      {/* Stats badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
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
                            ✦ {computedCount} formula{computedCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {excelCount > 0 && (
                          <span className="text-xs text-sky-700 bg-sky-50 rounded-full px-2 py-0.5">
                            Σ {excelCount} excel
                          </span>
                        )}
                      </div>

                      {/* Sheet name tags */}
                      {sheets.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {sheets.slice(0, 4).map(s => (
                            <span key={s.id}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                s.type === 'merge' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                              {s.name}
                            </span>
                          ))}
                          {sheets.length > 4 && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] text-slate-400">
                              +{sheets.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Apply button */}
                    <div className="border-t border-slate-100 px-5 py-3">
                      <button
                        onClick={() => setApplyTarget({ workflow: wf, agentId: wf.agentId })}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
                      >
                        <Play className="h-4 w-4" /> Apply Workflow
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Apply Workflow Modal */}
      {applyTarget && (
        <WorkflowApplyModal
          open={!!applyTarget}
          agentId={applyTarget.agentId}
          brandId={brandId}
          initialWorkflow={applyTarget.workflow}
          onClose={() => setApplyTarget(null)}
        />
      )}
    </DashboardLayout>
  );
};

export default BrandAgentsInventory;
