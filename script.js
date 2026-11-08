const client = window.supabaseClient;
const MAX_WEIGHT = 160;
const state = { user: null, profile: null, orders: [], filter: "all" };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const page = location.pathname.split("/").pop() || "index.html";
const isLoginPage = page === "index.html" || page === "";
const AUTH_FLAG = "laundryku-authenticated";

function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(value ?? "").replace(/[&<>"']/g, (character) => entities[character]);
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID").format(new Date(`${value}T00:00:00`));
}

function showNotice(message, type = "error") {
  const loginView = $("#login-view");
  const notice = loginView && !loginView.hidden ? $("#app-notice") : $("#dashboard-notice") || $("#app-notice");
  if (!notice) return window.alert(message);
  notice.textContent = message;
  notice.className = `app-notice ${type}`;
  notice.hidden = false;
  notice.removeAttribute("hidden");
}

function clearNotice() {
  const loginView = $("#login-view");
  const notice = loginView && !loginView.hidden ? $("#app-notice") : $("#dashboard-notice") || $("#app-notice");
  if (notice) { notice.hidden = true; notice.textContent = ""; }
}

function setBusy(form, busy, label) {
  const button = $("button[type=submit]", form);
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? "Memproses..." : label;
}

function normalizeOrder(order) {
  return {
    ...order,
    name: order.customer_name,
    date: order.received_date,
    type: order.laundry_type,
    weight: Number(order.weight),
    price: Number(order.price),
    picked: Boolean(order.picked_up),
  };
}

async function loadOrders() {
  const { data, error } = await client
    .from("laundry_orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  state.orders = (data || []).map(normalizeOrder);
}

function renderNavigation() {
  const header = $("#app-header");
  if (!header) return;
  const links = [["index.html", "Dashboard"], ["data-laundry.html", "Data Laundry"], ["laporan.html", "Laporan"]];
  header.innerHTML = `
    <a class="brand" href="index.html" aria-label="LaundryKu Dashboard">
      <span class="brand-mark">LK</span><span class="brand-copy"><strong>LaundryKu</strong><small>Manajemen Laundry</small></span>
    </a>
    <nav class="site-nav" aria-label="Navigasi utama">
      ${links.map(([href, label]) => `<a href="${href}"${page === href ? ' class="active" aria-current="page"' : ""}>${label}</a>`).join("")}
    </nav>
    <button class="logout-button" id="logout-button" type="button">Keluar</button>`;
  $("#logout-button").addEventListener("click", async () => {
    const button = $("#logout-button"); button.disabled = true; button.textContent = "Keluar...";
    sessionStorage.removeItem(AUTH_FLAG);
    await client.auth.signOut(); location.replace("index.html");
  });
}

async function getProfile(user) {
  const { data, error } = await client.from("profiles").select("laundry_name").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return data || { laundry_name: user.user_metadata?.laundry_name || "LaundryKu" };
}

async function startAuthenticatedApp(user) {
  state.user = user;
  state.profile = { laundry_name: user.user_metadata?.laundry_name || "LaundryKu" };
  renderNavigation();
  try { state.profile = await getProfile(user); } catch (error) { console.warn("Profile belum tersedia, menggunakan nama default.", error); }
  await loadOrders();
  if (page === "index.html" || page === "") initDashboard();
  if (page === "data-laundry.html") initWarehouse();
  if (page === "laporan.html") initReport();
}

function loginError(error, register) {
  const message = String(error?.message || "").toLowerCase();
  if (!register && (message.includes("email not confirmed") || message.includes("not confirmed"))) return "Email belum diverifikasi. Buka email konfirmasi dari Supabase terlebih dahulu.";
  if (register && (message.includes("already") || message.includes("registered"))) return "Email tersebut sudah terdaftar. Silakan masuk.";
  if (!register && (message.includes("invalid login") || message.includes("credentials"))) return "Username/email belum terdaftar atau password salah.";
  if (message.includes("email")) return "Format email tidak valid atau email belum dapat digunakan.";
  if (register && message.includes("username")) return "Username sudah digunakan. Pilih username lain.";
  if (register && message.includes("duplicate")) return "Username atau email sudah terdaftar.";
  return register ? "Pendaftaran gagal. Jalankan migrasi database lalu periksa kembali data Anda." : "Login gagal. Periksa username/email dan password Anda.";
}

async function initAuth() {
  const form = $("#auth-form");
  if (!form) return;
  if (!client) { showNotice("Koneksi Supabase belum tersedia. Periksa koneksi internet."); $("#auth-submit").disabled = true; return; }
  let session = null;
  try {
    const result = await client.auth.getSession();
    session = result.data.session;
  } catch (error) {
    return showNotice("Tidak dapat memeriksa sesi login. Periksa koneksi internet lalu coba lagi.");
  }
  if (session) {
    $("#login-view").hidden = true;
    $("#dashboard-view").hidden = false;
    try { await startAuthenticatedApp(session.user); } catch (error) { showNotice("Data belum dapat dimuat. Pastikan schema Supabase sudah dijalankan."); }
    return;
  }
  let register = false;
  const applyAuthMode = () => {
    $("#email-wrap").hidden = !register;
    $("#email-wrap input").required = register;
    $("#confirm-wrap").hidden = !register;
    $("#confirm-wrap input").required = register;
    $("#name-wrap").hidden = false;
    $("#name-wrap").firstChild.textContent = register ? "Username" : "Username / Email";
    $("#name-wrap input").placeholder = register ? "Contoh: laundry-sekolah" : "admin@laundryku.id";
    $("#auth-title").textContent = register ? "Buat akun LaundryKu" : "Masuk ke LaundryKu";
    $("#auth-submit").textContent = register ? "Buat Akun" : "Masuk";
    $("#auth-switch").textContent = register ? "Sudah punya akun? Masuk" : "Belum punya akun? Buat akun";
  };
  applyAuthMode();
  const switchMode = () => {
    register = !register;
    applyAuthMode();
    clearNotice();
  };
  $("#auth-switch").addEventListener("click", switchMode);
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); clearNotice();
    const values = new FormData(form);
    const password = String(values.get("password") || "");
    let email = register ? String(values.get("email") || "").trim() : String(values.get("name") || "").trim();
    const laundryName = String(values.get("name") || "").trim();
    if (register && laundryName.length < 3) return showNotice("Nama laundry minimal 3 karakter.");
    if (!email) return showNotice(register ? "Email wajib diisi." : "Username/email wajib diisi.");
    if (!register && !email.includes("@")) {
      const lookup = await client.rpc("get_login_email", { login_username: email.toLowerCase() });
      if (lookup.error || !lookup.data) return showNotice("Username/email belum terdaftar atau password salah.");
      email = lookup.data;
    }
    if (password.length < 6) return showNotice("Password minimal 6 karakter.");
    if (register && password !== String(values.get("confirm") || "")) return showNotice("Konfirmasi password tidak sama.");
    setBusy(form, true, register ? "Buat Akun" : "Masuk");
    try {
      const result = register
        ? await client.auth.signUp({ email, password, options: { data: { laundry_name: laundryName, username: laundryName.toLowerCase() } } })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) return showNotice(loginError(result.error, register));
      if (register && !result.data.session) return showNotice("Akun berhasil dibuat. Silakan konfirmasi email sebelum masuk.", "success");
      sessionStorage.setItem(AUTH_FLAG, "true");
      document.querySelector("#login-view").hidden = true;
      document.querySelector("#dashboard-view").hidden = false;
      await startAuthenticatedApp(result.data.user);
    } catch (error) { showNotice("Tidak dapat terhubung ke Supabase. Periksa koneksi internet lalu coba lagi."); }
    finally { setBusy(form, false, register ? "Buat Akun" : "Masuk"); }
  });
}

function renderDashboard() {
  const active = state.orders.filter((order) => !order.picked);
  $("#dashboard-name").textContent = state.profile.laundry_name;
  $("#total-orders").textContent = state.orders.length;
  $("#pending-orders").textContent = active.length;
  $("#completed-orders").textContent = state.orders.length - active.length;
  $("#active-orders").innerHTML = active.length ? active.map((order) => `
    <article class="order-item"><div class="order-details"><strong>${escapeHtml(order.name)}</strong><span>${escapeHtml(order.phone)} Â· ${formatDate(order.date)}</span><small>${escapeHtml(order.type)} Â· ${order.weight} kg Â· Rp ${order.price.toLocaleString("id-ID")}</small></div>
    <label class="pickup-toggle"><input type="checkbox" data-order-id="${order.id}"> Selesai</label></article>`).join("") : '<p class="empty-message">Tidak ada laundry dalam proses.</p>';
}

async function updateOrderStatus(event) {
  const id = event.target.dataset.orderId;
  if (!id) return;
  const { error } = await client.from("laundry_orders").update({ picked_up: event.target.checked }).eq("id", id);
  if (error) return showNotice(error.message);
  await loadOrders();
  if (page === "index.html" || page === "") renderDashboard(); else renderWarehouse();
}

function initDashboard() {
  renderDashboard();
  $("#order-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form); const weight = Number(values.get("weight"));
    if (!values.get("customer") || !values.get("phone") || !values.get("date")) return showNotice("Lengkapi data pelanggan terlebih dahulu.");
    if (weight <= 0 || weight > MAX_WEIGHT) return showNotice(`Jumlah laundry harus lebih dari 0 kg dan maksimal ${MAX_WEIGHT} kg.`);
    const button = $("button[type=submit]", form);
    button.disabled = true;
    button.textContent = "Menyimpan...";
    try {
      const { error } = await client.from("laundry_orders").insert({ user_id: state.user.id, customer_name: String(values.get("customer")).trim(), phone: String(values.get("phone")).trim(), received_date: values.get("date"), laundry_type: values.get("type"), weight, price: Number(values.get("price")), picked_up: false });
      if (error) throw error;
      await loadOrders();
      form.reset();
      renderDashboard();
      showNotice("Pendataan berhasil disimpan.", "success");
    } catch (error) {
      showNotice(`Pendataan gagal disimpan: ${error.message || "periksa schema dan policy Supabase."}`);
    } finally {
      button.disabled = false;
      button.textContent = "Simpan Pendataan";
    }
  });
  $("#active-orders").addEventListener("change", updateOrderStatus);
}

function renderWarehouse() {
  const pending = state.orders.filter((order) => !order.picked);
  const query = $("#warehouse-search").value.trim().toLowerCase();
  $("#warehouse-weight").textContent = `${state.orders.reduce((sum, order) => sum + order.weight, 0).toFixed(1)} kg`;
  $("#warehouse-pending").textContent = pending.length; $("#warehouse-completed").textContent = state.orders.length - pending.length;
  const visible = state.orders.filter((order) => (state.filter === "all" || (state.filter === "pending" && !order.picked) || (state.filter === "completed" && order.picked)) && `${order.name} ${order.phone}`.toLowerCase().includes(query));
  $("#warehouse-body").innerHTML = visible.map((order, index) => `<tr><td>${index + 1}</td><td><strong>${escapeHtml(order.name)}</strong></td><td>${escapeHtml(order.phone)}</td><td>${formatDate(order.date)}</td><td>${escapeHtml(order.type)}</td><td>${order.weight}</td><td>${order.price.toLocaleString("id-ID")}</td><td><label class="table-status"><input type="checkbox" data-order-id="${order.id}" ${order.picked ? "checked" : ""}><span class="status-pill ${order.picked ? "done" : ""}">${order.picked ? "Selesai" : "Dalam Proses"}</span></label></td></tr>`).join("");
  $("#warehouse-empty").hidden = visible.length > 0;
}

function initWarehouse() {
  $(".filter-row").addEventListener("click", (event) => { const button = event.target.closest("[data-filter]"); if (!button) return; state.filter = button.dataset.filter; $$(".filter-button").forEach((item) => item.classList.toggle("active", item === button)); renderWarehouse(); });
  $("#warehouse-search").addEventListener("input", renderWarehouse); $("#warehouse-body").addEventListener("change", updateOrderStatus); renderWarehouse();
}

function initReport() {
  const totalWeight = state.orders.reduce((sum, order) => sum + order.weight, 0);
  $("#report-income").textContent = `Rp${state.orders.reduce((sum, order) => sum + order.price, 0).toLocaleString("id-ID")}`;
  $("#report-orders").textContent = state.orders.length; $("#report-students").textContent = new Set(state.orders.map((order) => order.name.toLowerCase())).size; $("#report-weight").textContent = `${totalWeight.toFixed(1)} kg`;
  $("#report-body").innerHTML = state.orders.map((order, index) => `<tr><td>${index + 1}</td><td><strong>${escapeHtml(order.name)}</strong></td><td>${escapeHtml(order.phone)}</td><td>${formatDate(order.date)}</td><td>${escapeHtml(order.type)}</td><td>${order.weight}</td><td>${order.price.toLocaleString("id-ID")}</td><td><span class="status-pill ${order.picked ? "done" : ""}">${order.picked ? "Selesai" : "Belum Selesai"}</span></td></tr>`).join("");
  $("#report-empty").hidden = state.orders.length > 0; $("#report-export").addEventListener("click", exportCsv); $("#report-export-xlsx")?.addEventListener("click", exportXlsx);
}

function exportCsv() {
  if (!state.orders.length) return showNotice("Belum ada data untuk diekspor.");
  const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const rows = state.orders.map((order, index) => [index + 1, order.name, order.phone, formatDate(order.date), order.type, order.weight, order.price, order.picked ? "Selesai" : "Dalam Proses"].map(quote).join(";"));
  const blob = new Blob([`\uFEFFNo.;Nama Siswa;WhatsApp;Tanggal Masuk;Jenis Laundry;Jumlah (kg);Biaya (Rp);Status\r\n${rows.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `data-laundry-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
}

function exportXlsx() {
  if (!state.orders.length) return showNotice("Belum ada data untuk diekspor.");
  if (!window.XLSX) return showNotice("Fitur Excel belum tersedia. Periksa koneksi internet lalu refresh halaman.");
  const rows = state.orders.map((order, index) => ({
    "No.": index + 1, "Nama Siswa": order.name, WhatsApp: order.phone, "Tanggal Masuk": formatDate(order.date),
    "Jenis Laundry": order.type, "Jumlah (kg)": order.weight, "Biaya (Rp)": order.price, Status: order.picked ? "Selesai" : "Dalam Proses",
  }));
  const workbook = window.XLSX.utils.book_new();
  const sheet = window.XLSX.utils.json_to_sheet(rows);
  const range = window.XLSX.utils.decode_range(sheet["!ref"]);
  const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "287A9B" } }, alignment: { horizontal: "center", vertical: "center" }, border: { bottom: { style: "thin", color: { rgb: "1E5D78" } } } };
  for (let column = range.s.c; column <= range.e.c; column += 1) sheet[window.XLSX.utils.encode_cell({ r: 0, c: column })].s = headerStyle;
  for (let row = 1; row <= range.e.r; row += 1) {
    const statusCell = sheet[window.XLSX.utils.encode_cell({ r: row, c: 7 })];
    if (statusCell) statusCell.s = statusCell.v === "Selesai" ? { font: { color: { rgb: "1F6B3A" }, bold: true }, fill: { fgColor: { rgb: "DDF4E5" } } } : { font: { color: { rgb: "9A5A00" }, bold: true }, fill: { fgColor: { rgb: "FFF0CC" } } };
    const priceCell = sheet[window.XLSX.utils.encode_cell({ r: row, c: 6 })];
    if (priceCell) priceCell.z = '"Rp" #,##0';
  }
  sheet["!cols"] = [{ wch: 6 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 18 }];
  sheet["!autofilter"] = { ref: sheet["!ref"] };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  window.XLSX.utils.book_append_sheet(workbook, sheet, "Data Laundry");
  window.XLSX.writeFile(workbook, `data-laundry-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function guardPage() {
  if (!client) return location.replace("index.html");
  if (sessionStorage.getItem(AUTH_FLAG) !== "true") return location.replace("index.html");
  const { data: { session } } = await client.auth.getSession();
  if (!session) { sessionStorage.removeItem(AUTH_FLAG); return location.replace("index.html"); }
  try { await startAuthenticatedApp(session.user); } catch (error) { showNotice("Data belum dapat dimuat. Pastikan schema Supabase sudah dijalankan."); }
}

document.addEventListener("DOMContentLoaded", () => isLoginPage ? initAuth() : guardPage());
window.__laundrykuScriptLoaded = true;

