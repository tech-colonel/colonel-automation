import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { LayoutDashboard, Building2, Bot, Users, Link as LinkIcon } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

const sidebarItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, testId: 'nav-dashboard' },
  { path: '/admin/brands', label: 'Brands', icon: Building2, testId: 'nav-brands' },
  { path: '/admin/agents', label: 'Agents', icon: Bot, testId: 'nav-agents' },
  { path: '/admin/users', label: 'Users', icon: Users, testId: 'nav-users' },
  { path: '/admin/assignments', label: 'Assignments', icon: LinkIcon, testId: 'nav-assignments' }
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    brands: 0,
    agents: 0,
    users: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [brandsRes, agentsRes, usersRes] = await Promise.all([
        api.get('/api/brands'),
        api.get('/api/agents'),
        api.get('/api/users')
      ]);

      setStats({
        brands: brandsRes.data.length,
        agents: agentsRes.data.length,
        users: usersRes.data.length
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="p-6" data-testid="admin-dashboard">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-slate-600 mt-1">Manage brands, agents, and users</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">{stats.brands}</CardTitle>
              <CardDescription>Total Brands</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/admin/brands')}
                data-testid="view-brands-button"
              >
                View Brands
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">{stats.agents}</CardTitle>
              <CardDescription>Total Agents</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/admin/agents')}
                data-testid="view-agents-button"
              >
                View Agents
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">{stats.users}</CardTitle>
              <CardDescription>Total Users</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/admin/users')}
                data-testid="view-users-button"
              >
                View Users
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate('/admin/brands')}
                data-testid="create-brand-quick-action"
              >
                <Building2 className="mr-2 h-4 w-4" />
                Create New Brand
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate('/admin/agents')}
                data-testid="create-agent-quick-action"
              >
                <Bot className="mr-2 h-4 w-4" />
                Create New Agent
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate('/admin/users')}
                data-testid="create-user-quick-action"
              >
                <Users className="mr-2 h-4 w-4" />
                Create New User
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Platform health and connectivity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">API Status</span>
                <span className="text-sm font-medium text-emerald-600">Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Database</span>
                <span className="text-sm font-medium text-emerald-600">Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">File Processing</span>
                <span className="text-sm font-medium text-emerald-600">Active</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;