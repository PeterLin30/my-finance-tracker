"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [transaksi, setTransaksi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [fetchError, setFetchError] = useState("");

  const [waktu, setWaktu] = useState(new Date().toISOString().split("T")[0]);
  const [tipe, setTipe] = useState("Pengeluaran");
  const [kategori, setKategori] = useState("Makanan");
  const [jumlah, setJumlah] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const [filterBulan, setFilterBulan] = useState("Semua");

  // --- CEK SESI LOGIN ---
  useEffect(() => {
    const authStatus = localStorage.getItem("finance_auth");
    if (authStatus === "true") setIsLoggedIn(true);
    setIsCheckingAuth(false);
  }, []);

  // --- MENGAKTIFKAN WEB-SOCKETS REALTIME ---
  useEffect(() => {
    if (!isLoggedIn) return;

    fetchTransaksi();

    const channel = supabase
      .channel('realtime-transaksi')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transaksi' }, 
        (payload) => {
          // Tarik data baru saat ada Insert, Update, atau Delete!
          fetchTransaksi();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn]);

  async function fetchTransaksi() {
    try {
      const { data, error } = await supabase.from("transaksi").select("*").order("waktu", { ascending: false });
      if (error) setFetchError(error.message);
      else setTransaksi(data || []);
    } catch (err: any) {
      setFetchError(err.message || "Terjadi kesalahan sistem");
    } finally {
      setLoading(false); 
    }
  }

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

  async function handleSimpan(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("transaksi").insert([{ waktu, tipe, kategori, jumlah: Number(jumlah), keterangan }]);
    
    if (error) {
      alert("❌ Gagal: " + error.message);
    } else {
      setJumlah("");
      setKeterangan("");
      // Layar tetap di form input agar bisa input data banyak sekaligus
    }
  }

  // --- FUNGSI BARU: HAPUS TRANSAKSI ---
  async function hapusTransaksi(id: string) {
    // Keamanan tambahan: Pastikan user yakin ingin menghapus
    const yakin = window.confirm("Apakah kamu yakin ingin menghapus transaksi ini? Saldo akan dihitung ulang secara otomatis.");
    if (!yakin) return;

    const { error } = await supabase.from("transaksi").delete().eq("id", id);
    
    if (error) {
      alert("❌ Gagal menghapus: " + error.message);
    }
    // Jika sukses, kita tidak perlu memanggil fetchTransaksi() lagi 
    // karena WebSockets Realtime akan otomatis memperbarui datanya!
  }

  // --- LOGIKA KALKULASI ---
  const totalMasuk = transaksi.filter((t) => t.tipe === "Pemasukan").reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0);
  const totalKeluar = transaksi.filter((t) => t.tipe === "Pengeluaran").reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0);
  const saldo = totalMasuk - totalKeluar;

  const daftarBulan = Array.from(new Set(transaksi.map((t) => t.waktu.substring(0, 7)))).sort().reverse();
  const dataAnalisis = filterBulan === "Semua" ? transaksi : transaksi.filter((t) => t.waktu.startsWith(filterBulan));
  const analisisMasuk = dataAnalisis.filter((t) => t.tipe === "Pemasukan");
  const analisisKeluar = dataAnalisis.filter((t) => t.tipe === "Pengeluaran");
  const sumMasukAnalisis = analisisMasuk.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0);
  const sumKeluarAnalisis = analisisKeluar.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0);
  
  const kategoriStats = analisisKeluar.reduce((acc: any, curr) => {
    acc[curr.kategori] = (acc[curr.kategori] || 0) + Number(curr.jumlah);
    return acc;
  }, {});
  const sortedKategori = Object.entries(kategoriStats).sort((a: any, b: any) => b[1] - a[1]);

  let rataHarian = 0;
  if (sumKeluarAnalisis > 0) {
    if (filterBulan !== "Semua") {
      const hariIni = new Date();
      const isBulanIni = filterBulan === `${hariIni.getFullYear()}-${String(hariIni.getMonth() + 1).padStart(2, '0')}`;
      const jumlahHari = isBulanIni ? hariIni.getDate() : new Date(Number(filterBulan.split("-")[0]), Number(filterBulan.split("-")[1]), 0).getDate();
      rataHarian = sumKeluarAnalisis / jumlahHari;
    } else {
      if (analisisKeluar.length > 0) {
        const semuaTanggal = analisisKeluar.map(t => new Date(t.waktu).getTime());
        const tanggalPertama = Math.min(...semuaTanggal);
        const tanggalTerakhir = Math.max(new Date().getTime(), ...semuaTanggal);
        const selisihMilidetik = tanggalTerakhir - tanggalPertama;
        const totalHari = Math.ceil(selisihMilidetik / (1000 * 60 * 60 * 24)) || 1; 
        rataHarian = sumKeluarAnalisis / totalHari;
      }
    }
  }

  const top5Pengeluaran = [...analisisKeluar].sort((a, b) => b.jumlah - a.jumlah).slice(0, 5);

  const kategoriPengeluaran = ["Makanan", "Transportasi", "Hiburan", "Tagihan", "Kesehatan", "Lainnya"];
  const kategoriPemasukan = ["Gaji Pokok", "Bonus/THR", "Hadiah", "Investasi", "Lainnya"];

  if (isCheckingAuth) return <div className="h-screen w-screen flex items-center justify-center bg-gray-100">Memuat...</div>;

  // --- HALAMAN LOGIN ---
  if (!isLoggedIn) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Akses Dibatasi</h2>
          <p className="text-gray-500 mb-6 text-sm">Masukkan password untuk melihat data.</p>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="••••••••" className={`w-full border p-3 rounded-lg text-center tracking-widest ${loginError ? 'border-red-500 bg-red-50' : ''}`} required />
            {loginError && <p className="text-red-500 text-sm">Password salah, coba lagi!</p>}
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">BUKA DASHBOARD</button>
          </form>
        </div>
      </div>
    );
  }

  // --- TAMPILAN DASHBOARD ---
  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 overflow-hidden">
      
      {/* SIDEBAR NAV */}
      <div className="w-full md:w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 shadow-md z-10">
        <div className="p-4 md:p-6 flex flex-row md:flex-col items-center md:items-stretch justify-between gap-4 md:gap-8 overflow-x-auto whitespace-nowrap">
          <h1 className="text-xl md:text-2xl font-bold tracking-wide hidden md:block">💰 Finance 2026</h1>
          <h1 className="text-xl font-bold tracking-wide md:hidden">💰 FinTrack</h1>
          
          <nav className="flex flex-row md:flex-col gap-2 flex-1 md:flex-none overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveMenu("dashboard")} className={`text-sm md:text-base font-semibold px-4 py-2 md:p-3 rounded-lg transition ${activeMenu === "dashboard" ? "bg-blue-600" : "hover:bg-slate-800"}`}>📊 Ringkasan</button>
            <button onClick={() => setActiveMenu("input")} className={`text-sm md:text-base font-semibold px-4 py-2 md:p-3 rounded-lg transition ${activeMenu === "input" ? "bg-blue-600" : "hover:bg-slate-800"}`}>📝 Tambah</button>
            <button onClick={() => setActiveMenu("analisis")} className={`text-sm md:text-base font-semibold px-4 py-2 md:p-3 rounded-lg transition ${activeMenu === "analisis" ? "bg-blue-600" : "hover:bg-slate-800"}`}>📈 Analisis</button>
          </nav>
          
          <button onClick={handleLogout} className="text-sm md:text-base font-semibold px-4 py-2 md:p-3 text-red-400 hover:text-red-300 md:mt-auto border md:border-t md:border-0 border-red-500/30 rounded-lg md:rounded-none">Keluar</button>
        </div>
      </div>

      {/* KONTEN UTAMA */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
        {fetchError && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded text-sm md:text-base">
            <p className="font-bold">Error Database:</p><p>{fetchError}</p>
          </div>
        )}

        {/* MENU 1: RINGKASAN */}
        {activeMenu === "dashboard" && (
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800 mb-6">Ringkasan Keseluruhan</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
              <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border-l-4 md:border-l-0 md:border-b-4 border-green-500">
                <h3 className="text-gray-500 text-xs md:text-sm font-semibold uppercase">Pemasukan</h3>
                <p className="text-2xl md:text-3xl font-bold text-gray-800 mt-1 md:mt-2">Rp {totalMasuk.toLocaleString("id-ID")}</p>
              </div>
              <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border-l-4 md:border-l-0 md:border-b-4 border-red-500">
                <h3 className="text-gray-500 text-xs md:text-sm font-semibold uppercase">Pengeluaran</h3>
                <p className="text-2xl md:text-3xl font-bold text-gray-800 mt-1 md:mt-2">Rp {totalKeluar.toLocaleString("id-ID")}</p>
              </div>
              <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border-l-4 md:border-l-0 md:border-b-4 border-blue-500">
                <h3 className="text-gray-500 text-xs md:text-sm font-semibold uppercase">Saldo Tersedia</h3>
                <p className="text-2xl md:text-3xl font-bold text-blue-600 mt-1 md:mt-2">Rp {saldo.toLocaleString("id-ID")}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 overflow-hidden">
              <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4 border-b pb-2">Riwayat Terakhir</h3>
              {loading && transaksi.length === 0 ? <p className="text-gray-500 text-sm">Memuat data...</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[500px]">
                    <thead>
                      <tr className="text-slate-400 text-xs md:text-sm uppercase">
                        <th className="pb-3 font-semibold">Tanggal</th>
                        <th className="pb-3 font-semibold">Kategori</th>
                        <th className="pb-3 font-semibold">Keterangan</th>
                        <th className="pb-3 font-semibold text-right">Jumlah</th>
                        <th className="pb-3 font-semibold text-center w-12">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm md:text-base">
                      {transaksi.slice(0, 15).map((t) => (
                        <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50 transition">
                          <td className="py-3 md:py-4 text-gray-600">{t.waktu}</td>
                          <td className="py-3 md:py-4"><span className="bg-slate-100 text-slate-600 px-2 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-semibold">{t.kategori}</span></td>
                          <td className="py-3 md:py-4 text-gray-800">{t.keterangan}</td>
                          <td className={`py-3 md:py-4 text-right font-bold ${t.tipe === "Pemasukan" ? "text-green-500" : "text-gray-800"}`}>
                            {t.tipe === "Pemasukan" ? "+" : "-"} Rp {Number(t.jumlah || 0).toLocaleString("id-ID")}
                          </td>
                          <td className="py-3 md:py-4 text-center">
                            <button 
                              onClick={() => hapusTransaksi(t.id)} 
                              className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-2 py-1 rounded text-xs font-bold transition"
                              title="Hapus Transaksi"
                            >
                              X
                            </button>
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

        {/* MENU 2: INPUT TRANSAKSI */}
        {activeMenu === "input" && (
            <div className="w-full max-w-2xl bg-white p-5 md:p-8 rounded-xl shadow-sm mx-auto">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6 border-b pb-4">Catat Transaksi</h2>
                <form onSubmit={handleSimpan} className="flex flex-col gap-4 md:gap-5">
                  <div className="flex flex-col md:flex-row gap-4 md:gap-5">
                    <div className="flex-1">
                      <label className="block text-xs md:text-sm font-bold text-slate-600 mb-1 md:mb-2">Tipe</label>
                      <select value={tipe} onChange={(e) => setTipe(e.target.value)} className="w-full border-2 border-slate-200 p-2 md:p-3 rounded-lg focus:border-blue-500 outline-none">
                        <option>Pengeluaran</option><option>Pemasukan</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs md:text-sm font-bold text-slate-600 mb-1 md:mb-2">Tanggal</label>
                      <input type="date" value={waktu} onChange={(e) => setWaktu(e.target.value)} className="w-full border-2 border-slate-200 p-2 md:p-3 rounded-lg focus:border-blue-500 outline-none" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-600 mb-1 md:mb-2">Kategori</label>
                    <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="w-full border-2 border-slate-200 p-2 md:p-3 rounded-lg focus:border-blue-500 outline-none">
                      {(tipe === "Pengeluaran" ? kategoriPengeluaran : kategoriPemasukan).map(kat => <option key={kat}>{kat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-600 mb-1 md:mb-2">Keterangan Singkat</label>
                    <input type="text" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Contoh: Nasi Padang" className="w-full border-2 border-slate-200 p-2 md:p-3 rounded-lg focus:border-blue-500 outline-none" required />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-600 mb-1 md:mb-2">Nominal (Rp)</label>
                    <input type="number" value={jumlah} onChange={(e) => setJumlah(e.target.value)} placeholder="0" className="w-full border-2 border-slate-200 p-2 md:p-3 rounded-lg focus:border-blue-500 outline-none text-lg md:text-xl font-bold" required min="1" />
                  </div>
                  <button type="submit" className="mt-2 md:mt-4 bg-slate-900 text-white font-bold py-3 md:py-4 rounded-lg hover:bg-slate-800 transition shadow-lg text-sm md:text-base">SIMPAN</button>
                </form>
            </div>
        )}

        {/* MENU 3: ANALISIS DETAIL */}
        {activeMenu === "analisis" && (
          <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">Analisis</h2>
              <div className="flex items-center gap-2 md:gap-3">
                <label className="text-sm md:text-base font-semibold text-slate-600">Bulan:</label>
                <select value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)} className="border-2 border-slate-200 p-1 md:p-2 rounded-lg font-bold bg-white text-sm md:text-base outline-none focus:border-blue-500 flex-1 md:flex-none">
                  <option value="Semua">Semua Waktu</option>
                  {daftarBulan.map((bulan) => <option key={bulan} value={bulan}>{bulan}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
              <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border-l-4 border-green-500">
                <h3 className="text-slate-500 text-[10px] md:text-xs font-bold uppercase">Pemasukan</h3>
                <p className="text-sm md:text-xl font-bold text-gray-800 mt-1">Rp {sumMasukAnalisis.toLocaleString("id-ID")}</p>
              </div>
              <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border-l-4 border-red-500">
                <h3 className="text-slate-500 text-[10px] md:text-xs font-bold uppercase">Pengeluaran</h3>
                <p className="text-sm md:text-xl font-bold text-gray-800 mt-1">Rp {sumKeluarAnalisis.toLocaleString("id-ID")}</p>
              </div>
              <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border-l-4 border-orange-500">
                <h3 className="text-slate-500 text-[10px] md:text-xs font-bold uppercase">Rata Harian</h3>
                <p className="text-sm md:text-xl font-bold text-orange-600 mt-1">Rp {rataHarian > 0 ? Math.round(rataHarian).toLocaleString("id-ID") : "0"}</p>
              </div>
              <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border-l-4 border-blue-500">
                <h3 className="text-slate-500 text-[10px] md:text-xs font-bold uppercase">Surplus</h3>
                <p className="text-sm md:text-xl font-bold text-blue-600 mt-1">Rp {(sumMasukAnalisis - sumKeluarAnalisis).toLocaleString("id-ID")}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
                <h3 className="text-base md:text-lg font-bold text-gray-800 mb-4 md:mb-6 border-b pb-2">Distribusi Kategori</h3>
                <div className="flex flex-col gap-4 md:gap-5">
                  {sortedKategori.length === 0 ? <p className="text-slate-400 italic text-sm">Kosong</p> : sortedKategori.map(([kat, jum]: any) => {
                    const persentase = ((jum / sumKeluarAnalisis) * 100).toFixed(1);
                    return (
                      <div key={kat}>
                        <div className="flex justify-between text-xs md:text-sm font-semibold mb-1">
                          <span className="text-slate-700">{kat}</span>
                          <span className="text-slate-800">Rp {jum.toLocaleString("id-ID")}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 md:h-3">
                          <div className="bg-blue-500 h-2 md:h-3 rounded-full" style={{ width: `${persentase}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
                <h3 className="text-base md:text-lg font-bold text-gray-800 mb-4 md:mb-6 border-b pb-2">5 Pengeluaran Terbesar</h3>
                {top5Pengeluaran.length === 0 ? <p className="text-slate-400 italic text-sm">Kosong</p> : (
                  <div className="flex flex-col gap-3 md:gap-4">
                    {top5Pengeluaran.map((t, idx) => (
                      <div key={t.id} className="flex items-center justify-between p-2 md:p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                          <div className="w-6 h-6 md:w-8 md:h-8 shrink-0 rounded-full bg-red-100 text-red-600 flex justify-center items-center font-bold text-xs md:text-sm">#{idx + 1}</div>
                          <div className="truncate">
                            <p className="font-bold text-gray-800 text-xs md:text-sm truncate">{t.keterangan}</p>
                            <p className="text-[10px] md:text-xs text-slate-500">{t.waktu}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <p className="font-bold text-red-600 text-xs md:text-sm whitespace-nowrap">Rp {Number(t.jumlah).toLocaleString("id-ID")}</p>
                          <button 
                            onClick={() => hapusTransaksi(t.id)} 
                            className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-2 py-1 rounded text-[10px] md:text-xs font-bold transition"
                            title="Hapus"
                          >
                            X
                          </button>
                        </div>
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