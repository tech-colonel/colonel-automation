import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { LayoutDashboard, Building2, Bot, Users, Link as LinkIcon, Plus } from 'lucide-react';
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
  { path: '/admin/users', label: 'Users', icon: Users, testId: 'nav-users' },
  { path: '/admin/assignments', label: 'Assignments', icon: LinkIcon, testId: 'nav-assignments' }
];

const BrandsPage = () => {
  const [brands, setBrands] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', image_url: '' });

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const response = await api.get('/api/brands');
      setBrands(response.data);
    } catch (error) {
      toast.error('Failed to load brands');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/brands', formData);
      toast.success('Brand created successfully');
      setShowModal(false);
      setFormData({ name: '', description: '', image_url: '' });
      fetchBrands();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create brand');
    }
  };

  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="p-6" data-testid="brands-page">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Brands</h1>
            <p className="text-slate-600 mt-1">Manage brand accounts and databases</p>
          </div>
          <Button onClick={() => setShowModal(true)} data-testid="create-brand-button">
            <Plus className="mr-2 h-4 w-4" />
            Create Brand
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Brands</CardTitle>
            <CardDescription>List of all registered brands in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {brands.length === 0 ? (
              <div className="py-8 text-center text-slate-600">
                <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                No brands created yet
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Database</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brands.map((brand) => (
                      <TableRow key={brand.id} data-testid={`brand-row-${brand.id}`}>
                        <TableCell className="font-medium">{brand.name}</TableCell>
                        <TableCell className="max-w-xs truncate">{brand.description || 'N/A'}</TableCell>
                        <TableCell className="font-mono text-xs">{brand.db_name}</TableCell>
                        <TableCell className="text-sm">
                          {brand.createdAt ? format(new Date(brand.createdAt), 'dd MMM yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="success">Active</Badge>
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

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent onClose={() => setShowModal(false)}>
          <DialogHeader>
            <DialogTitle>Create New Brand</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Brand Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter brand name"
                required
                data-testid="brand-name-input"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
                data-testid="brand-description-input"
              />
            </div>
            <div>
              <Label htmlFor="image_url">Image URL</Label>
              <Input
                id="image_url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/logo.png"
                data-testid="brand-image-input"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1" data-testid="brand-submit-button">
                Create Brand
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default BrandsPage;