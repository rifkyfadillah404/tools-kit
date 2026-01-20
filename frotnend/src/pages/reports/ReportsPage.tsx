import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, BarChart3, ScrollText, Printer } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { reportApi } from '../../api';
import { useUIStore } from '../../store/uiStore';

type TabId = 'overdue' | 'utilization' | 'audit' | 'print';

export const ReportsPage: React.FC = () => {
  const { addToast } = useUIStore();

  const [activeTab, setActiveTab] = useState<TabId>('overdue');
  const [overdueRows, setOverdueRows] = useState<any[]>([]);
  const [dueSoonRows, setDueSoonRows] = useState<any[]>([]);
  const [utilization, setUtilization] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [printRows, setPrintRows] = useState<any[]>([]);
  const [printStatus, setPrintStatus] = useState('');
  const [printStart, setPrintStart] = useState('');
  const [printEnd, setPrintEnd] = useState('');

  const [loading, setLoading] = useState(true);

  const printTitle = useMemo(() => {
    const parts = ['Laporan Peminjaman'];
    if (printStart && printEnd) parts.push(`${printStart} s/d ${printEnd}`);
    if (printStatus) parts.push(`Status: ${printStatus}`);
    return parts.join(' • ');
  }, [printEnd, printStart, printStatus]);

  useEffect(() => {
    void fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overdue') {
        const [overdueRes, dueSoonRes] = await Promise.all([
          reportApi.getOverdue(),
          reportApi.getDueSoon(7),
        ]);
        setOverdueRows(overdueRes.data);
        setDueSoonRows(dueSoonRes.data);
      } else if (activeTab === 'utilization') {
        const { data } = await reportApi.getUtilization();
        setUtilization(data);
      } else if (activeTab === 'audit') {
        const { data } = await reportApi.getAuditLogs({ limit: 100 });
        setAuditLogs(data.data);
      } else if (activeTab === 'print') {
        const { data } = await reportApi.getPeminjamanReport({
          start_date: printStart || undefined,
          end_date: printEnd || undefined,
          status: printStatus || undefined,
        });
        setPrintRows(data);
      }
    } catch {
      addToast('Gagal memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('id-ID');
  const formatDateTime = (date: string) => new Date(date).toLocaleString('id-ID');

  const tabs = [
    { id: 'overdue', label: 'Keterlambatan', icon: AlertTriangle },
    { id: 'utilization', label: 'Utilisasi Alat', icon: BarChart3 },
    { id: 'audit', label: 'Log Aktivitas', icon: ScrollText },
    { id: 'print', label: 'Cetak', icon: Printer },
  ] as const;

  const openPrint = () => {
    const w = window.open('', '_blank');
    if (!w) {
      addToast('Popup diblokir. Izinkan pop-up untuk cetak.', 'error');
      return;
    }

    const rowsHtml = printRows
      .map((r) => {
        const denda = Number(r.denda_pengembalian || r.denda || 0);
        return `
          <tr>
            <td>${r.id}</td>
            <td>${r.peminjam_name || ''}</td>
            <td>${r.tool_name || ''} <span class="muted">(${r.asset_tag || ''})</span></td>
            <td style="text-align:right;">${r.qty ?? ''}</td>
            <td>${r.tanggal_pinjam ? formatDate(r.tanggal_pinjam) : ''}</td>
            <td>${r.tanggal_kembali_rencana ? formatDate(r.tanggal_kembali_rencana) : ''}</td>
            <td>${r.status || ''}</td>
            <td style="text-align:right;">Rp ${denda.toLocaleString('id-ID')}</td>
          </tr>
        `;
      })
      .join('');

    w.document.open();
    w.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>${printTitle}</title>
          <style>
            :root { color-scheme: light; }
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; color: #111827; }
            h1 { font-size: 18px; margin: 0 0 4px; }
            .meta { font-size: 12px; color: #6b7280; margin: 0 0 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; vertical-align: top; }
            th { background: #f9fafb; text-align: left; }
            .muted { color: #6b7280; }
          </style>
        </head>
        <body>
          <h1>${printTitle}</h1>
          <p class="meta">Dicetak: ${new Date().toLocaleString('id-ID')}</p>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Peminjam</th>
                <th>Alat</th>
                <th style="text-align:right;">Qty</th>
                <th>Tgl Pinjam</th>
                <th>Tgl Kembali</th>
                <th>Status</th>
                <th style="text-align:right;">Denda</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = () => window.print();
          <\/script>
        </body>
      </html>
    `);
    w.document.close();
  };

  return (
    <div className="animate-[fadeIn_300ms_ease-out]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Laporan</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Monitoring peminjaman, denda, dan log aktivitas</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-ink-100 dark:bg-ink-800 p-1 rounded-lg mb-6 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-white shadow-sm' : 'text-ink-600 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-200'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-ink-200 dark:border-ink-600 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'overdue' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-ink-900 rounded-lg border border-ink-100 dark:border-ink-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-700 bg-red-50 dark:bg-red-900/20">
                  <h2 className="font-semibold text-red-800 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle size={18} />
                    Terlambat ({overdueRows.length})
                  </h2>
                </div>
                {overdueRows.length === 0 ? (
                  <div className="p-8 text-center text-ink-500 dark:text-ink-400">Tidak ada peminjaman terlambat</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Peminjam</th>
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Email</th>
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Alat</th>
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Jatuh Tempo</th>
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Terlambat</th>
                          <th className="text-right px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Estimasi Denda</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100 dark:divide-ink-700">
                        {overdueRows.map((row) => (
                          <tr key={row.id} className="hover:bg-ink-50 dark:hover:bg-ink-800">
                            <td className="px-4 py-3 font-medium text-ink-900 dark:text-white">{row.peminjam_name}</td>
                            <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{row.peminjam_email}</td>
                            <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{row.tool_name}</td>
                            <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{formatDate(row.tanggal_kembali_rencana)}</td>
                            <td className="px-4 py-3">
                              <span className="text-red-600 dark:text-red-400 font-semibold">{row.days_overdue} hari</span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-ink-900 dark:text-white">
                              Rp {Number(row.estimated_denda || 0).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-ink-900 rounded-lg border border-ink-100 dark:border-ink-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-700 bg-amber-50 dark:bg-amber-900/20">
                  <h2 className="font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                    <Clock size={18} />
                    Jatuh Tempo 7 Hari ({dueSoonRows.length})
                  </h2>
                </div>
                {dueSoonRows.length === 0 ? (
                  <div className="p-8 text-center text-ink-500 dark:text-ink-400">Tidak ada peminjaman jatuh tempo dalam 7 hari</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Peminjam</th>
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Email</th>
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Alat</th>
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Jatuh Tempo</th>
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Sisa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100 dark:divide-ink-700">
                        {dueSoonRows.map((row) => (
                          <tr key={row.id} className="hover:bg-ink-50 dark:hover:bg-ink-800">
                            <td className="px-4 py-3 font-medium text-ink-900 dark:text-white">{row.peminjam_name}</td>
                            <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{row.peminjam_email}</td>
                            <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{row.tool_name}</td>
                            <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{formatDate(row.tanggal_kembali_rencana)}</td>
                            <td className="px-4 py-3">
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">{row.days_until_due} hari</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'utilization' && (
            <div className="bg-white dark:bg-ink-900 rounded-lg border border-ink-100 dark:border-ink-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-700">
                <h2 className="font-semibold text-ink-900 dark:text-white">Utilisasi Alat</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
                      <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Alat</th>
                      <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Kategori</th>
                      <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Kode</th>
                      <th className="text-right px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Jumlah Pinjam</th>
                      <th className="text-right px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Total Hari</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-700">
                    {utilization.map((tool) => (
                      <tr key={tool.id} className="hover:bg-ink-50 dark:hover:bg-ink-800">
                        <td className="px-4 py-3 font-medium text-ink-900 dark:text-white">{tool.name}</td>
                        <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{tool.category_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-300 px-2 py-1 rounded">{tool.asset_tag || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-ink-900 dark:text-white">{tool.borrow_count}</td>
                        <td className="px-4 py-3 text-right text-ink-600 dark:text-ink-300">{tool.total_days_borrowed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="bg-white dark:bg-ink-900 rounded-lg border border-ink-100 dark:border-ink-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-700">
                <h2 className="font-semibold text-ink-900 dark:text-white">Log Aktivitas</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
                      <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Waktu</th>
                      <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">User</th>
                      <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Aksi</th>
                      <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Entity</th>
                      <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-700">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-ink-50 dark:hover:bg-ink-800">
                        <td className="px-4 py-3 text-xs text-ink-500 dark:text-ink-400 font-mono">{formatDateTime(log.created_at)}</td>
                        <td className="px-4 py-3 font-medium text-ink-900 dark:text-white">{log.user_name || 'System'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-300 text-xs font-medium rounded">{log.action}</span>
                        </td>
                        <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{log.entity_type}</td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-500 dark:text-ink-400">#{log.entity_id || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'print' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-ink-900 rounded-lg border border-ink-100 dark:border-ink-700 p-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <Input
                    label="Tanggal Mulai"
                    type="date"
                    value={printStart}
                    onChange={(e) => setPrintStart(e.target.value)}
                  />
                  <Input
                    label="Tanggal Selesai"
                    type="date"
                    value={printEnd}
                    onChange={(e) => setPrintEnd(e.target.value)}
                  />
                  <div>
                    <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1">Status</label>
                    <select
                      value={printStatus}
                      onChange={(e) => setPrintStatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-ink-200 dark:border-ink-600 rounded-md bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
                    >
                      <option value="">Semua</option>
                      <option value="pending">pending</option>
                      <option value="approved">approved</option>
                      <option value="rejected">rejected</option>
                      <option value="dipinjam">dipinjam</option>
                      <option value="dikembalikan">dikembalikan</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void fetchData();
                      }}
                    >
                      Ambil
                    </Button>
                    <Button onClick={openPrint} icon={<Printer size={16} />}>
                      Cetak
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-ink-900 rounded-lg border border-ink-100 dark:border-ink-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-700 flex items-center justify-between">
                  <h2 className="font-semibold text-ink-900 dark:text-white">{printTitle}</h2>
                  <span className="text-xs text-ink-500 dark:text-ink-400">{printRows.length} baris</span>
                </div>
                {printRows.length === 0 ? (
                  <div className="p-8 text-center text-ink-500 dark:text-ink-400">Tidak ada data untuk dicetak</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">ID</th>
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Peminjam</th>
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Alat</th>
                          <th className="text-right px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Qty</th>
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Tgl Pinjam</th>
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Tgl Kembali</th>
                          <th className="text-left px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Status</th>
                          <th className="text-right px-4 py-3 font-semibold text-ink-600 dark:text-ink-300 uppercase text-xs">Denda</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100 dark:divide-ink-700">
                        {printRows.map((r) => (
                          <tr key={r.id} className="hover:bg-ink-50 dark:hover:bg-ink-800">
                            <td className="px-4 py-3 font-mono text-xs text-ink-600 dark:text-ink-400">#{r.id}</td>
                            <td className="px-4 py-3 font-medium text-ink-900 dark:text-white">{r.peminjam_name}</td>
                            <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{r.tool_name}</td>
                            <td className="px-4 py-3 text-right font-semibold text-ink-900 dark:text-white">{r.qty}</td>
                            <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{formatDate(r.tanggal_pinjam)}</td>
                            <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{formatDate(r.tanggal_kembali_rencana)}</td>
                            <td className="px-4 py-3">
                              <span className={`status-badge status-${r.status}`}>{r.status}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-ink-900 dark:text-white">
                              Rp {Number(r.denda_pengembalian || r.denda || 0).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
