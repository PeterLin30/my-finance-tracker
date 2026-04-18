"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function App() {
  // --- STATE LOGIN ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // --- STATE UTAMA ---
  const [transaksi, setTransaksi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [fetchError, setFetchError] = useState("");

  // --- STATE FORM INPUT ---
  const [waktu, setWaktu] = useState(new Date().toISOString().split("T")[0]);
  const [tipe, setTipe] = useState("Pengeluaran");
  const [kategori, setKategori] = useState("Makanan");
  const [jumlah, setJumlah] = useState("");
  const [keterangan, setKeterangan] = useState("");

  // --- STATE ANALISIS ---
  const [filterBulan, setFilterBulan] = useState("Semua");

  // --- AUTHENTICATION ---
  useEffect(() => {
    const authStatus = localStorage.getItem("finance_auth");
    if (authStatus === "true") setIsLoggedIn(true);
    setIsCheckingAuth(false);
  }, []);

  useEffect(() => {
    if (isLoggedIn) fetchTransaksi();
  }, [isLoggedIn]);

  async function fetchTransaksi() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("transaksi")
        .select("*")
        .order("waktu", { ascending: false });

      if (error) setFetchError(error.message);
      else setTransaksi(data || []);
    } catch (err: any) {
      setFetchError(err.message || "Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  }

  // --- FUNGSI LOGIN / LOGOUT ---
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const correctPassword = process.env.NEXT_PUBLIC_WEB_PASSWORD;
    if (passwordInput === correctPassword) {
      setIsLoggedIn(true);
      setLoginError(false);
      localStorage.setItem("finance_auth", "true");
    } else {
      setLoginError(true);
      setPasswordInput("");
    }
  }

  function handleLogout() {
    setIsLoggedIn(false);
    localStorage.removeItem("finance_auth");
  }

  // --- FUNGSI SIMPAN DATA ---
  async function handleSimpan(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("transaksi").insert([
      { waktu, tipe, kategori, jumlah: Number(jumlah), keterangan },
    ]);

    if (error) alert("❌ Gagal: " + error.message);
    else {
      alert("✅ Data tersimpan!");
      setJumlah("");
      setKeterangan("");
      fetchTransaksi();
      setActiveMenu("dashboard"); 
    }
  }

  // --- KALKULASI DASHBOARD (KESELURUHAN) ---
  const totalMasuk = transaksi.filter((t) => t.tipe === "Pemasukan").reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0);
  const totalKeluar = transaksi.filter((t) => t.tipe === "Pengeluaran").reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0);
  const saldo = totalMasuk - totalKeluar;

  // --- KALKULASI ANALISIS DETAIL (BERDASARKAN FILTER) ---
  // 1. Dapatkan daftar bulan unik (Contoh: "2026-01", "2026-02")
  const daftarBulan = Array.from(new Set(transaksi.map((t) => t.waktu.substring(0, 7)))).sort().reverse();
  
  // 2. Filter data sesuai bulan yang dipilih
  const dataAnalisis = filterBulan === "Semua" ? transaksi : transaksi.filter((t) => t.waktu.startsWith(filterBulan));
  const analisisMasuk = dataAnalisis.filter((t) => t.tipe === "Pemasukan");
  const analisisKeluar = dataAnalisis.filter((t) => t.tipe === "Pengeluaran");
  
  const sumMasukAnalisis = analisisMasuk.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0);
  const sumKeluarAnalisis = analisisKeluar.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0);
  
  // 3. Statistik Kategori Pengeluaran
  const kategoriStats = analisisKeluar.reduce((acc: any, curr) => {
    acc[curr.kategori] = (acc[curr.kategori] || 0) + Number(curr.jumlah);
    return acc;
  }, {});
  const sortedKategori = Object.entries(kategoriStats).sort((a: any, b: any) => b[1] - a[1]);

  // 4. Rata-rata Harian & Top 5
  // Jika filter bulan aktif, bagi dengan tanggal terakhir di bulan itu (atau tanggal hari ini jika bulan berjalan)
  let rataHarian = 0;
  if (filterBulan !== "Semua" && sumKeluarAnalisis > 0) {
    const hariIni = new Date();
    const isBulanIni = filterBulan === `${hariIni.getFullYear()}-${String(hariIni.getMonth() + 1).padStart(2, '0')}`;
    const jumlahHari = isBulanIni ? hariIni.getDate() : new Date(Number(filterBulan.split("-")[0]), Number(filterBulan.split("-")[1]), 0).getDate();
    rataHarian = sumKeluarAnalisis / jumlahHari;
  }

  const top5Pengeluaran = [...analisisKeluar].sort((a, b) => b.jumlah - a.jumlah).slice(0, 5);

  const kategoriPengeluaran = ["Makanan", "Transportasi", "Hiburan", "Tagihan", "Kesehatan", "Lainnya"];
  const kategoriPemasukan = ["Gaji Pokok", "Bonus/THR", "Hadiah", "Investasi", "Lainnya"];

  if (isCheckingAuth) return <div className="h-screen w-screen flex items-center justify-center bg-gray-100">Memuat...</div>;

  // ==========================================
  // HALAMAN LOGIN
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-96 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Akses Dibatasi</h2>
          <p className="text-gray-500 mb-6 text-sm">Masukkan password untuk melihat data keuangan.</p>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="••••••••" className={`w-full border p-3 rounded-lg text-center tracking-widest ${loginError ? 'border-red-500 bg-red-50' : ''}`} required />
            {loginError && <p className="text-red-500 text-sm">Password salah, coba lagi!</p>}
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">BUKA DASHBOARD</button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // DASHBOARD UTAMA
  // ==========================================
  return (
    <div className="flex h-screen bg-gray-50">
      {/* SIDEBAR NAVIGASI */}
      <div className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 flex-1">
          <h1 className="text-2xl font-bold mb-8 tracking-wide">💰 Finance 2026</h1>
          <nav className="flex flex-col gap-2">
            <button onClick={() => setActiveMenu("dashboard")} className={`text-left font-semibold p-3 rounded-lg transition ${activeMenu === "dashboard" ? "bg-blue-600" : "hover:bg-slate-800"}`}>📊 Ringkasan Umum</button>
            <button onClick={() => setActiveMenu("input")} className={`text-left font-semibold p-3 rounded-lg transition ${activeMenu === "input" ? "bg-blue-600" : "hover:bg-slate-800"}`}>📝 Tambah Transaksi</button>
            <button onClick={() => setActiveMenu("analisis")} className={`text-left font-semibold p-3 rounded-lg transition ${activeMenu === "analisis" ? "bg-blue-600" : "hover:bg-slate-800"}`}>📈 Analisis Detail</button>
          </nav>
        </div>
        <div className="p-6 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full text-left font-semibold text-red-400 hover:text-red-300 transition">🚪 Keluar</button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        {fetchError && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded">
            <p className="font-bold">Error Database:</p><p>{fetchError}</p>
          </div>
        )}

        {/* --- MENU 1: RINGKASAN UMUM --- */}
        {activeMenu === "dashboard" && (
          <div>
            <h2 className="text-3xl font-extrabold text-gray-800 mb-6">Ringkasan Keseluruhan</h2>
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-green-500">
                <h3 className="text-gray-500 text-sm font-semibold uppercase">Total Pemasukan</h3>
                <p className="text-3xl font-bold text-gray-800 mt-2">Rp {totalMasuk.toLocaleString("id-ID")}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-red-500">
                <h3 className="text-gray-500 text-sm font-semibold uppercase">Total Pengeluaran</h3>
                <p className="text-3xl font-bold text-gray-800 mt-2">Rp {totalKeluar.toLocaleString("id-ID")}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-blue-500">
                <h3 className="text-gray-500 text-sm font-semibold uppercase">Saldo Tersedia</h3>
                <p className="text-3xl font-bold text-blue-600 mt-2">Rp {saldo.toLocaleString("id-ID")}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Riwayat Transaksi Terakhir</h3>
              {loading ? (
                <p className="text-gray-500">Memuat data...</p>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 text-sm uppercase">
                      <th className="pb-3 font-semibold">Tanggal</th>
                      <th className="pb-3 font-semibold">Kategori</th>
                      <th className="pb-3 font-semibold">Keterangan</th>
                      <th className="pb-3 font-semibold text-right">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transaksi.slice(0, 15).map((t) => (
                      <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50 transition">
                        <td className="py-4 text-gray-600">{t.waktu}</td>
                        <td className="py-4"><span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-semibold">{t.kategori}</span></td>
                        <td className="py-4 text-gray-800">{t.keterangan}</td>
                        <td className={`py-4 text-right font-bold ${t.tipe === "Pemasukan" ? "text-green-500" : "text-gray-800"}`}>
                          {t.tipe === "Pemasukan" ? "+" : "-"} Rp {Number(t.jumlah || 0).toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* --- MENU 2: INPUT TRANSAKSI --- */}
        {activeMenu === "input" && (
            <div className="max-w-2xl bg-white p-8 rounded-xl shadow-sm">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">Catat Transaksi Baru</h2>
                <form onSubmit={handleSimpan} className="flex flex-col gap-5">
                  <div className="flex gap-5">
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-600 mb-2">Tipe Transaksi</label>
                      <select value={tipe} onChange={(e) => setTipe(e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 outline-none">
                        <option>Pengeluaran</option>
                        <option>Pemasukan</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-600 mb-2">Tanggal</label>
                      <input type="date" value={waktu} onChange={(e) => setWaktu(e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 outline-none" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Kategori</label>
                    <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 outline-none">
                      {(tipe === "Pengeluaran" ? kategoriPengeluaran : kategoriPemasukan).map(kat => (
                        <option key={kat}>{kat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Keterangan Singkat</label>
                    <input type="text" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Contoh: Beli Token Listrik" className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 outline-none" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Nominal (Rp)</label>
                    <input type="number" value={jumlah} onChange={(e) => setJumlah(e.target.value)} placeholder="0" className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 outline-none text-xl font-bold" required min="1" />
                  </div>
                  <button type="submit" className="mt-4 bg-slate-900 text-white font-bold py-4 rounded-lg hover:bg-slate-800 transition shadow-lg">
                    SIMPAN TRANSAKSI
                  </button>
                </form>
            </div>
        )}

        {/* --- MENU 3: ANALISIS DETAIL --- */}
        {activeMenu === "analisis" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-extrabold text-gray-800">Analisis Mendalam</h2>
              <div className="flex items-center gap-3">
                <label className="font-semibold text-slate-600">Pilih Bulan:</label>
                <select value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)} className="border-2 border-slate-200 p-2 rounded-lg font-bold bg-white outline-none focus:border-blue-500">
                  <option value="Semua">Semua Waktu</option>
                  {daftarBulan.map((bulan) => (
                    <option key={bulan} value={bulan}>{bulan}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Metrik Utama Filtered */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-green-500">
                <h3 className="text-slate-500 text-xs font-bold uppercase">Pemasukan</h3>
                <p className="text-xl font-bold text-gray-800 mt-1">Rp {sumMasukAnalisis.toLocaleString("id-ID")}</p>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-red-500">
                <h3 className="text-slate-500 text-xs font-bold uppercase">Pengeluaran</h3>
                <p className="text-xl font-bold text-gray-800 mt-1">Rp {sumKeluarAnalisis.toLocaleString("id-ID")}</p>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-orange-500">
                <h3 className="text-slate-500 text-xs font-bold uppercase">Rata-rata Harian</h3>
                <p className="text-xl font-bold text-orange-600 mt-1">Rp {rataHarian > 0 ? Math.round(rataHarian).toLocaleString("id-ID") : "0"} <span className="text-xs text-slate-400">/hari</span></p>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-500">
                <h3 className="text-slate-500 text-xs font-bold uppercase">Sisa / Surplus</h3>
                <p className="text-xl font-bold text-blue-600 mt-1">Rp {(sumMasukAnalisis - sumKeluarAnalisis).toLocaleString("id-ID")}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              {/* Kolom Kiri: Visualisasi Kategori */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-6 border-b pb-2">Distribusi Pengeluaran per Kategori</h3>
                <div className="flex flex-col gap-5">
                  {sortedKategori.length === 0 ? <p className="text-slate-400 italic">Tidak ada pengeluaran</p> : sortedKategori.map(([kat, jum]: any) => {
                    const persentase = ((jum / sumKeluarAnalisis) * 100).toFixed(1);
                    return (
                      <div key={kat}>
                        <div className="flex justify-between text-sm font-semibold mb-1">
                          <span className="text-slate-700">{kat}</span>
                          <span className="text-slate-800">Rp {jum.toLocaleString("id-ID")} ({persentase}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3">
                          <div className="bg-blue-500 h-3 rounded-full" style={{ width: `${persentase}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Kolom Kanan: Top 5 Transaksi */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-6 border-b pb-2">5 Pengeluaran Terbesar</h3>
                {top5Pengeluaran.length === 0 ? <p className="text-slate-400 italic">Tidak ada pengeluaran</p> : (
                  <div className="flex flex-col gap-4">
                    {top5Pengeluaran.map((t, idx) => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex justify-center items-center font-bold text-sm">#{idx + 1}</div>
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{t.keterangan}</p>
                            <p className="text-xs text-slate-500">{t.waktu} • {t.kategori}</p>
                          </div>
                        </div>
                        <p className="font-bold text-red-600">Rp {Number(t.jumlah).toLocaleString("id-ID")}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}