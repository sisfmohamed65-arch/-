// ==========================================
// زهرة حماة - التطبيق الرئيسي
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBbS1MzPjkiLEagg97OTVCBa-yABqKt1Gg",
  authDomain: "zahret-hama.firebaseapp.com",
  projectId: "zahret-hama",
  storageBucket: "zahret-hama.firebasestorage.app",
  messagingSenderId: "525184861733",
  appId: "1:525184861733:web:0f5bb1090a2a29754921cc"
};

const ADMIN_UID = "bw9BjGepH9Z04LZ361DLc02QzEl2";

let firebaseReady = false;
let db = null;
let auth = null;

try {
  if (typeof firebase !== "undefined") {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    firebaseReady = true;
  }
} catch (e) {
  console.error("Firebase init error:", e);
}

// ==========================================
// أدوات عامة
// ==========================================
const $ = id => document.getElementById(id);

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function money(n) {
  return Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 });
}

function showMessage(id, text) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = ""; }, 5000);
}

function setButtonLoading(button, loading, text) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? "جاري التنفيذ..." : text;
}

function isAdmin() {
  return !!(auth && auth.currentUser && auth.currentUser.uid === ADMIN_UID);
}

// ==========================================
// الحالة
// ==========================================
let products = [];
let orders = [];
let settings = { name: "زهرة حماة", whatsapp: "", facebook: "", messenger: "" };
let cart = [];
let activeCategory = "الكل";
let selectedProductImage = "";

try {
  cart = JSON.parse(localStorage.getItem("cart") || "[]");
  if (!Array.isArray(cart)) cart = [];
} catch (e) { cart = []; }

function saveCart() {
  try { localStorage.setItem("cart", JSON.stringify(cart)); } catch (e) {}
}

// ==========================================
// تحميل بيانات المتجر
// ==========================================
async function loadStoreData() {
  if (!firebaseReady) {
    render();
    return false;
  }
  try {
    const pSnap = await db.collection("products").get();
    products = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const sDoc = await db.collection("settings").doc("main").get();
    if (sDoc.exists) settings = { ...settings, ...sDoc.data() };

    if ($("editWhatsapp")) $("editWhatsapp").value = settings.whatsapp || "";
    if ($("editFacebook")) $("editFacebook").value = settings.facebook || "";
    if ($("editMessenger")) $("editMessenger").value = settings.messenger || "";
    if ($("editStoreName")) $("editStoreName").value = settings.name || "";

    render();
    return true;
  } catch (e) {
    console.error("Store loading error:", e);
    if ($("products")) $("products").innerHTML = `<p class="muted">تعذر تحميل المنتجات.</p>`;
    return false;
  }
}

// ==========================================
// عرض المتجر
// ==========================================
function render() {
  const name = settings.name || "زهرة حماة";
  ["storeTitle", "footerName", "footerNameBottom"].forEach(id => {
    if ($(id)) $(id).textContent = name;
  });
  document.title = name + " | المتجر";

  renderCategories();
  renderProducts();
  renderCart();
}

function renderCategories() {
  const box = $("categories");
  if (!box) return;
  const cats = ["الكل", ...new Set(products.map(p => p.category || "أخرى"))];
  box.innerHTML = cats.map(c =>
    `<button type="button" class="chip ${c === activeCategory ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`
  ).join("");
}

function renderProducts() {
  const box = $("products");
  if (!box) return;
  const q = ($("search")?.value || "").trim().toLowerCase();

  const list = products.filter(p =>
    (activeCategory === "الكل" || (p.category || "أخرى") === activeCategory) &&
    String(p.name || "").toLowerCase().includes(q)
  );

  box.innerHTML = list.length
    ? list.map(p => `
      <div class="product">
        ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : `<div class="placeholder">🌿</div>`}
        <h3>${esc(p.name)}</h3>
        <div class="price">${money(p.price)} جنيه</div>
        <button type="button" class="primary" data-add="${esc(p.id)}">أضف للسلة</button>
      </div>`).join("")
    : `<p class="muted">لا توجد منتجات.</p>`;
}

if ($("categories")) {
  $("categories").addEventListener("click", e => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    activeCategory = b.dataset.cat;
    renderCategories();
    renderProducts();
  });
}

if ($("search")) $("search").addEventListener("input", renderProducts);

if ($("products")) {
  $("products").addEventListener("click", e => {
    const b = e.target.closest("[data-add]");
    if (!b) return;
    const p = products.find(x => x.id === b.dataset.add);
    if (!p) return;
    const line = cart.find(i => i.id === p.id);
    if (line) line.quantity += 1;
    else cart.push({ id: p.id, name: p.name, price: Number(p.price) || 0, quantity: 1 });
    saveCart();
    renderCart();
  });
}

// ==========================================
// السلة
// ==========================================
function cartTotal() {
  return cart.reduce((s, i) => s + i.price * i.quantity, 0);
}

function renderCart() {
  if ($("cartCount")) $("cartCount").textContent = cart.reduce((s, i) => s + i.quantity, 0);
  if ($("total")) $("total").textContent = money(cartTotal());
  if (!$("cartItems")) return;

  $("cartItems").innerHTML = cart.length
    ? cart.map(i => `
      <div class="cart-row">
        <div><strong>${esc(i.name)}</strong><div class="muted">${money(i.price)} جنيه</div></div>
        <div class="qty">
          <button type="button" data-qty="1" data-id="${esc(i.id)}">+</button>
          <span>${i.quantity}</span>
          <button type="button" data-qty="-1" data-id="${esc(i.id)}">−</button>
        </div>
      </div>`).join("")
    : `<p class="muted">السلة لسه فاضية.</p>`;
}

if ($("cartItems")) {
  $("cartItems").addEventListener("click", e => {
    const b = e.target.closest("[data-qty]");
    if (!b) return;
    const line = cart.find(i => i.id === b.dataset.id);
    if (!line) return;
    line.quantity += Number(b.dataset.qty);
    if (line.quantity <= 0) cart = cart.filter(i => i !== line);
    saveCart();
    renderCart();
  });
}

if ($("clearCart")) {
  $("clearCart").addEventListener("click", () => {
    cart = [];
    saveCart();
    renderCart();
  });
}

// ==========================================
// النوافذ
// ==========================================
function openModal(id) { $(id)?.classList.remove("hidden"); }
function closeModal(id) { $(id)?.classList.add("hidden"); }

document.addEventListener("click", e => {
  const b = e.target.closest("[data-close]");
  if (b) closeModal(b.dataset.close);
});

// ==========================================
// إتمام الطلب
// ==========================================
if ($("checkout")) {
  $("checkout").addEventListener("click", () => {
    if (!cart.length) { alert("السلة فاضية."); return; }
    openModal("checkoutModal");
  });
}

if ($("sendOrder")) {
  $("sendOrder").addEventListener("click", async () => {
    const name = $("customerName").value.trim();
    const phone = $("customerPhone").value.trim();
    const address = $("customerAddress").value.trim();
    const channel = $("contactChannel").value;

    if (name.length < 2 || phone.length < 8 || address.length < 4) {
      alert("اكتب الاسم ورقم الموبايل والعنوان بشكل صحيح.");
      return;
    }
    if (!cart.length) { alert("السلة فاضية."); return; }
    if (!firebaseReady) { alert("المتجر غير متصل حاليًا."); return; }

    const button = $("sendOrder");
    const normalText = button.textContent;
    setButtonLoading(button, true, normalText);

    const items = cart.map(i => ({ name: i.name, price: i.price, quantity: i.quantity }));
    const total = cartTotal();

    try {
      const ref = await db.collection("orders").add({
        customerName: name,
        phone,
        address,
        channel,
        items,
        total,
        status: "new",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      const text =
        `طلب جديد رقم ${ref.id}\nالاسم: ${name}\nالهاتف: ${phone}\nالعنوان: ${address}\n` +
        items.map(i => `- ${i.name} × ${i.quantity}`).join("\n") +
        `\nالإجمالي: ${money(total)} جنيه`;

      let url = "";
      if (channel === "whatsapp" && settings.whatsapp) {
        url = `https://wa.me/${String(settings.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
      } else if (channel === "messenger" && settings.messenger) {
        url = settings.messenger;
      } else if (channel === "facebook" && settings.facebook) {
        url = settings.facebook;
      }

      cart = [];
      saveCart();
      renderCart();
      closeModal("checkoutModal");

      if (channel !== "whatsapp") {
        try { await navigator.clipboard.writeText(text); } catch (e) {}
        alert("تم حفظ الطلب ونسخ التفاصيل. الصق الرسالة في المحادثة.");
      } else {
        alert("تم إرسال طلبك بنجاح، شكرًا لك 💚");
      }
      if (url) window.open(url, "_blank");

    } catch (e) {
      console.error(e);
      alert("تعذر إرسال الطلب. حاول مرة أخرى.");
    } finally {
      setButtonLoading(button, false, normalText);
    }
  });
}

// ==========================================
// فتح وإغلاق لوحة الإدارة
// ==========================================
function showAdminPane() {
  const logged = isAdmin();
  $("loginPane")?.classList.toggle("hidden", logged);
  $("adminPane")?.classList.toggle("hidden", !logged);
}

function showAdminTab(id) {
  document.querySelectorAll(".admin-tab").forEach(s => {
    s.classList.toggle("hidden", s.id !== id);
  });
  document.querySelectorAll("[data-admin-tab]").forEach(b => {
    b.classList.toggle("active", b.dataset.adminTab === id);
  });
}

if ($("openAdmin")) {
  $("openAdmin").addEventListener("click", () => {
    openModal("adminModal");
    showAdminPane();
    if (isAdmin()) {
      showAdminTab("tabSales");
      loadCloud();
    }
  });
}

if ($("closeAdmin")) {
  $("closeAdmin").addEventListener("click", () => closeModal("adminModal"));
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-admin-tab]");
  if (b) showAdminTab(b.dataset.adminTab);
});

async function closeAdminAndLogout() {
  try {
    if (auth) await auth.signOut();
  } catch (e) {
    console.error(e);
  }
  orders = [];
  closeModal("adminModal");
  showAdminPane();
}

if (firebaseReady) {
  auth.onAuthStateChanged(() => showAdminPane());
}

// ==========================================
// صورة المنتج
// ==========================================
function compressImage(file, maxSize = 700, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleImageFile(file) {
  if (!file) return;
  try {
    selectedProductImage = await compressImage(file);
    if ($("productImagePreview")) {
      $("productImagePreview").src = selectedProductImage;
      $("productImagePreview").classList.remove("hidden");
    }
    $("removeProductImage")?.classList.remove("hidden");
  } catch (e) {
    console.error(e);
    alert("تعذر قراءة الصورة.");
  }
}

$("chooseGallery")?.addEventListener("click", () => $("productImageGallery")?.click());
$("takeProductPhoto")?.addEventListener("click", () => $("productImageCamera")?.click());
$("productImageGallery")?.addEventListener("change", e => handleImageFile(e.target.files[0]));
$("productImageCamera")?.addEventListener("change", e => handleImageFile(e.target.files[0]));

$("removeProductImage")?.addEventListener("click", () => {
  selectedProductImage = "";
  if ($("productImagePreview")) {
    $("productImagePreview").src = "";
    $("productImagePreview").classList.add("hidden");
  }
  $("removeProductImage").classList.add("hidden");
  if ($("productImageGallery")) $("productImageGallery").value = "";
  if ($("productImageCamera")) $("productImageCamera").value = "";
});

// ==========================================
// تسجيل دخول الإدارة
// ==========================================
if ($("adminLogin")) {
  $("adminLogin").addEventListener("click", async () => {
    if (!firebaseReady) {
      showMessage("loginMsg", "تعذر الاتصال بـ Firebase.");
      return;
    }

    const email = $("adminEmail").value.trim();
    const password = $("adminPassword").value;

    if (!email || !password) {
      showMessage("loginMsg", "اكتب البريد وكلمة المرور.");
      return;
    }

    const button = $("adminLogin");
    const normalText = button.textContent;
    setButtonLoading(button, true, normalText);

    try {
      const result = await auth.signInWithEmailAndPassword(email, password);

      if (result.user.uid !== ADMIN_UID) {
        await auth.signOut();
        showMessage("loginMsg", "هذا الحساب غير مصرح له بدخول الإدارة.");
        return;
      }

      $("adminPassword").value = "";
      showAdminPane();
      showAdminTab("tabSales");
      const ok = await loadCloud();
      if (ok) showMessage("adminMsg", "تم تسجيل الدخول بنجاح.");
    } catch (error) {
      console.error("Admin login error:", error);
      showMessage("loginMsg", "تعذر تسجيل الدخول. راجع البريد وكلمة المرور.");
    } finally {
      setButtonLoading(button, false, normalText);
    }
  });
}

// ==========================================
// تحميل بيانات الإدارة
// ==========================================
async function loadCloud() {
  try {
    await loadStoreData();

    const snapshot = await db.collection("orders").get();
    orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    orders.sort((a, b) => getOrderDate(b) - getOrderDate(a));

    renderAdminProducts();
    renderOrders();
    renderStats();
    setupMonthlyReports();
    return true;
  } catch (error) {
    console.error("Admin data loading error:", error);
    showMessage("adminMsg", "تعذر تحميل بيانات الإدارة.");
    return false;
  }
}

function getOrderDate(order) {
  const value = order.createdAt;
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value.seconds) return value.seconds * 1000;
  const date = new Date(value).getTime();
  return Number.isFinite(date) ? date : 0;
}

function getOrderStatus(order) {
  const status = String(order.status || "new").toLowerCase();
  if (status === "completed" || status === "مكتمل") return "completed";
  if (status === "cancelled" || status === "ملغي" || status === "ملغى") return "cancelled";
  return "new";
}

// ==========================================
// إحصائيات الإدارة
// ==========================================
function renderStats() {
  const completed = orders.filter(o => getOrderStatus(o) === "completed");
  const newOrders = orders.filter(o => getOrderStatus(o) === "new");
  const revenue = completed.reduce((s, o) => s + Number(o.total || 0), 0);

  if ($("statOrders")) $("statOrders").textContent = orders.length;
  if ($("statNew")) $("statNew").textContent = newOrders.length;
  if ($("statCompleted")) $("statCompleted").textContent = completed.length;
  if ($("statRevenue")) $("statRevenue").textContent = money(revenue) + " جنيه";
}

// ==========================================
// المنتجات داخل الإدارة
// ==========================================
function renderAdminProducts() {
  if (!$("adminProducts")) return;
  $("adminProducts").innerHTML = products.length
    ? products.map(p => `
      <div class="admin-product">
        <strong>${esc(p.name)}</strong>
        <span>${money(p.price)} جنيه</span>
        <button type="button" class="secondary" data-delete-product="${esc(p.id)}">حذف</button>
      </div>`).join("")
    : `<p class="muted">لا توجد منتجات.</p>`;
}

$("adminProducts")?.addEventListener("click", async event => {
  const button = event.target.closest("[data-delete-product]");
  if (!button || !isAdmin()) return;
  const id = button.dataset.deleteProduct;
  if (!confirm("هل تريد حذف هذا المنتج؟")) return;

  try {
    await db.collection("products").doc(id).delete();
    products = products.filter(p => p.id !== id);
    render();
    renderAdminProducts();
    showMessage("adminMsg", "تم حذف المنتج.");
  } catch (error) {
    console.error(error);
    alert("تعذر حذف المنتج.");
  }
});

$("addProduct")?.addEventListener("click", async () => {
  if (!isAdmin()) return;

  const name = $("newName")?.value.trim() || "";
  const price = Number($("newPrice")?.value);
  const category = $("newCategory")?.value.trim() || "أخرى";

  if (name.length < 2 || !Number.isFinite(price) || price < 0 || $("newPrice").value === "") {
    alert("اكتب اسم المنتج وسعرًا صحيحًا.");
    return;
  }
  if (selectedProductImage.length > 900000) {
    alert("الصورة كبيرة جدًا. اختر صورة أصغر.");
    return;
  }

  const button = $("addProduct");
  const normalText = button.textContent;
  setButtonLoading(button, true, normalText);

  try {
    const productData = {
      name, price, category,
      image: selectedProductImage || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const doc = await db.collection("products").add(productData);
    products.push({ id: doc.id, ...productData });

    $("newName").value = "";
    $("newPrice").value = "";
    $("newCategory").value = "";
    $("removeProductImage")?.click();

    render();
    renderAdminProducts();
    showMessage("adminMsg", "تم إضافة المنتج بنجاح.");
  } catch (error) {
    console.error(error);
    alert("تعذر إضافة المنتج. راجع اتصال Firebase وحجم الصورة.");
  } finally {
    setButtonLoading(button, false, normalText);
  }
});

// ==========================================
// عرض الطلبات
// ==========================================
function renderOrders() {
  if (!$("adminOrders")) return;

  $("adminOrders").innerHTML = orders.length
    ? orders.map(order => {
        const status = getOrderStatus(order);
        const statusText = { new: "جديد", completed: "مكتمل", cancelled: "ملغي" }[status];
        const date = getOrderDate(order)
          ? new Date(getOrderDate(order)).toLocaleString("ar-EG")
          : "غير محدد";
        const items = Array.isArray(order.items)
          ? order.items.map(i => `${esc(i.name)} × ${Number(i.quantity || 1)}`).join("، ")
          : "";

        return `
          <div class="admin-order">
            <h3>طلب رقم ${esc(order.id)}</h3>
            <p>العميل: ${esc(order.customerName)}</p>
            <p>الهاتف: ${esc(order.phone)}</p>
            <p>العنوان: ${esc(order.address)}</p>
            <p>المنتجات: ${items}</p>
            <p>الإجمالي: ${money(order.total)} جنيه</p>
            <p>التاريخ: ${esc(date)}</p>
            <p>الحالة: <strong>${statusText}</strong></p>
            <div class="order-actions">
              ${status !== "completed" ? `<button type="button" class="primary" data-order-status="completed" data-order-id="${esc(order.id)}">إكمال الطلب</button>` : ""}
              ${status !== "cancelled" ? `<button type="button" class="secondary" data-order-status="cancelled" data-order-id="${esc(order.id)}">إلغاء الطلب</button>` : ""}
            </div>
          </div>`;
      }).join("")
    : `<p class="muted">لا توجد طلبات حتى الآن.</p>`;
}

$("adminOrders")?.addEventListener("click", async event => {
  const button = event.target.closest("[data-order-status]");
  if (!button || !isAdmin()) return;

  const id = button.dataset.orderId;
  const status = button.dataset.orderStatus;
  if (!["completed", "cancelled"].includes(status)) return;

  try {
    await db.collection("orders").doc(id).update({ status });
    const order = orders.find(o => o.id === id);
    if (order) order.status = status;

    renderOrders();
    renderStats();
    renderMonthlyReport();
    showMessage("adminMsg", "تم تحديث حالة الطلب.");
  } catch (error) {
    console.error(error);
    alert("تعذر تحديث الطلب. راجع قواعد Firebase.");
  }
});

// ==========================================
// إعدادات التواصل
// ==========================================
$("saveSettings")?.addEventListener("click", async () => {
  if (!isAdmin()) return;
  try {
    const updated = {
      whatsapp: $("editWhatsapp")?.value.trim() || "",
      facebook: $("editFacebook")?.value.trim() || "",
      messenger: $("editMessenger")?.value.trim() || ""
    };
    await db.collection("settings").doc("main").set(updated, { merge: true });
    settings = { ...settings, ...updated };
    showMessage("adminMsg", "تم حفظ وسائل التواصل.");
  } catch (error) {
    console.error(error);
    alert("تعذر حفظ الإعدادات.");
  }
});

$("saveStoreName")?.addEventListener("click", async () => {
  if (!isAdmin()) return;
  const name = $("editStoreName")?.value.trim() || "";
  if (name.length < 2) { alert("اكتب اسمًا صحيحًا للمتجر."); return; }

  try {
    await db.collection("settings").doc("main").set({ name }, { merge: true });
    settings.name = name;
    render();
    showMessage("adminMsg", "تم تغيير اسم المتجر.");
  } catch (error) {
    console.error(error);
    alert("تعذر تغيير اسم المتجر.");
  }
});

$("updateAdminCredentials")?.addEventListener("click", async () => {
  if (!isAdmin()) return;

  const email = $("newAdminEmail")?.value.trim() || "";
  const password = $("newAdminPassword")?.value || "";

  if (!email && !password) {
    alert("اكتب البريد الجديد أو كلمة المرور الجديدة.");
    return;
  }
  if (password && password.length < 6) {
    alert("كلمة المرور يجب ألا تقل عن 6 أحرف.");
    return;
  }

  try {
    if (email) await auth.currentUser.updateEmail(email);
    if (password) await auth.currentUser.updatePassword(password);

    $("newAdminEmail").value = "";
    $("newAdminPassword").value = "";
    showMessage("adminMsg", "تم تحديث بيانات الدخول.");
  } catch (error) {
    console.error(error);
    alert(
      error.code === "auth/requires-recent-login"
        ? "لأسباب أمنية، سجّل الدخول من جديد ثم حاول تحديث البيانات."
        : "تعذر تحديث بيانات الدخول. راجع البيانات وحاول مرة أخرى."
    );
  }
});

// ==========================================
// التقارير الشهرية
// ==========================================
let selectedReportMonth = "";

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
}

function setupMonthlyReports() {
  const select = $("monthlyReportSelect");
  if (!select) return;

  const months = new Set([monthKey(new Date())]);
  orders.forEach(order => {
    const t = getOrderDate(order);
    if (t) months.add(monthKey(new Date(t)));
  });

  const sorted = [...months].sort().reverse();
  if (!selectedReportMonth || !months.has(selectedReportMonth)) selectedReportMonth = sorted[0];

  select.innerHTML = sorted.map(key =>
    `<option value="${key}" ${key === selectedReportMonth ? "selected" : ""}>${esc(monthLabel(key))}</option>`
  ).join("");

  select.onchange = () => {
    selectedReportMonth = select.value;
    renderMonthlyReport();
  };

  if ($("downloadMonthlyExcel")) $("downloadMonthlyExcel").onclick = downloadMonthlyExcel;

  renderMonthlyReport();
}

function getMonthlyOrders() {
  if (!selectedReportMonth) return [];
  return orders.filter(order => {
    const t = getOrderDate(order);
    return t && monthKey(new Date(t)) === selectedReportMonth;
  });
}

function renderMonthlyReport() {
  if (!$("monthlyOrderDetails")) return;

  const monthly = getMonthlyOrders();
  const completed = monthly.filter(o => getOrderStatus(o) === "completed");
  const newOrders = monthly.filter(o => getOrderStatus(o) === "new");
  const cancelled = monthly.filter(o => getOrderStatus(o) === "cancelled");
  const allTotal = monthly.reduce((s, o) => s + Number(o.total || 0), 0);
  const revenue = completed.reduce((s, o) => s + Number(o.total || 0), 0);

  const set = (id, v) => { if ($(id)) $(id).textContent = v; };
  set("monthlyAllTotal", money(allTotal) + " جنيه");
  set("monthlyRevenue", money(revenue) + " جنيه");
  set("monthlyOrderCount", monthly.length);
  set("monthlyCompleted", completed.length);
  set("monthlyNew", newOrders.length);
  set("monthlyCancelled", cancelled.length);

  $("monthlyOrderDetails").innerHTML = monthly.length
    ? monthly.map(order => {
        const date = new Date(getOrderDate(order)).toLocaleString("ar-EG");
        const status = { completed: "مكتمل", new: "جديد", cancelled: "ملغي" }[getOrderStatus(order)];
        return `
          <div class="admin-order">
            <strong>طلب ${esc(order.id)}</strong>
            <p>العميل: ${esc(order.customerName)}</p>
            <p>التاريخ: ${esc(date)}</p>
            <p>الإجمالي: ${money(order.total)} جنيه</p>
            <p>الحالة: ${status}</p>
          </div>`;
      }).join("")
    : `<p class="muted">لا توجد طلبات في هذا الشهر.</p>`;
}

function downloadMonthlyExcel() {
  if (!isAdmin()) return;

  const rows = [["رقم الطلب", "اسم العميل", "رقم الهاتف", "العنوان", "المنتجات", "الإجمالي بالجنيه", "الحالة", "التاريخ"]];

  getMonthlyOrders().forEach(order => {
    const date = getOrderDate(order) ? new Date(getOrderDate(order)).toLocaleString("ar-EG") : "";
    const items = Array.isArray(order.items)
      ? order.items.map(i => `${i.name} × ${i.quantity}`).join(" | ")
      : "";
    const status = { completed: "مكتمل", new: "جديد", cancelled: "ملغي" }[getOrderStatus(order)];
    rows.push([order.id, order.customerName || "", order.phone || "", order.address || "", items, Number(order.total || 0), status, date]);
  });

  const csvEscape = value => {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };

  const csv = "\uFEFF" + rows.map(r => r.map(csvEscape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `تقرير-${selectedReportMonth}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ==========================================
// تسجيل الخروج
// ==========================================
$("logout")?.addEventListener("click", closeAdminAndLogout);

// ==========================================
// تشغيل المتجر
// ==========================================
async function startStore() {
  render();
  if (!firebaseReady) return;
  const success = await loadStoreData();
  if (!success) console.error("تعذر تحميل بيانات المتجر.");
}

startStore();
