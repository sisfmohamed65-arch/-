// زهرة حماة - التطبيق الرئيسي
// Firebase + المتجر + الإدارة + التقارير + WhatsApp

const firebaseConfig = {
  apiKey: "AIzaSyBbS1MzPjkiLEagg97OTVCBa-yABqKt1Gg",
  authDomain: "zahret-hama.firebaseapp.com",
  projectId: "zahret-hama",
  storageBucket: "zahret-hama.firebasestorage.app",
  messagingSenderId: "525184861733",
  appId: "1:525184861733:web:0f5bb1090a2a29754921cc"
};

const ADMIN_UID = "bw9BjGepH9Z04LZ361DLc02QzEl2";

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let adminSessionActive = false;
let products = [];
let orders = [];
let settings = {};
let cart = [];
let selectedImage = "";
let activeCategory = "الكل";
let currentAdminTab = "tabSales";

const $ = id => document.getElementById(id);

try {
  cart = JSON.parse(localStorage.getItem("zahretHamaCart") || "[]");
  if (!Array.isArray(cart)) cart = [];
} catch {
  cart = [];
}

function money(value) {
  return (Number(value) || 0).toLocaleString("ar-EG");
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

function showMessage(id, message, type = "info") {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
  el.style.color = type === "error" ? "#b42318" :
    type === "success" ? "#16803c" : "";
}

function setLoading(button, loading, text) {
  if (!button) return;
  if (loading) {
    if (!button.dataset.originalText)
      button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = text || "جاري التنفيذ...";
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || "حفظ";
    delete button.dataset.originalText;
  }
}

function isAdmin() {
  return !!(adminSessionActive && auth.currentUser &&
    auth.currentUser.uid === ADMIN_UID);
}

function closeModal(id) {
  $(id)?.classList.add("hidden");
}

function openModal(id) {
  $(id)?.classList.remove("hidden");
}

function saveCart() {
  localStorage.setItem("zahretHamaCart", JSON.stringify(cart));
  renderCart();
}

function dateFromOrder(order) {
  const v = order.createdAt;
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function orderStatus(order) {
  return String(order.status || "جديد");
}

function isCompleted(order) {
  return ["مكتمل", "مكتملة", "تم التسليم", "completed"]
    .includes(orderStatus(order).toLowerCase());
}

function isCancelled(order) {
  return ["ملغي", "ملغى", "ملغاة", "cancelled"]
    .includes(orderStatus(order).toLowerCase());
}

function formatDate(order) {
  const d = dateFromOrder(order);
  return d ? d.toLocaleString("ar-EG") : "غير محدد";
}

// الإعدادات واسم المتجر
function applyStoreName(name) {
  name = String(name || "زهرة حماة").trim();
  ["storeTitle", "footerName", "footerNameBottom"].forEach(id => {
    if ($(id)) $(id).textContent = name;
  });
  const heading = document.querySelector("#adminModal h2");
  if (heading) heading.textContent = "لوحة إدارة " + name;
  document.title = name + " | المتجر";
  const hero = document.querySelector(".hero h1");
  if (hero) hero.textContent = "أهلاً بيكم في " + name + " 🌿";
}

async function loadSettings() {
  try {
    const doc = await db.collection("settings").doc("main").get();
    settings = doc.exists ? doc.data() : {};
    applyStoreName(settings.storeName);

    if ($("editStoreName"))
      $("editStoreName").value = settings.storeName || "زهرة حماة";
    if ($("editWhatsapp"))
      $("editWhatsapp").value = settings.whatsapp || "";
    if ($("editFacebook"))
      $("editFacebook").value = settings.facebook || "";
    if ($("editMessenger"))
      $("editMessenger").value = settings.messenger || "";
  } catch (e) {
    console.error("Settings:", e);
    showMessage("adminMsg", "تعذر تحميل الإعدادات.", "error");
  }
}

$("saveStoreName")?.addEventListener("click", async function () {
  if (!isAdmin()) return showMessage("adminMsg", "سجل الدخول أولاً.", "error");
  const name = $("editStoreName")?.value.trim();
  if (!name) return showMessage("adminMsg", "اكتب اسم المتجر.", "error");

  setLoading(this, true, "جاري الحفظ...");
  try {
    await db.collection("settings").doc("main").set({
      storeName: name,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    settings.storeName = name;
    applyStoreName(name);
    showMessage("adminMsg", "تم حفظ اسم المتجر.", "success");
  } catch (e) {
    console.error(e);
    showMessage("adminMsg", "تعذر حفظ اسم المتجر.", "error");
  } finally {
    setLoading(this, false);
  }
});

$("saveSettings")?.addEventListener("click", async function () {
  if (!isAdmin()) return showMessage("adminMsg", "غير مصرح لك.", "error");

  const data = {
    whatsapp: $("editWhatsapp")?.value.trim() || "",
    facebook: $("editFacebook")?.value.trim() || "",
    messenger: $("editMessenger")?.value.trim() || "",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  setLoading(this, true, "جاري الحفظ...");
  try {
    await db.collection("settings").doc("main").set(data, { merge: true });
    settings = { ...settings, ...data };
    showMessage("adminMsg", "تم حفظ وسائل التواصل.", "success");
  } catch (e) {
    console.error(e);
    showMessage("adminMsg", "تعذر حفظ وسائل التواصل.", "error");
  } finally {
    setLoading(this, false);
  }
});

// التنقل بين أقسام الإدارة
function showAdminTab(tabId) {
  if (!$(tabId)) return;
  currentAdminTab = tabId;

  document.querySelectorAll(".admin-tab").forEach(tab =>
    tab.classList.add("hidden")
  );
  $(tabId).classList.remove("hidden");

  document.querySelectorAll("[data-admin-tab]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.adminTab === tabId)
  );

  if (tabId === "tabSales") renderSalesStats();
  if (tabId === "tabProducts") renderAdminProducts();
  if (tabId === "tabOrders") renderAdminOrders();
  if (tabId === "tabReports") renderMonthlyReport();
}

document.querySelectorAll("[data-admin-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!isAdmin()) return showMessage("adminMsg", "سجل الدخول أولاً.", "error");
    showAdminTab(btn.dataset.adminTab);
  });
});

// تسجيل الدخول
async function openAdminLogin() {
  openModal("adminModal");
  if (isAdmin()) {
    $("loginPane")?.classList.add("hidden");
    $("adminPane")?.classList.remove("hidden");
    showAdminTab(currentAdminTab);
  } else {
    $("loginPane")?.classList.remove("hidden");
    $("adminPane")?.classList.add("hidden");
  }
}

$("openAdmin")?.addEventListener("click", openAdminLogin);
$("closeAdmin")?.addEventListener("click", () => closeModal("adminModal"));

$("adminLogin")?.addEventListener("click", async function () {
  const email = $("adminEmail")?.value.trim();
  const password = $("adminPassword")?.value;

  if (!email || !password)
    return showMessage("loginMsg", "اكتب البريد وكلمة المرور.", "error");

  setLoading(this, true, "جاري تسجيل الدخول...");
  try {
    const result = await auth.signInWithEmailAndPassword(email, password);

    if (result.user.uid !== ADMIN_UID) {
      await auth.signOut();
      adminSessionActive = false;
      return showMessage("loginMsg", "هذا الحساب غير مصرح له.", "error");
    }

    adminSessionActive = true;
    $("adminEmail").value = "";
    $("adminPassword").value = "";
    $("loginPane")?.classList.add("hidden");
    $("adminPane")?.classList.remove("hidden");

    await loadCloud();
    showAdminTab("tabSales");
    showMessage("adminMsg", "تم تسجيل الدخول بنجاح.", "success");
  } catch (e) {
    console.error(e);
    showMessage("loginMsg", "تعذر تسجيل الدخول. راجع البيانات.", "error");
  } finally {
    setLoading(this, false);
  }
});

$("logout")?.addEventListener("click", async () => {
  adminSessionActive = false;
  await auth.signOut();
  $("adminPane")?.classList.add("hidden");
  $("loginPane")?.classList.remove("hidden");
  closeModal("adminModal");
});

// تحديث بيانات الدخول
$("updateAdminCredentials")?.addEventListener("click", async function () {
  if (!isAdmin())
    return showMessage("adminMsg", "سجل الدخول أولاً.", "error");

  const newEmail = $("newAdminEmail")?.value.trim() || "";
  const newPassword = $("newAdminPassword")?.value || "";

  if (!newEmail && !newPassword)
    return showMessage("adminMsg", "اكتب البريد أو كلمة المرور الجديدة.", "error");

  if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail))
    return showMessage("adminMsg", "البريد غير صحيح.", "error");

  if (newPassword && newPassword.length < 6)
    return showMessage("adminMsg", "كلمة المرور قصيرة جداً.", "error");

  const user = auth.currentUser;
  const currentPassword = prompt("اكتب كلمة مرور الإدارة الحالية للتأكيد:");
  if (!currentPassword) return;

  setLoading(this, true, "جاري التحديث...");
  let emailUpdated = false;
  let passwordUpdated = false;

  try {
    const credential = firebase.auth.EmailAuthProvider.credential(
      user.email, currentPassword
    );
    await user.reauthenticateWithCredential(credential);

    if (newEmail && newEmail !== user.email) {
      await user.updateEmail(newEmail);
      emailUpdated = true;
    }
    if (newPassword) {
      await user.updatePassword(newPassword);
      passwordUpdated = true;
    }

    $("newAdminEmail").value = "";
    $("newAdminPassword").value = "";
    showMessage("adminMsg", "تم تحديث بيانات الدخول.", "success");
  } catch (e) {
    console.error(e);
    let msg = "تعذر تحديث بيانات الدخول.";
    if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential")
      msg = "كلمة المرور الحالية غير صحيحة.";
    else if (e.code === "auth/email-already-in-use")
      msg = "البريد مستخدم بالفعل.";
    else if (e.code === "auth/requires-recent-login")
      msg = "سجل الدخول مجدداً ثم حاول.";
    else if (e.code === "auth/invalid-email")
      msg = "البريد غير صالح.";
    else if (e.code === "auth/weak-password")
      msg = "كلمة المرور ضعيفة.";
    if (emailUpdated || passwordUpdated)
      msg += " تحقق من بيانات الحساب؛ قد يكون أحد التحديثين تم بالفعل.";
    showMessage("adminMsg", msg, "error");
  } finally {
    setLoading(this, false);
  }
});

// المنتجات
function productName(p) { return p.name || p.title || "منتج"; }
function productPrice(p) { return Number(p.price || 0); }
function productImage(p) { return p.image || p.imageUrl || p.photo || ""; }

async function loadProducts() {
  try {
    const snap = await db.collection("products").get();
    products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCategories();
    renderProducts();
    renderAdminProducts();
  } catch (e) {
    console.error(e);
    if ($("products"))
      $("products").innerHTML = '<p class="muted">تعذر تحميل المنتجات.</p>';
  }
}

function renderCategories() {
  const box = $("categories");
  if (!box) return;
  const categories = ["الكل", ...new Set(products.map(p => p.category).filter(Boolean))];
  if (!categories.includes(activeCategory)) activeCategory = "الكل";

  box.innerHTML = categories.map(c => `
    <button type="button"
      class="${activeCategory === c ? "primary" : "secondary"}"
      data-category="${esc(c)}">${esc(c)}</button>
  `).join("");

  box.querySelectorAll("[data-category]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category;
      renderCategories();
      renderProducts();
    });
  });
}

function renderProducts() {
  const box = $("products");
  if (!box) return;
  const search = $("search")?.value.trim().toLowerCase() || "";

  const filtered = products.filter(p =>
    (activeCategory === "الكل" || p.category === activeCategory) &&
    productName(p).toLowerCase().includes(search)
  );

  if (!filtered.length) {
    box.innerHTML = '<p class="muted">لا توجد منتجات مطابقة حالياً.</p>';
    return;
  }

  box.innerHTML = filtered.map(p => `
    <article class="product-card">
      ${productImage(p)
        ? `<img src="${esc(productImage(p))}" alt="${esc(productName(p))}" loading="lazy">`
        : '<div class="product-placeholder">🛍️</div>'}
      <div class="product-info">
        <h3>${esc(productName(p))}</h3>
        <p>${esc(p.category || "")}</p>
        <strong>${money(productPrice(p))} جنيه</strong>
        <button class="primary" type="button" data-add-cart="${esc(p.id)}">أضف للسلة</button>
      </div>
    </article>
  `).join("");

  box.querySelectorAll("[data-add-cart]").forEach(btn =>
    btn.addEventListener("click", () => addToCart(btn.dataset.addCart))
  );
}

$("search")?.addEventListener("input", renderProducts);

// السلة
function addToCart(id) {
  const p = products.find(item => item.id === id);
  if (!p) return;
  const existing = cart.find(item => item.id === id);

  if (existing) existing.quantity = Number(existing.quantity || 1) + 1;
  else cart.push({
    id: p.id, name: productName(p),
    price: productPrice(p), quantity: 1
  });
  saveCart();
}

function cartTotal() {
  return cart.reduce((sum, item) =>
    sum + Number(item.price || 0) * Number(item.quantity || 1), 0
  );
}

function renderCart() {
  const box = $("cartItems");
  if (box) {
    if (!cart.length) {
      box.innerHTML = '<p class="muted">السلة لسه فاضية.</p>';
    } else {
      box.innerHTML = cart.map(item => `
        <div class="cart-item">
          <div>
            <strong>${esc(item.name)}</strong>
            <p>${money(item.price)} جنيه × ${money(item.quantity)}</p>
          </div>
          <div class="cart-item-actions">
            <button type="button" data-cart-minus="${esc(item.id)}">−</button>
            <span>${money(item.quantity)}</span>
            <button type="button" data-cart-plus="${esc(item.id)}">+</button>
            <button type="button" data-cart-remove="${esc(item.id)}">حذف</button>
          </div>
        </div>
      `).join("");

      box.querySelectorAll("[data-cart-minus]").forEach(btn =>
        btn.addEventListener("click", () => changeQuantity(btn.dataset.cartMinus, -1))
      );
      box.querySelectorAll("[data-cart-plus]").forEach(btn =>
        btn.addEventListener("click", () => changeQuantity(btn.dataset.cartPlus, 1))
      );
      box.querySelectorAll("[data-cart-remove]").forEach(btn =>
        btn.addEventListener("click", () => {
          cart = cart.filter(p => p.id !== btn.dataset.cartRemove);
          saveCart();
        })
      );
    }
  }

  if ($("total")) $("total").textContent = money(cartTotal());
  if ($("cartCount"))
    $("cartCount").textContent = cart.reduce((s, p) => s + Number(p.quantity || 1), 0);
}

function changeQuantity(id, amount) {
  const item = cart.find(p => p.id === id);
  if (!item) return;
  item.quantity = Number(item.quantity || 1) + amount;
  if (item.quantity <= 0) cart = cart.filter(p => p.id !== id);
  saveCart();
}

$("clearCart")?.addEventListener("click", () => {
  if (cart.length && confirm("هل تريد تفريغ السلة؟")) {
    cart = [];
    saveCart();
  }
});

// الطلب والواتساب
function normalizeWhatsapp(number) {
  let phone = String(number || "").replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  if (phone.startsWith("0")) phone = "20" + phone.slice(1);
  else if (phone.startsWith("1") && phone.length === 10) phone = "20" + phone;
  return phone;
}

function buildOrderMessage(order) {
  const lines = [
    "طلب جديد من متجر " + (settings.storeName || "زهرة حماة"),
    "",
    "الاسم: " + order.customerName,
    "رقم الهاتف: " + order.customerPhone,
    "العنوان: " + order.customerAddress,
    "",
    "المنتجات:"
  ];

  order.items.forEach((item, i) => {
    lines.push(`${i + 1}- ${item.name} | الكمية: ${item.quantity} | السعر: ${money(item.price)} جنيه`);
  });

  lines.push("", "الإجمالي: " + money(order.total) + " جنيه");
  return lines.join("\n");
}

function buildContactUrl(order) {
  const message = buildOrderMessage(order);
  const channel = order.contactChannel || "whatsapp";

  if (channel === "whatsapp") {
    const phone = normalizeWhatsapp(settings.whatsapp);
    return phone ? "https://wa.me/" + phone + "?text=" +
      encodeURIComponent(message) : "";
  }
  if (channel === "messenger") return settings.messenger || "";
  if (channel === "facebook") return settings.facebook || "";
  return "";
}

$("checkout")?.addEventListener("click", () => {
  if (!cart.length) return alert("السلة فارغة.");
  openModal("checkoutModal");
});

document.querySelectorAll("[data-close]").forEach(btn =>
  btn.addEventListener("click", () => closeModal(btn.dataset.close))
);

$("sendOrder")?.addEventListener("click", async function () {
  if (!cart.length) return alert("السلة فارغة.");

  const customerName = $("customerName")?.value.trim() || "";
  const customerPhone = $("customerPhone")?.value.trim() || "";
  const customerAddress = $("customerAddress")?.value.trim() || "";
  const contactChannel = $("contactChannel")?.value || "whatsapp";

  if (!customerName || !customerPhone || !customerAddress)
    return alert("اكتب الاسم ورقم الموبايل والعنوان.");

  if (!/^[0-9+\s()-]{8,20}$/.test(customerPhone))
    return alert("رقم الموبايل غير صحيح.");

  const orderItems = cart.map(item => ({
    productId: item.id,
    name: item.name,
    price: Number(item.price),
    quantity: Number(item.quantity)
  }));

  const total = cartTotal();
  const order = {
    customerName, customerPhone, customerAddress,
    contactChannel, items: orderItems, total,
    status: "جديد",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const contactUrl = buildContactUrl({ ...order, createdAt: new Date() });
  let contactWindow = null;

  // فتح نافذة أثناء ضغطة المستخدم لتقليل منع النوافذ المنبثقة
  if (contactUrl) contactWindow = window.open("about:blank", "_blank");

  setLoading(this, true, "جاري إرسال الطلب...");
  try {
    await db.collection("orders").add(order);

    cart = [];
    saveCart();
    $("customerName").value = "";
    $("customerPhone").value = "";
    $("customerAddress").value = "";
    closeModal("checkoutModal");

    if (contactUrl) {
      if (contactWindow && !contactWindow.closed)
        contactWindow.location.href = contactUrl;
      else
        window.location.href = contactUrl;

      alert("تم حفظ الطلب. أكمل إرسال الرسالة من واتساب.");
    } else {
      alert("تم حفظ الطلب، لكن وسيلة التواصل أو رقم واتساب غير مضبوط.");
    }

    if (isAdmin()) await loadOrders();
  } catch (e) {
    console.error("Order:", e);
    if (contactUrl) {
      if (contactWindow && !contactWindow.closed)
        contactWindow.location.href = contactUrl;
      else
        window.location.href = contactUrl;
      alert("تعذر حفظ الطلب في قاعدة البيانات. تم فتح التواصل، والطلب غير مسجل بعد.");
    } else {
      if (contactWindow && !contactWindow.closed) contactWindow.close();
      alert("تعذر حفظ الطلب. تحقق من الإنترنت وصلاحيات Firebase.");
    }
  } finally {
    setLoading(this, false);
  }
});

// تجهيز الصور
function showImagePreview(data) {
  selectedImage = data || "";
  const preview = $("productImagePreview");
  if (!preview) return;

  if (selectedImage) {
    preview.src = selectedImage;
    preview.classList.remove("hidden");
    $("removeProductImage")?.classList.remove("hidden");
  } else {
    preview.removeAttribute("src");
    preview.classList.add("hidden");
    $("removeProductImage")?.classList.add("hidden");
  }
}

async function prepareImage(file) {
  if (!file || !file.type.startsWith("image/"))
    throw new Error("الملف ليس صورة.");
  if (file.size > 8 * 1024 * 1024)
    throw new Error("حجم الصورة أكبر من 8 ميجابايت.");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("الصورة غير صالحة."));
      image.onload = () => {
        let width = image.width;
        let height = image.height;
        const max = 900;

        if (width > max || height > max) {
          const ratio = Math.min(max / width, max / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("تعذر تجهيز الصورة."));

        context.drawImage(image, 0, 0, width, height);
        let quality = 0.75;
        let result = canvas.toDataURL("image/jpeg", quality);

        while (result.length > 480000 && quality > 0.25) {
          quality -= 0.1;
          result = canvas.toDataURL("image/jpeg", quality);
        }

        if (result.length > 500000)
          return reject(new Error("الصورة كبيرة جداً، اختر صورة أصغر."));

        resolve(result);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleImageFile(input) {
  const file = input?.files?.[0];
  if (!file) return;
  try {
    showMessage("adminMsg", "جاري تجهيز الصورة...");
    showImagePreview(await prepareImage(file));
    showMessage("adminMsg", "تم تجهيز الصورة.", "success");
  } catch (e) {
    console.error(e);
    showMessage("adminMsg", e.message, "error");
  } finally {
    input.value = "";
  }
}

$("chooseGallery")?.addEventListener("click", () => $("productImageGallery")?.click());
$("takeProductPhoto")?.addEventListener("click", () => $("productImageCamera")?.click());
$("productImageGallery")?.addEventListener("change", function () { handleImageFile(this); });
$("productImageCamera")?.addEventListener("change", function () { handleImageFile(this); });
$("removeProductImage")?.addEventListener("click", () => showImagePreview(""));

// إضافة وتعديل وحذف المنتجات
$("addProduct")?.addEventListener("click", async function () {
  if (!isAdmin()) return showMessage("adminMsg", "سجل الدخول أولاً.", "error");

  const name = $("newName")?.value.trim() || "";
  const price = Number($("newPrice")?.value);
  const category = $("newCategory")?.value.trim() || "";

  if (!name || !category || !Number.isFinite(price) || price < 0)
    return showMessage("adminMsg", "راجع اسم المنتج والسعر والقسم.", "error");

  setLoading(this, true, "جاري إضافة المنتج...");
  try {
    await db.collection("products").add({
      name, price, category, image: selectedImage || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    $("newName").value = "";
    $("newPrice").value = "";
    $("newCategory").value = "";
    showImagePreview("");
    await loadProducts();
    showMessage("adminMsg", "تمت إضافة المنتج.", "success");
  } catch (e) {
    console.error(e);
    showMessage("adminMsg", "تعذرت إضافة المنتج. راجع صلاحيات Firebase.", "error");
  } finally {
    setLoading(this, false);
  }
});

function renderAdminProducts() {
  const box = $("adminProducts");
  if (!box) return;
  if (!products.length) {
    box.innerHTML = "<p>لا توجد منتجات حالياً.</p>";
    return;
  }

  box.innerHTML = products.map(p => `
    <div class="admin-order">
      <strong>${esc(productName(p))}</strong>
      <p>السعر: ${money(productPrice(p))} جنيه</p>
      <p>القسم: ${esc(p.category || "بدون قسم")}</p>
      <div class="order-actions">
        <button type="button" class="secondary" data-edit-product="${esc(p.id)}">تعديل</button>
        <button type="button" class="secondary" data-delete-product="${esc(p.id)}">حذف</button>
      </div>
    </div>
  `).join("");

  box.querySelectorAll("[data-edit-product]").forEach(btn =>
    btn.addEventListener("click", () => editProduct(btn.dataset.editProduct))
  );
  box.querySelectorAll("[data-delete-product]").forEach(btn =>
    btn.addEventListener("click", () => deleteProduct(btn.dataset.deleteProduct))
  );
}

async function editProduct(id) {
  if (!isAdmin()) return;
  const p = products.find(x => x.id === id);
  if (!p) return;

  const name = prompt("اسم المنتج:", productName(p));
  if (name === null) return;
  const priceText = prompt("السعر:", String(productPrice(p)));
  if (priceText === null) return;
  const category = prompt("القسم:", p.category || "");
  if (category === null) return;

  const price = Number(priceText);
  if (!name.trim() || !category.trim() || !Number.isFinite(price) || price < 0)
    return alert("البيانات غير صحيحة.");

  try {
    await db.collection("products").doc(id).update({
      name: name.trim(), price, category: category.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await loadProducts();
    showMessage("adminMsg", "تم تعديل المنتج.", "success");
  } catch (e) {
    console.error(e);
    showMessage("adminMsg", "تعذر تعديل المنتج.", "error");
  }
}

async function deleteProduct(id) {
  if (!isAdmin()) return;
  const p = products.find(x => x.id === id);
  if (!p || !confirm("هل تريد حذف المنتج " + productName(p) + "؟")) return;

  try {
    await db.collection("products").doc(id).delete();
    products = products.filter(x => x.id !== id);
    cart = cart.filter(x => x.id !== id);
    saveCart();
    renderCategories();
    renderProducts();
    renderAdminProducts();
    showMessage("adminMsg", "تم حذف المنتج.", "success");
  } catch (e) {
    console.error(e);
    showMessage("adminMsg", "تعذر حذف المنتج.", "error");
  }
}

// الطلبات
async function loadOrders() {
  try {
    const snap = await db.collection("orders").get();
    orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    orders.sort((a, b) =>
      (dateFromOrder(b)?.getTime() || 0) - (dateFromOrder(a)?.getTime() || 0)
    );
    renderAdminOrders();
    renderSalesStats();
    renderMonthlyReport();
  } catch (e) {
    console.error(e);
    if ($("adminOrders")) $("adminOrders").innerHTML = "<p>تعذر تحميل الطلبات.</p>";
  }
}

function renderAdminOrders() {
  const box = $("adminOrders");
  if (!box) return;
  if (!orders.length) {
    box.innerHTML = "<p>لا توجد طلبات حتى الآن.</p>";
    return;
  }

  box.innerHTML = orders.map(o => `
    <div class="admin-order">
      <strong>طلب رقم: ${esc(o.id)}</strong>
      <p>العميل: ${esc(o.customerName || "")}</p>
      <p>الهاتف: ${esc(o.customerPhone || "")}</p>
      <p>العنوان: ${esc(o.customerAddress || "")}</p>
      <p>التاريخ: ${esc(formatDate(o))}</p>
      <p>الحالة: <strong>${esc(orderStatus(o))}</strong></p>
      <p>المنتجات:</p>
      <ul>${(Array.isArray(o.items) ? o.items : []).map(item => `
        <li>${esc(item.name)} — الكمية: ${money(item.quantity)} — ${money(item.price)} جنيه</li>
      `).join("")}</ul>
      <p><strong>الإجمالي: ${money(o.total)} جنيه</strong></p>
      <div class="order-actions">
        <button type="button" class="secondary" data-order-status="مكتمل" data-order-id="${esc(o.id)}">مكتمل</button>
        <button type="button" class="secondary" data-order-status="جديد" data-order-id="${esc(o.id)}">جديد</button>
        <button type="button" class="secondary" data-order-status="ملغي" data-order-id="${esc(o.id)}">إلغاء</button>
        <button type="button" class="secondary" data-delete-order="${esc(o.id)}">حذف الطلب</button>
      </div>
    </div>
  `).join("");

  box.querySelectorAll("[data-order-status]").forEach(btn =>
    btn.addEventListener("click", () =>
      updateOrderStatus(btn.dataset.orderId, btn.dataset.orderStatus)
    )
  );
  box.querySelectorAll("[data-delete-order]").forEach(btn =>
    btn.addEventListener("click", () => deleteOrder(btn.dataset.deleteOrder))
  );
}

async function updateOrderStatus(id, status) {
  if (!isAdmin()) return;
  try {
    await db.collection("orders").doc(id).update({
      status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    const o = orders.find(x => x.id === id);
    if (o) o.status = status;
    renderAdminOrders();
    renderSalesStats();
    renderMonthlyReport();
    showMessage("adminMsg", "تم تحديث حالة الطلب.", "success");
  } catch (e) {
    console.error(e);
    showMessage("adminMsg", "تعذر تحديث حالة الطلب.", "error");
  }
}

async function deleteOrder(id) {
  if (!isAdmin() || !confirm("هل تريد حذف الطلب نهائياً؟")) return;
  try {
    await db.collection("orders").doc(id).delete();
    orders = orders.filter(o => o.id !== id);
    renderAdminOrders();
    renderSalesStats();
    renderMonthlyReport();
    showMessage("adminMsg", "تم حذف الطلب.", "success");
  } catch (e) {
    console.error(e);
    showMessage("adminMsg", "تعذر حذف الطلب.", "error");
  }
}

// إحصائيات المبيعات
function renderSalesStats() {
  const completed = orders.filter(isCompleted);
  const revenue = completed.reduce((s, o) => s + Number(o.total || 0), 0);

  if ($("statOrders")) $("statOrders").textContent = money(orders.length);
  if ($("statNew")) $("statNew").textContent =
    money(orders.filter(o => orderStatus(o) === "جديد").length);
  if ($("statCompleted")) $("statCompleted").textContent = money(completed.length);
  if ($("statRevenue")) $("statRevenue").textContent = money(revenue) + " جنيه";
}

// التقارير الشهرية
function monthKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("ar-EG", {
    year: "numeric", month: "long"
  });
}

function fillMonthlySelect() {
  const select = $("monthlyReportSelect");
  if (!select) return;
  const months = new Set([monthKey(new Date())]);

  orders.forEach(o => {
    const d = dateFromOrder(o);
    if (d) months.add(monthKey(d));
  });

  const previous = select.value;
  const list = [...months].sort().reverse();
  select.innerHTML = list.map(key =>
    `<option value="${esc(key)}">${esc(monthLabel(key))}</option>`
  ).join("");
  if (list.includes(previous)) select.value = previous;
}

function getSelectedMonthOrders() {
  const selected = $("monthlyReportSelect")?.value || monthKey(new Date());
  return orders.filter(o => {
    const d = dateFromOrder(o);
    return d && monthKey(d) === selected;
  });
}

function renderMonthlyReport() {
  if (!$("monthlyReportSelect")) return;
  fillMonthlySelect();

  const list = getSelectedMonthOrders();
  const completed = list.filter(isCompleted);
  const cancelled = list.filter(isCancelled);
  const fresh = list.filter(o => orderStatus(o) === "جديد");

  const allTotal = list.reduce((s, o) => s + Number(o.total || 0), 0);
  const revenue = completed.reduce((s, o) => s + Number(o.total || 0), 0);

  if ($("monthlyAllTotal")) $("monthlyAllTotal").textContent = money(allTotal) + " جنيه";
  if ($("monthlyRevenue")) $("monthlyRevenue").textContent = money(revenue) + " جنيه";
  if ($("monthlyOrderCount")) $("monthlyOrderCount").textContent = money(list.length);
  if ($("monthlyCompleted")) $("monthlyCompleted").textContent = money(completed.length);
  if ($("monthlyNew")) $("monthlyNew").textContent = money(fresh.length);
  if ($("monthlyCancelled")) $("monthlyCancelled").textContent = money(cancelled.length);

  const box = $("monthlyOrderDetails");
  if (!box) return;
  if (!list.length) {
    box.innerHTML = "<p>لا توجد طلبات في هذا الشهر.</p>";
    return;
  }

  box.innerHTML = list.map(o => `
    <div class="admin-order">
      <strong>طلب: ${esc(o.id)}</strong>
      <p>العميل: ${esc(o.customerName || "")}</p>
      <p>التاريخ: ${esc(formatDate(o))}</p>
      <p>الحالة: ${esc(orderStatus(o))}</p>
      <p>الإجمالي: ${money(o.total)} جنيه</p>
    </div>
  `).join("");
}

$("monthlyReportSelect")?.addEventListener("change", renderMonthlyReport);

// تصدير CSV يفتح في Excel
$("downloadMonthlyExcel")?.addEventListener("click", () => {
  if (!isAdmin()) return showMessage("adminMsg", "سجل الدخول أولاً.", "error");
  const list = getSelectedMonthOrders();
  if (!list.length) return alert("لا توجد طلبات في هذا الشهر.");

  const rows = [[
    "رقم الطلب", "العميل", "الهاتف", "العنوان",
    "التاريخ", "الحالة", "المنتجات", "الإجمالي"
  ]];

  list.forEach(o => {
    const items = (o.items || []).map(i =>
      `${i.name} × ${i.quantity} - ${i.price} جنيه`
    ).join(" | ");
    rows.push([
      o.id, o.customerName || "", o.customerPhone || "",
      o.customerAddress || "", formatDate(o), orderStatus(o),
      items, Number(o.total || 0)
    ]);
  });

  const csv = "\uFEFF" + rows.map(row =>
    row.map(value => '"' + String(value ?? "").replace(/"/g, '""') + '"').join(",")
  ).join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "zahret-hama-report-" +
    ($("monthlyReportSelect")?.value || monthKey(new Date())) + ".csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showMessage("adminMsg", "تم تجهيز التقرير للتنزيل.", "success");
});

// تحميل بيانات Firebase
async function loadCloud() {
  await Promise.all([loadProducts(), loadSettings(), loadOrders()]);
}

// متابعة جلسة الإدارة
auth.onAuthStateChanged(async user => {
  if (user && user.uid === ADMIN_UID) {
    adminSessionActive = true;
    $("adminPane")?.classList.remove("hidden");
    $("loginPane")?.classList.add("hidden");
    try {
      await loadCloud();
      showAdminTab(currentAdminTab);
    } catch (e) {
      console.error(e);
    }
  } else {
    adminSessionActive = false;
    $("adminPane")?.classList.add("hidden");
    $("loginPane")?.classList.remove("hidden");
  }
});

// تشغيل المتجر
async function startStore() {
  renderCart();
  await Promise.all([loadProducts(), loadSettings()]);
  if (isAdmin()) await loadOrders();
}

startStore().catch(error => console.error("Store startup:", error));
