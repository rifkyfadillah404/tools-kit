import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Package, Image as ImageIcon, Boxes, Wrench } from 'lucide-react';
import { Button, Input, Modal, Select, Textarea } from '../../components/ui';
import { toolApi, categoryApi, getPublicFileUrl } from '../../api';
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
  photo_url?: string;
}

interface ToolUnit {
  id: number;
  tool_id: number;
  unit_code: string;
  status: 'available' | 'dipinjam' | 'maintenance' | 'hilang';
  condition_note?: string | null;
  peminjaman_id?: number | null;
}

interface Category {
  id: number;
  name: string;
}

const unitStatusLabel: Record<string, string> = {
  available: 'Tersedia',
  dipinjam: 'Dipinjam',
  maintenance: 'Maintenance',
  hilang: 'Hilang',
};

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
    photo_url: '',
    unit_codes_text: '',
  });
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [units, setUnits] = useState<ToolUnit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [bulkUnitText, setBulkUnitText] = useState('');
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [editingUnitStatus, setEditingUnitStatus] = useState<'available' | 'dipinjam' | 'maintenance' | 'hilang'>('available');
  const [editingUnitNote, setEditingUnitNote] = useState('');

  useEffect(() => {
    void fetchTools();
    void fetchCategories();
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
    } catch {
      addToast('Gagal memuat data alat', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await categoryApi.getAll();
      setCategories(data);
    } catch {
      // ignore
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
        photo_url: tool.photo_url || '',
        unit_codes_text: '',
      });
    } else {
      setEditingTool(null);
      setFormData({
        name: '',
        category_id: categories[0]?.id?.toString() || '',
        asset_tag: '',
        description: '',
        location: '',
        stock: '1',
        available_stock: '1',
        photo_url: '',
        unit_codes_text: '',
      });
    }
    setSelectedPhotoFile(null);
    setModalOpen(true);
  };

  const parsedUnitCodes = useMemo(() => {
    return formData.unit_codes_text
      .split(/\r?\n|,|;/)
      .map((v) => v.trim())
      .filter(Boolean);
  }, [formData.unit_codes_text]);

  const handleUploadPhoto = async () => {
    if (!selectedPhotoFile) return formData.photo_url;

    const { data } = await toolApi.uploadPhoto(selectedPhotoFile);
    return data.photo_url as string;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const uploadedPhotoUrl = await handleUploadPhoto();

      if (editingTool) {
        const payload = {
          name: formData.name,
          category_id: Number(formData.category_id),
          asset_tag: formData.asset_tag || undefined,
          description: formData.description || undefined,
          location: formData.location || undefined,
          photo_url: uploadedPhotoUrl || undefined,
        };

        await toolApi.update(editingTool.id, payload);
        addToast('Alat berhasil diperbarui', 'success');
      } else {
        const stockFromCodes = parsedUnitCodes.length > 0 ? parsedUnitCodes.length : Number(formData.stock || 1);
        const availableFromCodes = parsedUnitCodes.length > 0 ? parsedUnitCodes.length : Number(formData.available_stock || 1);

        const payload = {
          name: formData.name,
          category_id: Number(formData.category_id),
          asset_tag: formData.asset_tag || undefined,
          description: formData.description || undefined,
          location: formData.location || undefined,
          stock: stockFromCodes,
          available_stock: availableFromCodes,
          photo_url: uploadedPhotoUrl || undefined,
          unit_codes: parsedUnitCodes.length > 0 ? parsedUnitCodes : undefined,
        };

        await toolApi.create(payload);
        addToast('Alat berhasil ditambahkan', 'success');
      }

      setModalOpen(false);
      void fetchTools();
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
      void fetchTools();
    } catch {
      addToast('Gagal menghapus alat', 'error');
    }
  };

  const openUnitsModal = async (tool: Tool) => {
    setSelectedTool(tool);
    setUnitModalOpen(true);
    setBulkUnitText('');
    setEditingUnitId(null);
    setLoadingUnits(true);

    try {
      const { data } = await toolApi.getUnits(tool.id);
      setUnits(data);
    } catch {
      addToast('Gagal memuat data unit', 'error');
    } finally {
      setLoadingUnits(false);
    }
  };

  const refreshUnits = async () => {
    if (!selectedTool) return;
    const { data } = await toolApi.getUnits(selectedTool.id);
    setUnits(data);
    void fetchTools();
  };

  const handleAddUnits = async () => {
    if (!selectedTool) return;
    const unitCodes = bulkUnitText
      .split(/\r?\n|,|;/)
      .map((v) => v.trim())
      .filter(Boolean);

    if (unitCodes.length === 0) {
      addToast('Masukkan minimal 1 unit code', 'error');
      return;
    }

    try {
      await toolApi.addUnits(selectedTool.id, unitCodes);
      addToast('Unit berhasil ditambahkan', 'success');
      setBulkUnitText('');
      await refreshUnits();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Gagal menambah unit', 'error');
    }
  };

  const startEditUnit = (unit: ToolUnit) => {
    setEditingUnitId(unit.id);
    setEditingUnitStatus(unit.status);
    setEditingUnitNote(unit.condition_note || '');
  };

  const saveEditUnit = async (unit: ToolUnit) => {
    if (!selectedTool) return;

    try {
      await toolApi.updateUnitStatus(selectedTool.id, unit.id, {
        status: editingUnitStatus,
        condition_note: editingUnitNote,
      });
      addToast('Unit berhasil diperbarui', 'success');
      setEditingUnitId(null);
      await refreshUnits();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Gagal update unit', 'error');
    }
  };

  const deleteUnit = async (unit: ToolUnit) => {
    if (!selectedTool) return;
    if (!confirm(`Hapus unit ${unit.unit_code}?`)) return;

    try {
      await toolApi.deleteUnit(selectedTool.id, unit.id);
      addToast('Unit berhasil dihapus', 'success');
      await refreshUnits();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Gagal hapus unit', 'error');
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daftar Alat</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Kelola inventaris alat, foto, dan unit code</p>
        </div>
        {canManageInventory() && (
          <Button onClick={() => openModal()} icon={<Plus size={16} />}>
            Tambah Alat
          </Button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-ink-100 dark:border-ink-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama, asset tag, atau unit code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 dark:border-ink-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-sm border border-ink-200 dark:border-ink-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">Semua Kategori</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-ink-200 dark:border-ink-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">Semua Status</option>
            <option value="available">Tersedia</option>
            <option value="not_available">Tidak Tersedia</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-ink-100 dark:border-ink-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-ink-200 dark:border-ink-600 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : tools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <Package size={48} className="mb-4 opacity-50" />
            <p>Tidak ada alat ditemukan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-ink-200 dark:border-ink-700">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">Foto</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">Kode</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">Nama Alat</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">Kategori</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">Stok Unit</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">Status</th>
                  {canManageInventory() && (
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-700">
                {tools.map((tool) => (
                  <tr key={tool.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3">
                      {tool.photo_url ? (
                        <img
                          src={getPublicFileUrl(tool.photo_url)}
                          alt={tool.name}
                          className="w-12 h-12 object-cover rounded-lg border border-ink-200 dark:border-ink-700"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg border border-dashed border-ink-300 dark:border-ink-600 flex items-center justify-center text-ink-400">
                          <ImageIcon size={16} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                        {tool.asset_tag || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{tool.name}</p>
                      {tool.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{tool.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{tool.category_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      <div className="text-xs">
                        <p>Total: <span className="font-semibold">{tool.stock}</span></p>
                        <p>Tersedia: <span className="font-semibold">{tool.available_stock}</span></p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`status-badge status-${tool.status}`}>
                        {statusLabel(tool.status)}
                      </span>
                    </td>
                    {canManageInventory() && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openUnitsModal(tool)}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded"
                            title="Kelola unit"
                          >
                            <Boxes size={16} />
                          </button>
                          <button
                            onClick={() => openModal(tool)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                            title="Edit alat"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(tool)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                            title="Hapus alat"
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
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Upload Foto</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedPhotoFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          {(selectedPhotoFile || formData.photo_url) && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Preview Foto</p>
              <img
                src={selectedPhotoFile ? URL.createObjectURL(selectedPhotoFile) : getPublicFileUrl(formData.photo_url)}
                alt="Preview"
                className="w-28 h-28 object-cover rounded-lg border border-ink-200 dark:border-ink-700"
              />
            </div>
          )}

          {!editingTool && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Jumlah Unit (auto generate)"
                  name="stock"
                  type="number"
                  min={1}
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                />
                <Input
                  label="Available Unit Awal"
                  name="available_stock"
                  type="number"
                  min={0}
                  max={Number(formData.stock || 1)}
                  value={formData.available_stock}
                  onChange={(e) => setFormData({ ...formData, available_stock: e.target.value })}
                />
              </div>

              <Textarea
                label="Unit Codes (opsional)"
                placeholder="Satu per baris, atau pisahkan dengan koma. Jika kosong, akan auto generate saat simpan."
                value={formData.unit_codes_text}
                onChange={(e) => setFormData({ ...formData, unit_codes_text: e.target.value })}
                rows={4}
              />
            </>
          )}

          {editingTool && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Stock (derived)</label>
                <div className="px-3 py-2 text-sm rounded-xl border border-ink-200 dark:border-ink-700 bg-gray-50 dark:bg-gray-800">
                  {editingTool.stock}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Available (derived)</label>
                <div className="px-3 py-2 text-sm rounded-xl border border-ink-200 dark:border-ink-700 bg-gray-50 dark:bg-gray-800">
                  {editingTool.available_stock}
                </div>
              </div>
            </div>
          )}

          <Textarea
            label="Deskripsi"
            name="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </form>
      </Modal>

      <Modal
        isOpen={unitModalOpen}
        onClose={() => setUnitModalOpen(false)}
        title={`Kelola Unit • ${selectedTool?.name || ''}`}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setUnitModalOpen(false)}>
            Tutup
          </Button>
        }
      >
        {!selectedTool ? null : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg border border-ink-200 dark:border-ink-700 bg-gray-50 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Unit</p>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedTool.stock}</p>
              </div>
              <div className="p-3 rounded-lg border border-ink-200 dark:border-ink-700 bg-gray-50 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Tersedia</p>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedTool.available_stock}</p>
              </div>
              <div className="p-3 rounded-lg border border-ink-200 dark:border-ink-700 bg-gray-50 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Aksi</p>
                <p className="font-semibold text-gray-900 dark:text-white">Kelola status per unit</p>
              </div>
            </div>

            {canManageInventory() && (
              <div className="border border-ink-200 dark:border-ink-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-2 text-gray-900 dark:text-white">Tambah Unit Code (Bulk)</h3>
                <Textarea
                  value={bulkUnitText}
                  onChange={(e) => setBulkUnitText(e.target.value)}
                  rows={3}
                  placeholder="Masukkan unit code, dipisah baris/koma/semicolon"
                />
                <div className="mt-3">
                  <Button onClick={handleAddUnits} icon={<Plus size={14} />}>Tambah Unit</Button>
                </div>
              </div>
            )}

            <div className="border border-ink-200 dark:border-ink-700 rounded-lg overflow-hidden">
              {loadingUnits ? (
                <div className="p-6 text-center text-gray-500">Memuat unit...</div>
              ) : units.length === 0 ? (
                <div className="p-6 text-center text-gray-500">Belum ada unit.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800 border-b border-ink-200 dark:border-ink-700">
                        <th className="text-left px-3 py-2 text-xs uppercase text-gray-500">Unit Code</th>
                        <th className="text-left px-3 py-2 text-xs uppercase text-gray-500">Status</th>
                        <th className="text-left px-3 py-2 text-xs uppercase text-gray-500">Catatan</th>
                        <th className="text-left px-3 py-2 text-xs uppercase text-gray-500">Peminjaman</th>
                        {canManageInventory() && <th className="text-right px-3 py-2 text-xs uppercase text-gray-500">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 dark:divide-ink-700">
                      {units.map((unit) => (
                        <tr key={unit.id}>
                          <td className="px-3 py-2 font-mono text-xs">{unit.unit_code}</td>
                          <td className="px-3 py-2">
                            {editingUnitId === unit.id ? (
                              <select
                                value={editingUnitStatus}
                                onChange={(e) => setEditingUnitStatus(e.target.value as any)}
                                className="px-2 py-1 text-xs border border-ink-200 dark:border-ink-600 rounded"
                              >
                                <option value="available">available</option>
                                <option value="dipinjam">dipinjam</option>
                                <option value="maintenance">maintenance</option>
                                <option value="hilang">hilang</option>
                              </select>
                            ) : (
                              <span className={`status-badge status-${unit.status}`}>{unitStatusLabel[unit.status] || unit.status}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 max-w-xs">
                            {editingUnitId === unit.id ? (
                              <input
                                value={editingUnitNote}
                                onChange={(e) => setEditingUnitNote(e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-ink-200 dark:border-ink-600 rounded bg-white dark:bg-gray-800"
                              />
                            ) : (
                              <span className="text-xs text-gray-600 dark:text-gray-300">{unit.condition_note || '-'}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {unit.peminjaman_id ? (
                              <span className="inline-flex items-center gap-1 text-amber-600"><Wrench size={12} /> #{unit.peminjaman_id}</span>
                            ) : '-'}
                          </td>
                          {canManageInventory() && (
                            <td className="px-3 py-2 text-right">
                              {editingUnitId === unit.id ? (
                                <div className="inline-flex gap-1">
                                  <Button size="sm" onClick={() => void saveEditUnit(unit)}>Simpan</Button>
                                  <Button size="sm" variant="secondary" onClick={() => setEditingUnitId(null)}>Batal</Button>
                                </div>
                              ) : (
                                <div className="inline-flex gap-1">
                                  <button
                                    onClick={() => startEditUnit(unit)}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit unit"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => void deleteUnit(unit)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Hapus unit"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
