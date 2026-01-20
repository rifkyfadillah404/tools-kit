import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, FolderOpen } from 'lucide-react';
import { Button, Input, Modal, Textarea } from '../../components/ui';
import { categoryApi } from '../../api';
import { useUIStore } from '../../store/uiStore';

interface Category {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  tool_count: number;
}

export const CategoriesPage: React.FC = () => {
  const { addToast } = useUIStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await categoryApi.getAll();
      setCategories(data);
    } catch (err) {
      addToast('Gagal memuat kategori', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ name: category.name, description: category.description || '' });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', description: '' });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingCategory) {
        await categoryApi.update(editingCategory.id, formData);
        addToast('Kategori berhasil diperbarui', 'success');
      } else {
        await categoryApi.create(formData);
        addToast('Kategori berhasil ditambahkan', 'success');
      }
      setModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: Category) => {
    if (category.tool_count > 0) {
      addToast('Tidak bisa menghapus kategori yang masih memiliki alat', 'error');
      return;
    }
    if (!confirm(`Hapus kategori "${category.name}"?`)) return;

    try {
      await categoryApi.delete(category.id);
      addToast('Kategori berhasil dihapus', 'success');
      fetchCategories();
    } catch (err) {
      addToast('Gagal menghapus kategori', 'error');
    }
  };

  return (
    <div className="animate-[fadeIn_300ms_ease-out]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Kategori</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-1">Kelola kategori untuk mengelompokkan alat</p>
        </div>
        <Button onClick={() => openModal()} icon={<Plus size={16} />}>
          Tambah Kategori
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-ink-200 dark:border-ink-600 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-white dark:bg-ink-900 rounded-lg border border-ink-100 dark:border-ink-700 p-5 hover:border-ink-200 dark:hover:border-ink-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <FolderOpen size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink-900 dark:text-white">{category.name}</h3>
                    <p className="text-sm text-ink-500 dark:text-ink-400">{category.tool_count} alat</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openModal(category)}
                    className="p-1.5 text-ink-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(category)}
                    className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {category.description && (
                <p className="mt-3 text-sm text-ink-600 dark:text-ink-400 line-clamp-2">{category.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCategory ? 'Edit Kategori' : 'Tambah Kategori'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editingCategory ? 'Simpan' : 'Tambah'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama Kategori"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
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
