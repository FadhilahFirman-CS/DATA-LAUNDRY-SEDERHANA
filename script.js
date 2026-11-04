const KEYS = { account: "laundryku-account", orders: "laundryku-orders" };
const MAX_WEIGHT = 160;
const $ = (selector) => document.querySelector(selector);
const page = location.pathname.split("/").pop() || "index.html";

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function normalizeOrder(order, index) {
  return {
    ...order,
    id: order.id ?? index,
    name: order.name ?? order.customerName ?? order.customer_name ?? "Tanpa Nama",
    phone: order.phone ?? "-",
    date: order.date ?? order.receivedDay ?? order.received_at ?? "-",
    type: order.type ?? order.laundryType ?? order.laundry_type ?? "Lainnya",
    weight: Number(order.weight ?? 0),
    price: Number(order.price ?? 0),
    picked: Boolean(order.picked ?? order.pickedUp ?? order.picked_up),
  };
}

function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(value).replace(/[&<>"']/g, (character) => entities[character]);
}

function formatDate(value) {
  if (!value || value === "-") return "-";
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

let account = readJson(KEYS.account, null);
const storedOrders = readJson(KEYS.orders, []);
let orders = (Array.isArray(storedOrders) ? storedOrders : []).map(normalizeOrder);
let warehouseFilter = "all";
let appInitialized = false;

function saveOrders() {
  localStorage.setItem(KEYS.orders, JSON.stringify(orders));
}

function setupAuth() {
  const loginView = $("#login-view");
  const dashboardView = $("#dashboard-view");
  if (!loginView || !dashboardView) return;

  if (account) {
    loginView.hidden = true;
    dashboardView.hidden = false;
    initializeApp();
    return;
  }

  loginView.hidden = false;
  dashboardView.hidden = true;
  let registerMode = false;
  const form = $("#auth-form");

  $("#auth-switch").addEventListener("click", () => {
    registerMode = !registerMode;
    $("#auth-eyebrow").textContent = registerMode ? "PENDAFTARAN DATLANDIG" : "DATA LAUNDRY DIGITAL";
    $("#auth-title").textContent = registerMode ? "Buat akun DatLanDig" : "Masuk ke DatLanDig";
    $("#auth-description").textContent = registerMode ? "Daftarkan akun untuk mulai mencatat laundry siswa." : "Kelola data laundry siswa dengan mudah.";
    $("#confirm-wrap").hidden = !registerMode;
    form.elements.confirm.required = registerMode;
    $("#auth-submit").textContent = registerMode ? "Buat Akun" : "Masuk";
    $("#auth-switch").textContent = registerMode ? "Sudah punya akun? Masuk" : "Belum punya akun? Buat akun";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = formData.get("name").trim();
    const password = formData.get("password");

    if (name.length < 3 || password.length < 6) {
      alert("Nama laundry minimal 3 karakter dan password minimal 6 karakter.");
      return;
    }

    if (registerMode) {
      if (password !== formData.get("confirm")) {
        alert("Konfirmasi password tidak sama.");
        return;
      }
      const existing = readJson(KEYS.account, null);
      if (existing?.name?.toLowerCase() === name.toLowerCase()) {
        alert("Nama laundry sudah terdaftar.");
        return;
      }
      account = { name, password };
      localStorage.setItem(KEYS.account, JSON.stringify(account));
      loginView.hidden = true;
      dashboardView.hidden = false;
      initializeApp();
      return;
    }

    const saved = readJson(KEYS.account, null);
    if (!saved || saved.name.toLowerCase() !== name.toLowerCase() || saved.password !== password) {
      alert("Nama laundry atau password salah.");
      return;
    }
    account = saved;
    loginView.hidden = true;
    dashboardView.hidden = false;
    initializeApp();
  });
}

function renderNavigation() {
  const header = $("#app-header");
  if (!header || !account) return;
  const links = [
    ["index.html", "Dashboard"],
    ["data-laundry.html", "Data Laundry"],
    ["laporan.html", "Laporan"],
  ];

  header.innerHTML = `
    <a class="brand" href="index.html" aria-label="DatLanDig, Dashboard">
      <span class="brand-mark">LK</span>
      <span class="brand-copy"><strong>DatLanDig</strong><small>Data Laundry Digital</small></span>
    </a>
    <nav class="site-nav" aria-label="Navigasi utama">
      ${links.map(([href, label]) => `<a href="${href}"${page === href ? ' class="active" aria-current="page"' : ""}>${label}</a>`).join("")}
    </nav>
    <button class="logout-button" id="logout-button" type="button">Keluar</button>`;

  $("#logout-button").addEventListener("click", () => {
    localStorage.removeItem(KEYS.account);
    account = null;
    if (page === "index.html") {
      $("#dashboard-view").hidden = true;
      $("#login-view").hidden = false;
    } else {
      location.href = "index.html";
    }
  });
}

function initializeApp() {
  renderNavigation();
  if (appInitialized) {
    if ($("#dashboard-view")) {
      $("#dashboard-name").textContent = account.name;
      renderDashboardOrders();
    }
    return;
  }
  appInitialized = true;
  if ($("#dashboard-view")) initializeDashboard();
  if (page === "data-laundry.html") initializeWarehouse();
  if (page === "laporan.html") initializeReport();
}

function initializeDashboard() {
  $("#dashboard-name").textContent = account.name;
  $("#order-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const weight = Number(formData.get("weight"));
    if (weight <= 0 || weight > MAX_WEIGHT) {
      alert(`Jumlah laundry harus lebih dari 0 kg dan tidak boleh melebihi ${MAX_WEIGHT} kg.`);
      return;
    }
    orders.unshift({
      id: Date.now(),
      name: formData.get("customer").trim(),
      phone: formData.get("phone").trim(),
      date: formData.get("date"),
      type: formData.get("type"),
      weight,
      price: Number(formData.get("price")),
      picked: false,
    });
    saveOrders();
    event.currentTarget.reset();
    renderDashboardOrders();
  });

  $("#active-orders").addEventListener("change", (event) => {
    const order = orders.find((item) => String(item.id) === event.target.dataset.id);
    if (!order) return;
    order.picked = event.target.checked;
    saveOrders();
    renderDashboardOrders();
  });

  $("#export-button").addEventListener("click", exportCsv);
  renderDashboardOrders();
}

function renderDashboardOrders() {
  const active = orders.filter((order) => !order.picked);
  $("#total-orders").textContent = orders.length;
  $("#pending-orders").textContent = active.length;
  $("#completed-orders").textContent = orders.length - active.length;
  $("#active-orders").innerHTML = active.length
    ? active.map((order) => `
        <article class="order-item">
          <div class="order-details">
            <strong>${escapeHtml(order.name)}</strong>
            <span>${escapeHtml(order.phone)} · ${formatDate(order.date)}</span>
            <small>${escapeHtml(order.type)} · ${order.weight} kg · Rp ${order.price.toLocaleString("id-ID")}</small>
          </div>
          <label class="pickup-toggle"><input type="checkbox" data-id="${escapeHtml(order.id)}" /> Selesai</label>
        </article>`).join("")
    : '<p class="empty-message">Tidak ada laundry dalam proses.</p>';
}

function initializeWarehouse() {
  const search = $("#warehouse-search");
  const body = $("#warehouse-body");
  $(".filter-row").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    warehouseFilter = button.dataset.filter;
    document.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("active", item === button));
    renderWarehouse();
  });
  search.addEventListener("input", renderWarehouse);
  body.addEventListener("change", (event) => {
    const order = orders.find((item) => String(item.id) === event.target.dataset.id);
    if (!order) return;
    order.picked = event.target.checked;
    saveOrders();
    renderWarehouse();
  });
  renderWarehouse();
}

function renderWarehouse() {
  const totalWeight = orders.reduce((sum, order) => sum + order.weight, 0);
  const pendingCount = orders.filter((order) => !order.picked).length;
  $("#warehouse-weight").textContent = `${totalWeight.toFixed(1)} kg`;
  $("#warehouse-pending").textContent = pendingCount;
  $("#warehouse-completed").textContent = orders.length - pendingCount;

  const query = $("#warehouse-search").value.trim().toLowerCase();
  const visible = orders.filter((order) => {
    const matchesFilter = warehouseFilter === "all"
      || (warehouseFilter === "pending" && !order.picked)
      || (warehouseFilter === "completed" && order.picked);
    return matchesFilter && `${order.name} ${order.phone}`.toLowerCase().includes(query);
  });

  $("#warehouse-body").innerHTML = visible.map((order, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(order.name)}</strong></td>
      <td>${escapeHtml(order.phone)}</td>
      <td>${formatDate(order.date)}</td>
      <td>${escapeHtml(order.type)}</td>
      <td>${order.weight}</td>
      <td>${order.price.toLocaleString("id-ID")}</td>
      <td><label class="table-status"><input type="checkbox" data-id="${escapeHtml(order.id)}" ${order.picked ? "checked" : ""}><span class="status-pill ${order.picked ? "done" : ""}">${order.picked ? "Selesai" : "Dalam Proses"}</span></label></td>
    </tr>`).join("");
  $("#warehouse-empty").hidden = visible.length > 0;
}

function initializeReport() {
  const totalWeight = orders.reduce((sum, order) => sum + order.weight, 0);
  const totalIncome = orders.reduce((sum, order) => sum + order.price, 0);
  const students = new Set(orders.map((order) => order.name.trim().toLowerCase()));
  $("#report-income").textContent = `Rp${totalIncome.toLocaleString("id-ID")}`;
  $("#report-orders").textContent = orders.length;
  $("#report-students").textContent = students.size;
  $("#report-weight").textContent = `${totalWeight.toFixed(1)} kg`;
  $("#report-body").innerHTML = orders.map((order, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(order.name)}</strong></td>
      <td>${escapeHtml(order.phone)}</td>
      <td>${formatDate(order.date)}</td>
      <td>${escapeHtml(order.type)}</td>
      <td>${order.weight}</td>
      <td>${order.price.toLocaleString("id-ID")}</td>
      <td><span class="status-pill ${order.picked ? "done" : ""}">${order.picked ? "Selesai" : "Belum Selesai"}</span></td>
    </tr>`).join("");
  $("#report-empty").hidden = orders.length > 0;
  $("#report-export").addEventListener("click", exportCsv);
}

function exportCsv() {
  if (!orders.length) {
    alert("Belum ada data untuk diekspor.");
    return;
  }
  const columns = ["No.", "Nama Siswa", "WhatsApp", "Tanggal Masuk", "Jenis Laundry", "Jumlah (kg)", "Biaya (Rp)", "Status"];
  const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const rows = orders.map((order, index) => [
    index + 1, order.name, order.phone, formatDate(order.date), order.type, order.weight,
    order.price, order.picked ? "Selesai" : "Dalam Proses",
  ].map(quote).join(";"));
  const file = new Blob([`\uFEFF${columns.join(";")}\r\n${rows.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `data-laundry-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

if (page === "index.html") setupAuth();
else if (!account) location.replace("index.html");
else initializeApp();
