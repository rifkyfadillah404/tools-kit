import React, { useEffect, useState } from 'react';
import { Eye, RotateCcw, Package } from 'lucide-react';
import { Button, Modal, Textarea } from '../../components/ui';
import { peminjamanApi } from '../../api';
import { useUIStore } from '../../store/uiStore';

interface PeminjamanRow {
  id: number;
  peminjam_name: string;
  tool_name: string;
  asset_tag: string;
  qty: number;
  status: string;
  tanggal_pinjam: string;
  tanggal_kembali_rencana: string;
  tanggal_kembali_aktual: string | null;
  kondisi_keluar: string | null;
  kondisi_masuk: string | null;
  denda: string;
  unit_codes?: string[];
  unit_codes_active?: string[];
}

export const LoansPage: React.FC = () => {
  const { addToast } = useUIStore();

  const [rows, setRows] = useState<PeminjamanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'dipinjam' | 'dikembalikan' | ''>('dipinjam');

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);

  const [selected, setSelected] = useState<PeminjamanRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [returnCondition, setReturnCondition] = useState('Baik');
  const [returnNote, setReturnNote] = useState('');

  useEffect(() => {
    void fetchRows();
  }, [filterStatus]);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data } = await peminjamanApi.getAll({
        status: filterStatus || undefined,
        limit: 100,
      });
      setRows(data.data);
    } catch {
      addToast('Gagal memuat data peminjaman', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (row: PeminjamanRow) => {
    try {
      const { data } = await peminjamanApi.getById(row.id);
      setSelected(data);
      setDetailModalOpen(true);
    } catch {
      addToast('Gagal memuat detail', 'error');
    }
  };

  const openReturn = (row: PeminjamanRow) => {
    setSelected(row);
    setReturnCondition('Baik');
    setReturnNote('');
    setReturnModalOpen(true);
  };

  const handleReturn = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { data } = await peminjamanApi.return(selected.id, returnCondition, returnNote || undefined);
      const returnedUnits = Array.isArray(data?.unit_codes) ? data.unit_codes : [];
      addToast(
        `${returnedUnits.length > 0 ? `Unit ${returnedUnits.join(', ')} • ` : ''}Pengembalian berhasil. Denda: Rp ${Number(data.denda || 0).toLocaleString('id-ID')}`,
        'success'
      );
      setReturnModalOpen(false);
      setDetailModalOpen(false);
      void fetchRows();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Pengembalian gagal', 'error');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      dipinjam: 'Dipinjam',
      dikembalikan: 'Dikembalikan',
      approved: 'Disetujui',
      pending: 'Menunggu',
      rejected: 'Ditolak',
    };
    return labels[status] || status;
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('id-ID');

  return (
    <div className="animate-[fadeIn_300ms_ease-out]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proses Pengembalian</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Kelola pengembalian dan denda keterlambatan</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 p-4 mb-6">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
        >
          <option value="">Semua</option>
          <option value="dipinjam">Dipinjam</option>
          <option value="dikembalikan">Dikembalikan</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-600 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <Package size={48} className="mb-4 opacity-50" />
            <p>Tidak ada data</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">Peminjam</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">Alat</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">Qty</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">Jatuh Tempo</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">#{row.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.peminjam_name}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{row.tool_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{row.asset_tag}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      <div>
                        <p>{row.qty}</p>
                        {row.unit_codes && row.unit_codes.length > 0 && (
                          <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                            {row.unit_codes.join(', ')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(row.tanggal_kembali_rencana)}</td>
                    <td className="px-4 py-3">
                      <span className={`status-badge status-${row.status}`}>{statusLabel(row.status)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => void openDetail(row)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        >
                          <Eye size={16} />
                        </button>
                        {row.status === 'dipinjam' && (
                          <button
                            onClick={() => openReturn(row)}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded"
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Peminjaman #${selected?.id ?? ''}`}
        size="md"
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Peminjam</p>
                <p className="font-medium text-gray-900 dark:text-white">{selected.peminjam_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                <span className={`status-badge status-${selected.status}`}>{statusLabel(selected.status)}</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pinjam</p>
                <p className="font-medium text-gray-900 dark:text-white">{formatDate(selected.tanggal_pinjam)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Rencana Kembali</p>
                <p className="font-medium text-gray-900 dark:text-white">{formatDate(selected.tanggal_kembali_rencana)}</p>
              </div>
            </div>

            <div className="border border-ink-200 dark:border-ink-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">Unit transaksi</p>
              {selected.unit_codes && selected.unit_codes.length > 0 ? (
                <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 mt-1">{selected.unit_codes.join(', ')}</p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Data unit belum tersedia.</p>
              )}
            </div>

            {selected.tanggal_kembali_aktual ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Kembali</p>
                  <p className="font-medium text-gray-900 dark:text-white">{formatDate(selected.tanggal_kembali_aktual)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Denda</p>
                  <p className="font-medium text-gray-900 dark:text-white">Rp {Number(selected.denda || 0).toLocaleString('id-ID')}</p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      {/* Return Modal */}
      <Modal
        isOpen={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        title="Konfirmasi Pengembalian"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReturnModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleReturn} loading={saving}>
              Proses
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Pengembalian peminjaman <span className="font-mono">#{selected?.id}</span>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kondisi</label>
            <select
              value={returnCondition}
              onChange={(e) => setReturnCondition(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
            >
              <option value="Baik">Baik</option>
              <option value="Cukup">Cukup</option>
              <option value="Rusak Ringan">Rusak Ringan</option>
              <option value="Rusak">Rusak</option>
              <option value="Hilang">Hilang</option>
            </select>
          </div>
          <Textarea
            label="Keterangan"
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            placeholder="Catatan pengembalian (opsional)"
            rows={3}
          />
        </div>
      </Modal>
    </div>
  );
};
