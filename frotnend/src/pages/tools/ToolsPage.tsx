import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Package } from 'lucide-react';
import { Button, Input, Modal, Select, Textarea } from '../../components/ui';
import { toolApi, categoryApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

interface Tool {
  id: number;
  name: string;
  asset_tag: string;
  category_id: number;
  category_name: string;
  description: string;
  location: string;
  status: string;
  stock: number;
  available_stock: number;
}

interface Category {
  id: number;
  name: string;
}

export const ToolsPage: React.FC = () => {
  const { canManageInventory } = useAuthStore();
  const { addToast } = useUIStore();
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    asset_tag: '',
    description: '',
    location: '',
    stock: '1',
    available_stock: '1',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTools();
    fetchCategories();
  }, [search, filterCategory, filterStatus]);

  const fetchTools = async () => {
    try {
      const { data } = await toolApi.getAll({
        search: search || undefined,
        category_id: filterCategory ? Number(filterCategory) : undefined,
        status: filterStatus || undefined,
        limit: 100,
      });
      setTools(data.data);
    } catch (err) {
      addToast('Gagal memuat data alat', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await categoryApi.getAll();
      setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  const openModal = (tool?: Tool) => {
    if (tool) {
      setEditingTool(tool);
      setFormData({
        name: tool.name,
        category_id: String(tool.category_id),
        asset_tag: tool.asset_tag || '',
        description: tool.description || '',
        location: tool.location || '',
        stock: String(tool.stock ?? 1),
        available_stock: String(tool.available_stock ?? tool.stock ?? 1),
      });
    } else {
      setEditingTool(null);
      setFormData({
        name: '',
        category_id: categories[0]?.id.toString() || '',
        asset_tag: '',
        description: '',
        location: '',
        stock: '1',
        available_stock: '1',
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...formData,
        category_id: Number(formData.category_id),
        stock: Number(formData.stock),
        available_stock: Number(formData.available_stock),
      };

      if (editingTool) {
        await toolApi.update(editingTool.id, payload);
        addToast('Alat berhasil diperbarui', 'success');
      } else {
        await toolApi.create(payload);
        addToast('Alat berhasil ditambahkan', 'success');
      }

      setModalOpen(false);
      fetchTools();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tool: Tool) => {
    if (!confirm(`Hapus alat "${tool.name}"?`)) return;

    try {
      await toolApi.delete(tool.id);
      addToast('Alat berhasil dihapus', 'success');
      fetchTools();
    } catch (err) {
      addToast('Gagal menghapus alat', 'error');
    }
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      available: 'Tersedia',
      not_available: 'Tidak Tersedia',
    };
    return labels[status] || status;
  };

  return (
    <div className="animate-[fadeIn_300ms_ease-out]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Daftar Alat</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-1">Kelola inventaris alat dan peralatan</p>
        </div>
        {canManageInventory() && (
          <Button onClick={() => openModal()} icon={<Plus size={16} />}>
            Tambah Alat
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-ink-900 rounded-lg border border-ink-100 dark:border-ink-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              placeholder="Cari nama atau kode alat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 dark:border-ink-600 rounded-md bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 placeholder:text-ink-400 dark:placeholder:text-ink-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-sm border border-ink-200 dark:border-ink-600 rounded-md bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
          >
            <option value="">Semua Kategori</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-ink-200 dark:border-ink-600 rounded-md bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
          >
            <option value="">Semua Status</option>
            <option value="available">Tersedia</option>
            <option value="not_available">Tidak Tersedia</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-ink-900 rounded-lg border border-ink-100 dark:border-ink-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-ink-200 dark:border-ink-600 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : tools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-ink-500 dark:text-ink-400">
            <Package size={48} className="mb-4 opacity-50" />
            <p>Tidak ada alat ditemukan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
                  <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs tracking-wide">Kode</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs tracking-wide">Nama Alat</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs tracking-wide">Kategori</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs tracking-wide">Lokasi</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs tracking-wide">Status</th>
                  {canManageInventory() && (
                    <th className="text-right px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs tracking-wide">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-700">
                {tools.map((tool) => (
                  <tr key={tool.id} className="hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-300 px-2 py-1 rounded">
                        {tool.asset_tag || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900 dark:text-white">{tool.name}</p>
                      {tool.description && (
                        <p className="text-xs text-ink-500 dark:text-ink-400 truncate max-w-xs">{tool.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{tool.category_name}</td>
                    <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{tool.location || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`status-badge status-${tool.status}`}>
                        {statusLabel(tool.status)}
                      </span>
                    </td>
                    {canManageInventory() && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openModal(tool)}
                            className="p-1.5 text-ink-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(tool)}
                            className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTool ? 'Edit Alat' : 'Tambah Alat Baru'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editingTool ? 'Simpan' : 'Tambah'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama Alat"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Kategori"
              name="category_id"
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              required
            />
            <Input
              label="Kode/Asset Tag"
              name="asset_tag"
              value={formData.asset_tag}
              onChange={(e) => setFormData({ ...formData, asset_tag: e.target.value })}
              placeholder="TL-001"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Lokasi"
              name="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Rak A1"
            />
            <Input
              label="Stock"
              name="stock"
              type="number"
              min={0}
              value={formData.stock}
              onChange={(e) => {
                const nextStock = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  stock: nextStock,
                  available_stock: Math.min(
                    Number(prev.available_stock || 0),
                    Number(nextStock || 0)
                  ).toString(),
                }));
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Available Stock"
              name="available_stock"
              type="number"
              min={0}
              max={Number(formData.stock) || undefined}
              value={formData.available_stock}
              onChange={(e) => setFormData({ ...formData, available_stock: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1">Status</label>
              <div className="px-3 py-2 text-sm border border-ink-200 dark:border-ink-600 rounded-md bg-ink-50 dark:bg-ink-800 text-ink-700 dark:text-ink-300">
                {Number(formData.available_stock) > 0 ? 'Tersedia' : 'Tidak Tersedia'}
              </div>
            </div>
          </div>
          <Textarea
            label="Deskripsi"
            name="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </form>
      </Modal>
    </div>
  );
};
