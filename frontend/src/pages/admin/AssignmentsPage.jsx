import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { LayoutDashboard, Building2, Bot, Users as UsersIcon, Link as LinkIcon } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/modal';
import api from '../../lib/api';
import { toast } from 'sonner';

const sidebarItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, testId: 'nav-dashboard' },
  { path: '/admin/brands', label: 'Brands', icon: Building2, testId: 'nav-brands' },
  { path: '/admin/agents', label: 'Agents', icon: Bot, testId: 'nav-agents' },
  { path: '/admin/users', label: 'Users', icon: UsersIcon, testId: 'nav-users' },
  { path: '/admin/assignments', label: 'Assignments', icon: LinkIcon, testId: 'nav-assignments' }
];

const AssignmentsPage = () => {
  const [brands, setBrands] = useState([]);
  const [agents, setAgents] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [agentForm, setAgentForm] = useState({ brand_id: '', agent_id: '' });
  const [userForm, setUserForm] = useState({ brand_id: '', user_id: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [brandsRes, agentsRes, usersRes] = await Promise.all([
        api.get('/api/brands'),
        api.get('/api/agents'),
        api.get('/api/users')
      ]);
      setBrands(brandsRes.data || []);
      setAgents(agentsRes.data || []);
      setUsers((usersRes.data || []).filter(u => u.role !== 'admin'));
      console.log('Loaded:', { brands: brandsRes.data?.length, agents: agentsRes.data?.length, users: usersRes.data?.length });
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAgent = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/agents/assign', agentForm);
      toast.success('Agent assigned to brand successfully');
      setShowAgentModal(false);
      setAgentForm({ brand_id: '', agent_id: '' });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to assign agent');
    }
  };

  const handleAssignUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/brands/assign-user', userForm);
      toast.success('User assigned to brand successfully');
      setShowUserModal(false);
      setUserForm({ brand_id: '', user_id: '' });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to assign user');
    }
  };

  if (loading) {
    return (
      <DashboardLayout sidebarItems={sidebarItems}>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="p-6" data-testid="assignments-page">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Assignments</h1>
          <p className="text-slate-600 mt-1">Assign agents and users to brands</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Assign Agent to Brand</CardTitle>
              <CardDescription>Link processing agents to brand accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4 text-sm text-slate-600">
                <p>Brands: {brands.length}</p>
                <p>Agents: {agents.length}</p>
              </div>
              <Button
                onClick={() => setShowAgentModal(true)}
                className="w-full"
                data-testid="assign-agent-button"
                disabled={brands.length === 0 || agents.length === 0}
              >
                <Bot className="mr-2 h-4 w-4" />
                Assign Agent
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assign User to Brand</CardTitle>
              <CardDescription>Grant user access to brand accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4 text-sm text-slate-600">
                <p>Brands: {brands.length}</p>
                <p>Users: {users.length}</p>
              </div>
              <Button
                onClick={() => setShowUserModal(true)}
                className="w-full"
                data-testid="assign-user-button"
                disabled={brands.length === 0 || users.length === 0}
              >
                <UsersIcon className="mr-2 h-4 w-4" />
                Assign User
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showAgentModal} onOpenChange={setShowAgentModal}>
        <DialogContent onClose={() => setShowAgentModal(false)}>
          <DialogHeader>
            <DialogTitle>Assign Agent to Brand</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignAgent} className="space-y-4">
            <div>
              <Label htmlFor="brand">Select Brand *</Label>
              <select
                id="brand"
                value={agentForm.brand_id}
                onChange={(e) => setAgentForm({ ...agentForm, brand_id: e.target.value })}
                required
                data-testid="agent-brand-select"
                className="flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm mt-2"
              >
                <option value="">Choose a brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="agent">Select Agent *</Label>
              <select
                id="agent"
                value={agentForm.agent_id}
                onChange={(e) => setAgentForm({ ...agentForm, agent_id: e.target.value })}
                required
                data-testid="agent-agent-select"
                className="flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm mt-2"
              >
                <option value="">Choose an agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowAgentModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1" data-testid="agent-submit-button">
                Assign
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent onClose={() => setShowUserModal(false)}>
          <DialogHeader>
            <DialogTitle>Assign User to Brand</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignUser} className="space-y-4">
            <div>
              <Label htmlFor="user-brand">Select Brand *</Label>
              <select
                id="user-brand"
                value={userForm.brand_id}
                onChange={(e) => setUserForm({ ...userForm, brand_id: e.target.value })}
                required
                data-testid="user-brand-select"
                className="flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm mt-2"
              >
                <option value="">Choose a brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="user">Select User *</Label>
              <select
                id="user"
                value={userForm.user_id}
                onChange={(e) => setUserForm({ ...userForm, user_id: e.target.value })}
                required
                data-testid="user-user-select"
                className="flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm mt-2"
              >
                <option value="">Choose a user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowUserModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1" data-testid="user-submit-button">
                Assign
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AssignmentsPage;