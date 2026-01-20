import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Eye, Check, X, Handshake } from 'lucide-react';
import { Button, Input, Modal, Select, Textarea } from '../../components/ui';
import { peminjamanApi, toolApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

interface PeminjamanRow {
  id: number;
  peminjam_id: number;
  peminjam_name: string;
  tool_id: number;
  tool_name: string;
  asset_tag: string;
  qty: number;
  tanggal_pinjam: string;
  tanggal_kembali_rencana: string;
  status: string;
  catatan: string | null;
  approved_by_name: string | null;
  checkout_by_name: string | null;
}

interface PeminjamanDetail extends PeminjamanRow {
  tanggal_kembali_aktual: string | null;
  kondisi_keluar: string | null;
  kondisi_masuk: string | null;
  return_by_name: string | null;
  denda: string;
  pengembalian?: {
    id: number;
    tanggal_kembali: string;
    kondisi: string;
    denda: string;
    keterangan: string | null;
    petugas_id: number;
    created_at: string;
  } | null;
}

interface Tool {
  id: number;
  name: string;
  asset_tag: string;
  status: string;
  available_stock: number;
}

export const LoanRequestsPage: React.FC = () => {
  const { user, canProcessPeminjaman, isPeminjam } = useAuthStore();
  const { addToast } = useUIStore();

  const [rows, setRows] = useState<PeminjamanRow[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  const [selected, setSelected] = useState<PeminjamanDetail | null>(null);

  const [rejectReason, setRejectReason] = useState('');
  const [checkoutCondition, setCheckoutCondition] = useState('Baik');

  const [formData, setFormData] = useState({
    tool_id: '',
    qty: '1',
    tanggal_pinjam: '',
    tanggal_kembali: '',
    catatan: '',
  });

  const [saving, setSaving] = useState(false);

  const selectedTool = useMemo(() => {
    const toolId = Number(formData.tool_id);
    return tools.find((t) => t.id === toolId) || null;
  }, [formData.tool_id, tools]);

  const maxQty = selectedTool?.available_stock || 1;

  useEffect(() => {
    void fetchRows();
  }, [filterStatus]);

  useEffect(() => {
    void fetchTools();
  }, []);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data } = await peminjamanApi.getAll({
        status: filterStatus || undefined,
        limit: 100,
      });
      setRows(data.data);
    } catch {
      addToast('Gagal memuat peminjaman', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTools = async () => {
    try {
      const { data } = await toolApi.getAll({ status: 'available', limit: 200 });
      setTools(data.data);

      if (!formData.tool_id && data.data.length > 0) {
        setFormData((prev) => ({ ...prev, tool_id: String(data.data[0].id) }));
      }
    } catch {
      // ignore
    }
  };

  const openDetail = async (row: PeminjamanRow) => {
    try {
      const { data } = await peminjamanApi.getById(row.id);
      setSelected(data as PeminjamanDetail);
      setDetailModalOpen(true);
    } catch {
      addToast('Gagal memuat detail', 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.tool_id) {
      addToast('Pilih alat', 'error');
      return;
    }

    setSaving(true);
    try {
      await peminjamanApi.create({
        tool_id: Number(formData.tool_id),
        qty: Number(formData.qty || 1),
        tanggal_pinjam: formData.tanggal_pinjam,
        tanggal_kembali: formData.tanggal_kembali,
        catatan: formData.catatan || undefined,
      });

      addToast('Pengajuan berhasil dibuat', 'success');
      setCreateModalOpen(false);
      setFormData((prev) => ({
        tool_id: prev.tool_id,
        qty: '1',
        tanggal_pinjam: '',
        tanggal_kembali: '',
        catatan: '',
      }));

      void fetchRows();
      void fetchTools();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Gagal membuat pengajuan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await peminjamanApi.approve(selected.id);
      addToast('Pengajuan disetujui', 'success');
      setDetailModalOpen(false);
      void fetchRows();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Gagal menyetujui', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await peminjamanApi.reject(selected.id, rejectReason || undefined);
      addToast('Pengajuan ditolak', 'success');
      setRejectModalOpen(false);
      setDetailModalOpen(false);
      setRejectReason('');
      void fetchRows();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Gagal menolak', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckout = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await peminjamanApi.checkout(selected.id, checkoutCondition || 'Baik');
      addToast('Alat berhasil diserahkan', 'success');
      setCheckoutModalOpen(false);
      setDetailModalOpen(false);
      void fetchRows();
      void fetchTools();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Gagal checkout', 'error');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Menunggu',
      approved: 'Disetujui',
      rejected: 'Ditolak',
      dipinjam: 'Dipinjam',
      dikembalikan: 'Dikembalikan',
    };
    return labels[status] || status;
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('id-ID');

  return (
    <div className="animate-[fadeIn_300ms_ease-out]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Peminjaman</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-1">
            {canProcessPeminjaman() ? 'Kelola pengajuan dan proses peminjaman' : 'Lihat dan buat pengajuan baru'}
          </p>
        </div>
        {(isPeminjam() || user?.role === 'admin') && (
          <Button onClick={() => setCreateModalOpen(true)} icon={<Plus size={16} />}>
            Ajukan Peminjaman
          </Button>
        )}
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-ink-900 rounded-lg border border-ink-100 dark:border-ink-700 p-4 mb-6">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-ink-200 dark:border-ink-600 rounded-md bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
        >
          <option value="">Semua Status</option>
          <option value="pending">Menunggu</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
          <option value="dipinjam">Dipinjam</option>
          <option value="dikembalikan">Dikembalikan</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-ink-900 rounded-lg border border-ink-100 dark:border-ink-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-ink-200 dark:border-ink-600 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-ink-500 dark:text-ink-400">
            <Handshake size={48} className="mb-4 opacity-50" />
            <p>Tidak ada data peminjaman</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
                  <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Peminjam</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Alat</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Qty</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Tanggal</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-700">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-ink-600 dark:text-ink-400">#{row.id}</td>
                    <td className="px-4 py-3 font-medium text-ink-900 dark:text-white">{row.peminjam_name}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900 dark:text-white">{row.tool_name}</p>
                      <p className="text-xs text-ink-500 dark:text-ink-400 font-mono">{row.asset_tag}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{row.qty}</td>
                    <td className="px-4 py-3 text-ink-600 dark:text-ink-300">
                      {formatDate(row.tanggal_pinjam)} - {formatDate(row.tanggal_kembali_rencana)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`status-badge status-${row.status}`}>{statusLabel(row.status)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => void openDetail(row)}
                          className="p-1.5 text-ink-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Ajukan Peminjaman"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              Kirim
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Select
            label="Pilih Alat"
            name="tool_id"
            value={formData.tool_id}
            onChange={(e) => setFormData((prev) => ({ ...prev, tool_id: e.target.value }))}
            options={tools.map((t) => ({
              value: t.id,
              label: `${t.name} (${t.available_stock} tersedia)`,
            }))}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Jumlah"
              name="qty"
              type="number"
              min={1}
              max={maxQty}
              value={formData.qty}
              onChange={(e) => setFormData((prev) => ({ ...prev, qty: e.target.value }))}
              required
            />
            <div className="pt-7 text-xs text-ink-500 dark:text-ink-400">
              Maks: <span className="font-mono">{maxQty}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tanggal Pinjam"
              type="date"
              name="tanggal_pinjam"
              value={formData.tanggal_pinjam}
              onChange={(e) => setFormData((prev) => ({ ...prev, tanggal_pinjam: e.target.value }))}
              required
            />
            <Input
              label="Tanggal Kembali"
              type="date"
              name="tanggal_kembali"
              value={formData.tanggal_kembali}
              onChange={(e) => setFormData((prev) => ({ ...prev, tanggal_kembali: e.target.value }))}
              required
            />
          </div>

          <Textarea
            label="Catatan"
            name="catatan"
            value={formData.catatan}
            onChange={(e) => setFormData((prev) => ({ ...prev, catatan: e.target.value }))}
            rows={3}
          />
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Peminjaman #${selected?.id ?? ''}`}
        size="md"
        footer={
          selected && canProcessPeminjaman() ? (
            selected.status === 'pending' ? (
              <>
                <Button
                  variant="danger"
                  onClick={() => setRejectModalOpen(true)}
                  icon={<X size={16} />}
                >
                  Tolak
                </Button>
                <Button onClick={handleApprove} loading={saving} icon={<Check size={16} />}>
                  Setujui
                </Button>
              </>
            ) : selected.status === 'approved' ? (
              <>
                <Button variant="secondary" onClick={() => setCheckoutModalOpen(true)}>
                  Checkout
                </Button>
              </>
            ) : undefined
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-ink-500 dark:text-ink-400">Peminjam</p>
                <p className="font-medium text-ink-900 dark:text-white">{selected.peminjam_name}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500 dark:text-ink-400">Status</p>
                <span className={`status-badge status-${selected.status}`}>{statusLabel(selected.status)}</span>
              </div>
              <div>
                <p className="text-xs text-ink-500 dark:text-ink-400">Tanggal Pinjam</p>
                <p className="font-medium text-ink-900 dark:text-white">{formatDate(selected.tanggal_pinjam)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500 dark:text-ink-400">Kembali (Rencana)</p>
                <p className="font-medium text-ink-900 dark:text-white">{formatDate(selected.tanggal_kembali_rencana)}</p>
              </div>
            </div>

            <div className="border border-ink-200 dark:border-ink-600 rounded-md p-3 bg-ink-50 dark:bg-ink-800">
              <p className="text-xs text-ink-500 dark:text-ink-400 mb-1">Alat</p>
              <p className="font-medium text-ink-900 dark:text-white">{selected.tool_name}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400 font-mono">{selected.asset_tag}</p>
              <p className="text-sm text-ink-600 dark:text-ink-300 mt-2">Qty: {selected.qty}</p>
            </div>

            {selected.catatan ? (
              <div>
                <p className="text-xs text-ink-500 dark:text-ink-400">Catatan</p>
                <p className="text-sm text-ink-700 dark:text-ink-300 whitespace-pre-wrap">{selected.catatan}</p>
              </div>
            ) : null}

            {selected.kondisi_keluar ? (
              <div>
                <p className="text-xs text-ink-500 dark:text-ink-400">Kondisi Keluar</p>
                <p className="text-sm text-ink-700 dark:text-ink-300">{selected.kondisi_keluar}</p>
              </div>
            ) : null}

            {selected.tanggal_kembali_aktual ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">Tanggal Kembali</p>
                  <p className="font-medium text-ink-900 dark:text-white">{formatDate(selected.tanggal_kembali_aktual)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">Denda</p>
                  <p className="font-medium text-ink-900 dark:text-white">Rp {Number(selected.denda || 0).toLocaleString('id-ID')}</p>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-ink-500 dark:text-ink-400">Disetujui</p>
                <p className="text-ink-700 dark:text-ink-300">{selected.approved_by_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500 dark:text-ink-400">Checkout</p>
                <p className="text-ink-700 dark:text-ink-300">{selected.checkout_by_name || '-'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Tolak Pengajuan"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectModalOpen(false)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleReject} loading={saving}>
              Tolak
            </Button>
          </>
        }
      >
        <Textarea
          label="Alasan"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Masukkan alasan penolakan (opsional)..."
          rows={3}
        />
      </Modal>

      {/* Checkout Modal */}
      <Modal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        title="Checkout Alat"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCheckoutModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleCheckout} loading={saving}>
              Konfirmasi
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            Serahkan alat untuk peminjaman <span className="font-mono">#{selected?.id}</span>.
          </p>
          <select
            value={checkoutCondition}
            onChange={(e) => setCheckoutCondition(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-ink-200 dark:border-ink-600 rounded-md bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
          >
            <option value="Baik">Baik</option>
            <option value="Cukup">Cukup</option>
            <option value="Rusak Ringan">Rusak Ringan</option>
            <option value="Rusak">Rusak</option>
          </select>
        </div>
      </Modal>
    </div>
  );
};
