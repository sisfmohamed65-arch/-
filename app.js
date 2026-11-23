
/* =====================================================
   زهرة حماة - app.js
   النسخة الموحدة والمحدثة
   Firebase + المتجر + الإدارة + الطلبات + التقارير
===================================================== */

"use strict";

/* =====================================================
   1) إعداد Firebase
===================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyBbS1MzPjkiLEagg97OTVCBa-yABqKt1Gg",
  authDomain: "zahret-hama.firebaseapp.com",
  projectId: "zahret-hama",
  storageBucket: "zahret-hama.firebasestorage.app",
  messagingSenderId: "525184861733",
  appId: "1:525184861733:web:0f5bb1090a2a29754921cc"
};

const ADMIN_UID = "bw9BjGepH9Z04LZ361DLc02QzEl2";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

/* =====================================================
   2) متغيرات التطبيق
===================================================== */

let products = [];
let orders = [];
let settings = {};
let cart = [];
let selectedImage = "";
let activeCategory = "الكل";
let adminSessionActive = false;
let eventsBound = false;

const $ = id => document.getElementById(id);

/* =====================================================
   3) أدوات مساعدة
===================================================== */

function money(value) {
  return Number(value || 0).toLocaleString("ar-EG");
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showMessage(id, message, type = "error") {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.style.display = "block";
  element.style.color =
    type === "success" ? "#16803c" :
    type === "error" ? "#b42318" : "";

  element.setAttribute("role", "status");
}

function setLoading(button, loading, text) {
  if (!button) return;

  if (loading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }

    button.disabled = true;
    button.textContent = text || "جارٍ التنفيذ...";
  } else {
    button.disabled = false;
    button.textContent =
      button.dataset.originalText || text || "حفظ";

    delete button.dataset.originalText;
  }
}

function isAdmin() {
  return !!(
    adminSessionActive &&
    auth.currentUser &&
    auth.currentUser.uid === ADMIN_UID
  );
}

function openModal(id) {
  $(id)?.classList.remove("hidden");
}

function closeModal(id) {
  $(id)?.classList.add("hidden");
}

function saveCart() {
  try {
    localStorage.setItem("zahretHamaCart", JSON.stringify(cart));
  } catch (error) {
    console.error("Cart storage error:", error);
  }

  renderCart();
}

function loadCart() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("zahretHamaCart") || "[]"
    );

    cart = Array.isArray(saved) ? saved : [];

    cart = cart.filter(item =>
      item &&
      item.id &&
      Number(item.quantity) > 0
    ).map(item => ({
      ...item,
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 1)
    }));

  } catch (error) {
    console.error(error);
    cart = [];
  }
}

function firebaseErrorMessage(error) {
  const messages = {
    "permission-denied": "ليست لديك صلاحية لتنفيذ العملية.",
    "unavailable": "خدمة Firebase غير متاحة حالياً.",
    "network-request-failed": "تحقق من اتصال الإنترنت.",
    "auth/network-request-failed": "تحقق من اتصال الإنترنت.",
    "auth/requires-recent-login": "سجّل الدخول مرة أخرى ثم حاول.",
    "auth/invalid-credential": "بيانات التحقق غير صحيحة.",
    "auth/wrong-password": "كلمة المرور الحالية غير صحيحة.",
    "auth/email-already-in-use": "البريد مستخدم بالفعل.",
    "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
    "auth/weak-password": "كلمة المرور الجديدة ضعيفة.",
    "auth/too-many-requests": "محاولات كثيرة. حاول لاحقاً.",
    "auth/operation-not-allowed": "العملية غير مفعلة في إعدادات Firebase."
  };

  return messages[error?.code] ||
    error?.message ||
    "حدث خطأ غير معروف.";
}

/* =====================================================
   4) إعدادات واسم المتجر
===================================================== */

function applyStoreName(name) {
  const storeName = String(name || "زهرة حماة").trim();

  if ($("storeTitle")) {
    $("storeTitle").textContent = storeName;
  }

  if ($("footerName")) {
    $("footerName").textContent = storeName;
  }

  if ($("footerNameBottom")) {
    $("footerNameBottom").textContent = storeName;
  }

  const heading = document.querySelector(".hero h1");

  if (heading) {
    heading.textContent = "أهلاً بيكم في " + storeName + " 🌿";
  }

  const adminHeading = document.querySelector("#adminModal h2");

  if (adminHeading) {
    adminHeading.textContent = "لوحة إدارة " + storeName;
  }

  document.title = storeName + " | المتجر";
}

async function loadSettings() {
  try {
    const doc = await db.collection("settings").doc("main").get();

    settings = doc.exists ? doc.data() : {};

    applyStoreName(settings.storeName || "زهرة حماة");

    if ($("editStoreName")) {
      $("editStoreName").value = settings.storeName || "زهرة حماة";
    }

    if ($("editWhatsapp")) {
      $("editWhatsapp").value = settings.whatsapp || "";
    }

    if ($("editFacebook")) {
      $("editFacebook").value = settings.facebook || "";
    }

    if ($("editMessenger")) {
      $("editMessenger").value = settings.messenger || "";
    }

  } catch (error) {
    console.error("Settings error:", error);
    showMessage(
      "adminMsg",
      "تعذر تحميل الإعدادات: " + firebaseErrorMessage(error)
    );
  }
}

async function saveStoreName() {
  if (!isAdmin()) {
    showMessage("adminMsg", "يجب تسجيل الدخول كمدير.");
    return;
  }

  const name = $("editStoreName")?.value.trim();

  if (!name) {
    showMessage("adminMsg", "اكتب اسم المتجر أولاً.");
    return;
  }

  const button = $("saveStoreName");
  setLoading(button, true, "جارٍ حفظ الاسم...");

  try {
    await db.collection("settings").doc("main").set({
      storeName: name,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    settings.storeName = name;
    applyStoreName(name);

    showMessage("adminMsg", "تم تحديث اسم المتجر بنجاح.", "success");

  } catch (error) {
    console.error(error);
    showMessage(
      "adminMsg",
      "فشل حفظ الاسم: " + firebaseErrorMessage(error)
    );
  } finally {
    setLoading(button, false);
  }
}

async function saveContactSettings() {
  if (!isAdmin()) {
    showMessage("adminMsg", "غير مصرح لك بتعديل الإعدادات.");
    return;
  }

  const button = $("saveSettings");
  setLoading(button, true, "جارٍ الحفظ...");

  try {
    const data = {
      whatsapp: $("editWhatsapp")?.value.trim() || "",
      facebook: $("editFacebook")?.value.trim() || "",
      messenger: $("editMessenger")?.value.trim() || "",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("settings").doc("main").set(data, {
      merge: true
    });

    settings = { ...settings, ...data };

    showMessage(
      "adminMsg",
      "تم حفظ بيانات التواصل بنجاح.",
      "success"
    );

  } catch (error) {
    console.error(error);
    showMessage(
      "adminMsg",
      "تعذر حفظ الإعدادات: " + firebaseErrorMessage(error)
    );
  } finally {
    setLoading(button, false);
  }
}

/* =====================================================
   5) تسجيل الدخول والخروج
===================================================== */

async function openAdminLogin() {
  openModal("adminModal");

  if (isAdmin()) {
    $("loginPane")?.classList.add("hidden");
    $("adminPane")?.classList.remove("hidden");
  } else {
    $("loginPane")?.classList.remove("hidden");
    $("adminPane")?.classList.add("hidden");
  }
}

async function adminLogin() {
  const email = $("adminEmail")?.value.trim();
  const password = $("adminPassword")?.value;
  const button = $("adminLogin");

  if (!email || !password) {
    showMessage("loginMsg", "اكتب البريد وكلمة المرور.");
    return;
  }

  setLoading(button, true, "جارٍ تسجيل الدخول...");

  try {
    const result = await auth.signInWithEmailAndPassword(
      email,
      password
    );

    if (result.user.uid !== ADMIN_UID) {
      await auth.signOut();
      adminSessionActive = false;

      showMessage(
        "loginMsg",
        "هذا الحساب غير مصرح له بدخول الإدارة."
      );
      return;
    }

    adminSessionActive = true;

    if ($("adminEmail")) $("adminEmail").value = "";
    if ($("adminPassword")) $("adminPassword").value = "";

    $("loginPane")?.classList.add("hidden");
    $("adminPane")?.classList.remove("hidden");

    await Promise.all([
      loadSettings(),
      loadProducts(),
      loadOrders()
    ]);

    updateStatistics();

    showMessage(
      "adminMsg",
      "تم تسجيل الدخول بنجاح.",
      "success"
    );

  } catch (error) {
    console.error("Admin login:", error);
    adminSessionActive = false;

    showMessage(
      "loginMsg",
      firebaseErrorMessage(error)
    );

  } finally {
    setLoading(button, false);
  }
}

async function adminLogout() {
  adminSessionActive = false;

  try {
    await auth.signOut();

    $("adminPane")?.classList.add("hidden");
    $("loginPane")?.classList.remove("hidden");

    openModal("adminModal");

  } catch (error) {
    console.error(error);
    showMessage("adminMsg", firebaseErrorMessage(error));
  }
}

/* =====================================================
   6) تحديث البريد وكلمة المرور
===================================================== */

async function updateAdminCredentials() {
  if (!isAdmin()) {
    showMessage("adminMsg", "يجب تسجيل الدخول كمدير.");
    return;
  }

  const user = auth.currentUser;

  const newEmail = $("newAdminEmail")?.value.trim() || "";
  const newPassword = $("newAdminPassword")?.value || "";

  if (!newEmail && !newPassword) {
    showMessage(
      "adminMsg",
      "اكتب البريد الجديد أو كلمة المرور الجديدة."
    );
    return;
  }

  if (
    newEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)
  ) {
    showMessage("adminMsg", "صيغة البريد الإلكتروني غير صحيحة.");
    return;
  }

  if (newPassword && newPassword.length < 6) {
    showMessage(
      "adminMsg",
      "كلمة المرور يجب أن تكون 6 أحرف على الأقل."
    );
    return;
  }

  const button = $("updateAdminCredentials");
  setLoading(button, true, "جارٍ تحديث البيانات...");

  let emailResult = "";
  let passwordResult = "";

  try {
    const currentPassword = prompt(
      "للتأكيد الأمني، اكتب كلمة مرور الإدارة الحالية:"
    );

    if (!currentPassword) {
      throw new Error("تم إلغاء العملية.");
    }

    const currentEmail = user.email;

    const credential =
      firebase.auth.EmailAuthProvider.credential(
        currentEmail,
        currentPassword
      );

    await user.reauthenticateWithCredential(credential);

    // تحديث البريد بصورة مستقلة
    if (newEmail && newEmail !== currentEmail) {
      try {
        if (typeof user.verifyBeforeUpdateEmail === "function") {
          await user.verifyBeforeUpdateEmail(newEmail);

          emailResult =
            "تم إرسال رسالة تأكيد إلى البريد الجديد. " +
            "لن يتغير البريد إلا بعد إتمام التأكيد.";
        } else {
          await user.updateEmail(newEmail);

          emailResult = "تم تحديث البريد الإلكتروني بنجاح.";
        }
      } catch (error) {
        console.error("Email update:", error);
        emailResult =
          "لم يتم تحديث البريد: " + firebaseErrorMessage(error);
      }
    }

    // تحديث كلمة المرور بصورة مستقلة
    if (newPassword) {
      try {
        await user.updatePassword(newPassword);
        passwordResult = "تم تحديث كلمة المرور بنجاح.";
      } catch (error) {
        console.error("Password update:", error);
        passwordResult =
          "لم يتم تحديث كلمة المرور: " +
          firebaseErrorMessage(error);
      }
    }

    const results = [emailResult, passwordResult].filter(Boolean);

    if (results.some(text => text.includes("لم يتم"))) {
      showMessage("adminMsg", results.join(" "), "error");
    } else {
      showMessage("adminMsg", results.join(" "), "success");
    }

    if ($("newAdminEmail")) $("newAdminEmail").value = "";
    if ($("newAdminPassword")) $("newAdminPassword").value = "";

  } catch (error) {
    console.error("Credentials update:", error);

    showMessage(
      "adminMsg",
      firebaseErrorMessage(error)
    );

  } finally {
    setLoading(button, false);
  }
}

/* =====================================================
   7) المنتجات
===================================================== */

function productName(product) {
  return product.name || product.title || "منتج";
}

function productPrice(product) {
  return Number(product.price || 0);
}

function productImage(product) {
  return product.image || product.imageUrl || product.photo || "";
}

async function loadProducts() {
  try {
    const snapshot = await db.collection("products").get();

    products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    renderCategories();
    renderProducts();
    renderAdminProducts();

  } catch (error) {
    console.error("Products error:", error);

    if ($("products")) {
      $("products").innerHTML =
        "<p>تعذر تحميل المنتجات. تحقق من اتصال Firebase.</p>";
    }

    showMessage(
      "adminMsg",
      "تعذر تحميل المنتجات: " + firebaseErrorMessage(error)
    );
  }
}

function renderCategories() {
  const container = $("categories");
  if (!container) return;

  const categories = [
    "الكل",
    ...new Set(products.map(p => p.category).filter(Boolean))
  ];

  if (!categories.includes(activeCategory)) {
    activeCategory = "الكل";
  }

  container.innerHTML = categories.map(category => `
    <button
      type="button"
      class="${activeCategory === category ? "active" : ""}"
      data-category="${esc(category)}">
      ${esc(category)}
    </button>
  `).join("");

  container.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      renderCategories();
      renderProducts();
    });
  });
}

function renderProducts() {
  const container = $("products");
  if (!container) return;

  const search = $("search")?.value.trim().toLowerCase() || "";

  const filtered = products.filter(product => {
    const matchesCategory =
      activeCategory === "الكل" ||
      product.category === activeCategory;

    const matchesSearch =
      productName(product).toLowerCase().includes(search);

    return matchesCategory && matchesSearch;
  });

  if (!filtered.length) {
    container.innerHTML =
      '<p class="muted">لا توجد منتجات مطابقة حالياً.</p>';
    return;
  }

  container.innerHTML = filtered.map(product => {
    const image = productImage(product);

    return `
      <article class="product-card">
        ${
          image
            ? `<img src="${esc(image)}"
                alt="${esc(productName(product))}"
                loading="lazy"
                onerror="this.style.display='none'">`
            : `<div class="product-placeholder">🛍️</div>`
        }

        <div class="product-info">
          <h3>${esc(productName(product))}</h3>
          <p>${esc(product.category || "")}</p>
          <strong>${money(productPrice(product))} جنيه</strong>

          <button
            class="primary"
            type="button"
            data-add-cart="${esc(product.id)}">
            أضف للسلة
          </button>
        </div>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-add-cart]").forEach(button => {
    button.addEventListener("click", () => {
      addToCart(button.dataset.addCart);
    });
  });
}

/* =====================================================
   8) السلة
===================================================== */

function addToCart(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  const existing = cart.find(item => item.id === id);

  if (existing) {
    existing.quantity = Number(existing.quantity || 1) + 1;
  } else {
    cart.push({
      id: product.id,
      name: productName(product),
      price: productPrice(product),
      quantity: 1
    });
  }

  saveCart();
}

function cartTotal() {
  return cart.reduce((sum, item) => {
    return sum +
      Number(item.price || 0) *
      Number(item.quantity || 1);
  }, 0);
}

function renderCart() {
  const container = $("cartItems");

  if ($("total")) {
    $("total").textContent = money(cartTotal());
  }

  if ($("cartCount")) {
    $("cartCount").textContent = cart.reduce(
      (sum, item) => sum + Number(item.quantity || 1),
      0
    );
  }

  if (!container) return;

  if (!cart.length) {
    container.innerHTML = '<p class="muted">السلة فارغة.</p>';
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div>
        <strong>${esc(item.name)}</strong>
        <p>
          ${money(item.price)} جنيه ×
          ${money(item.quantity)}
        </p>
      </div>

      <div class="cart-item-actions">
        <button type="button" data-cart-minus="${esc(item.id)}">−</button>
        <span>${money(item.quantity)}</span>
        <button type="button" data-cart-plus="${esc(item.id)}">+</button>
        <button type="button" data-cart-remove="${esc(item.id)}">حذف</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("[data-cart-minus]").forEach(button => {
    button.addEventListener("click", () => {
      changeQuantity(button.dataset.cartMinus, -1);
    });
  });

  container.querySelectorAll("[data-cart-plus]").forEach(button => {
    button.addEventListener("click", () => {
      changeQuantity(button.dataset.cartPlus, 1);
    });
  });

  container.querySelectorAll("[data-cart-remove]").forEach(button => {
    button.addEventListener("click", () => {
      cart = cart.filter(
        item => item.id !== button.dataset.cartRemove
      );
      saveCart();
    });
  });
}

function changeQuantity(id, amount) {
  const item = cart.find(p => p.id === id);
  if (!item) return;

  item.quantity = Number(item.quantity || 1) + amount;

  if (item.quantity <= 0) {
    cart = cart.filter(p => p.id !== id);
  }

  saveCart();
}

/* =====================================================
   9) واتساب وإتمام الطلب
===================================================== */

function normalizeWhatsAppNumber(number) {
  let phone = String(number || "").replace(/\D/g, "");

  if (phone.startsWith("00")) {
    phone = phone.substring(2);
  }

  if (phone.startsWith("01") && phone.length === 11) {
    phone = "20" + phone.substring(1);
  }

  return phone;
}

function buildWhatsAppMessage(order) {
  const lines = (order.items || []).map(item => {
    return `- ${item.name} × ${item.quantity} = ${
      money(Number(item.price) * Number(item.quantity))
    } جنيه`;
  });

  return [
    "طلب جديد من متجر زهرة حماة",
    "-------------------------",
    `اسم العميل: ${order.customerName}`,
    `رقم الهاتف: ${order.customerPhone}`,
    `العنوان: ${order.customerAddress}`,
    "-------------------------",
    "المنتجات:",
    ...lines,
    "-------------------------",
    `الإجمالي: ${money(order.total)} جنيه`,
    "شكراً لطلبكم."
  ].join("\n");
}

function getWhatsAppUrl(order) {
  const phone = normalizeWhatsAppNumber(settings.whatsapp);

  if (!phone) return "";

  return "https://wa.me/" + phone +
    "?text=" + encodeURIComponent(buildWhatsAppMessage(order));
}

async function sendOrder() {
  if (!cart.length) {
    alert("السلة فارغة.");
    return;
  }

  const customerName = $("customerName")?.value.trim();
  const customerPhone = $("customerPhone")?.value.trim();
  const customerAddress = $("customerAddress")?.value.trim();
  const contactChannel = $("contactChannel")?.value || "whatsapp";

  if (!customerName || !customerPhone || !customerAddress) {
    alert("من فضلك اكتب الاسم ورقم الهاتف والعنوان.");
    return;
  }

  if (!/^[0-9+\s()-]{8,20}$/.test(customerPhone)) {
    alert("رقم الهاتف غير صحيح.");
    return;
  }

  const button = $("sendOrder");

  // تجهيز نسخة مستقلة من الطلب قبل بدء الحفظ
  const orderItems = cart.map(item => ({
    id: item.id,
    productId: item.id,
    name: item.name,
    price: Number(item.price),
    quantity: Number(item.quantity)
  }));

  const order = {
    customerName,
    customerPhone,
    customerAddress,
    contactChannel,
    items: orderItems,
    total: cartTotal(),
    status: "جديد",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  // فتح نافذة فارغة أثناء ضغطة المستخدم حتى لا يمنع المتصفح واتساب
  let waWindow = null;

  if (contactChannel === "whatsapp") {
    waWindow = window.open("about:blank", "_blank");
  }

  setLoading(button, true, "جارٍ إرسال الطلب...");

  let saved = false;
  let saveError = null;

  try {
    // محاولة حفظ الطلب
    try {
      await db.collection("orders").add(order);
      saved = true;
    } catch (error) {
      saveError = error;
      console.error("Order save error:", error);
    }

    // فتح واتساب بصورة مستقلة عن نتيجة الحفظ
    if (contactChannel === "whatsapp") {
      const url = getWhatsAppUrl(order);

      if (!url) {
        if (waWindow) waWindow.close();

        alert(
          saved
            ? "تم حفظ الطلب، لكن رقم واتساب المتجر غير مضبوط."
            : "لم يتم حفظ الطلب، ورقم واتساب المتجر غير مضبوط."
        );

        return;
      }

      if (waWindow && !waWindow.closed) {
        waWindow.location.href = url;
      } else {
        window.location.href = url;
      }

      if (saved) {
        alert("تم حفظ الطلب. أكمل إرسال الرسالة من واتساب.");
      } else {
        alert(
          "تم فتح واتساب لإرسال الطلب، لكن لم يتم حفظه في قاعدة البيانات. " +
          "راجع صلاحيات Firebase والاتصال."
        );
      }

    } else {
      if (waWindow) waWindow.close();

      if (saved) {
        alert("تم حفظ الطلب بنجاح. شكراً لثقتكم بنا.");
      } else {
        alert(
          "تعذر حفظ الطلب: " +
          firebaseErrorMessage(saveError)
        );
        return;
      }
    }

    // تفريغ السلة فقط بعد نجاح الحفظ
    if (saved) {
      cart = [];
      saveCart();

      if ($("customerName")) $("customerName").value = "";
      if ($("customerPhone")) $("customerPhone").value = "";
      if ($("customerAddress")) $("customerAddress").value = "";

      closeModal("checkoutModal");
    }

  } finally {
    setLoading(button, false);
  }
}

/* =====================================================
   10) صور المنتجات
===================================================== */

function handleProductImage(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("اختر ملف صورة صالحاً.");
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    alert("حجم الصورة كبير. اختر صورة أقل من 8 ميجابايت.");
    return;
  }

  const reader = new FileReader();

  reader.onerror = () => {
    alert("تعذر قراءة الصورة.");
  };

  reader.onload = event => {
    const image = new Image();

    image.onerror = () => {
      alert("الصورة غير صالحة.");
    };

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSize = 700;

      let width = image.width;
      let height = image.height;

      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(
          maxSize / width,
          maxSize / height
        );

        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        alert("تعذر تجهيز الصورة.");
        return;
      }

      context.drawImage(image, 0, 0, width, height);

      selectedImage = canvas.toDataURL("image/jpeg", 0.72);

      if ($("productImagePreview")) {
        $("productImagePreview").src = selectedImage;
      }
    };

    image.src = event.target.result;
  };

  reader.readAsDataURL(file);
}

async function prepareImage(file) {
  handleProductImage(file);
}

/* =====================================================
   11) إضافة منتج
===================================================== */

async function addProduct() {
  if (!isAdmin()) {
    showMessage("adminMsg", "يجب تسجيل الدخول كمدير.");
    return;
  }

  const name = $("newName")?.value.trim();
  const price = Number($("newPrice")?.value);
  const category = $("newCategory")?.value.trim();

  if (
    !name ||
    $("newPrice")?.value.trim() === "" ||
    !Number.isFinite(price) ||
    price < 0 ||
    !category
  ) {
    showMessage(
      "adminMsg",
      "أدخل اسم المنتج والسعر والقسم بشكل صحيح."
    );
    return;
  }

  const button = $("addProduct");
  setLoading(button, true, "جارٍ إضافة المنتج...");

  try {
    await db.collection("products").add({
      name,
      price,
      category,
      image: selectedImage || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if ($("newName")) $("newName").value = "";
    if ($("newPrice")) $("newPrice").value = "";
    if ($("newCategory")) $("newCategory").value = "";

    selectedImage = "";

    if ($("productImagePreview")) {
      $("productImagePreview").src = "";
    }

    await loadProducts();

    showMessage("adminMsg", "تمت إضافة المنتج بنجاح.", "success");

  } catch (error) {
    console.error(error);
    showMessage(
      "adminMsg",
      "فشل إضافة المنتج: " + firebaseErrorMessage(error)
    );
  } finally {
    setLoading(button, false);
  }
}

/* =====================================================
   12) عرض وإدارة المنتجات
===================================================== */

function renderAdminProducts() {
  const container = $("adminProducts");
  if (!container) return;

  if (!products.length) {
    container.innerHTML = "<p>لا توجد منتجات حالياً.</p>";
    return;
  }

  container.innerHTML = products.map(product => `
    <div class="admin-product">
      <div>
        <strong>${esc(productName(product))}</strong>
        <p>
          ${money(productPrice(product))} جنيه -
          ${esc(product.category || "")}
        </p>
      </div>

      <div class="order-actions">
        <button
          type="button"
          data-edit-product="${esc(product.id)}">
          تعديل
        </button>

        <button
          type="button"
          data-delete-product="${esc(product.id)}">
          حذف
        </button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("[data-edit-product]").forEach(button => {
    button.addEventListener("click", () => {
      editProduct(button.dataset.editProduct);
    });
  });

  container.querySelectorAll("[data-delete-product]").forEach(button => {
    button.addEventListener("click", () => {
      deleteProduct(button.dataset.deleteProduct);
    });
  });
}

async function editProduct(id) {
  if (!isAdmin()) return;

  const product = products.find(item => item.id === id);
  if (!product) return;

  const name = prompt("اسم المنتج:", productName(product));
  if (name === null) return;

  const priceText = prompt(
    "سعر المنتج:",
    String(productPrice(product))
  );
  if (priceText === null) return;

  const category = prompt(
    "قسم المنتج:",
    product.category || ""
  );
  if (category === null) return;

  const price = Number(priceText);

  if (
    !name.trim() ||
    !category.trim() ||
    priceText.trim() === "" ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    alert("بيانات المنتج غير صحيحة.");
    return;
  }

  try {
    await db.collection("products").doc(id).update({
      name: name.trim(),
      price,
      category: category.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await loadProducts();

    showMessage("adminMsg", "تم تعديل المنتج بنجاح.", "success");

  } catch (error) {
    console.error(error);
    showMessage(
      "adminMsg",
      "تعذر تعديل المنتج: " + firebaseErrorMessage(error)
    );
  }
}

async function deleteProduct(id) {
  if (!isAdmin()) return;

  if (!confirm("هل تريد حذف هذا المنتج؟")) return;

  try {
    await db.collection("products").doc(id).delete();

    await loadProducts();

    showMessage("adminMsg", "تم حذف المنتج بنجاح.", "success");

  } catch (error) {
    console.error(error);
    showMessage(
      "adminMsg",
      "تعذر حذف المنتج: " + firebaseErrorMessage(error)
    );
  }
}

/* =====================================================
   13) الطلبات
===================================================== */

async function loadOrders() {
  if (!isAdmin()) return;

  try {
    const snapshot = await db.collection("orders")
      .orderBy("createdAt", "desc")
      .get();

    orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    renderAdminOrders();
    updateStatistics();

  } catch (error) {
    console.error("Orders error:", error);

    if ($("adminOrders")) {
      $("adminOrders").innerHTML =
        "<p>تعذر تحميل الطلبات. تحقق من صلاحيات Firebase.</p>";
    }

    showMessage(
      "adminMsg",
      "تعذر تحميل الطلبات: " + firebaseErrorMessage(error)
    );
  }
}

function renderAdminOrders() {
  const container = $("adminOrders");
  if (!container) return;

  if (!orders.length) {
    container.innerHTML = "<p>لا توجد طلبات حتى الآن.</p>";
    return;
  }

  container.innerHTML = orders.map(order => {
    const items = (order.items || []).map(item => {
      return `${esc(item.name)} × ${Number(item.quantity || 0)}`;
    }).join("، ");

    let date = "غير محدد";

    if (order.createdAt?.toDate) {
      date = order.createdAt.toDate().toLocaleString("ar-EG");
    }

    return `
      <article class="admin-order">
        <h3>${esc(order.customerName || "")}</h3>

        <p>الهاتف: ${esc(order.customerPhone || "")}</p>
        <p>العنوان: ${esc(order.customerAddress || "")}</p>
        <p>المنتجات: ${items}</p>
        <p>الإجمالي: ${money(order.total)} جنيه</p>
        <p>التواصل: ${esc(order.contactChannel || "")}</p>
        <p>التاريخ: ${esc(date)}</p>

        <label>حالة الطلب:</label>

        <select data-status="${esc(order.id)}">
          <option value="جديد" ${order.status === "جديد" ? "selected" : ""}>جديد</option>
          <option value="قيد التجهيز" ${order.status === "قيد التجهيز" ? "selected" : ""}>قيد التجهيز</option>
          <option value="مكتمل" ${order.status === "مكتمل" ? "selected" : ""}>مكتمل</option>
          <option value="ملغي" ${order.status === "ملغي" ? "selected" : ""}>ملغي</option>
        </select>

        <button
          type="button"
          data-delete-order="${esc(order.id)}">
          حذف الطلب
        </button>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-status]").forEach(select => {
    select.addEventListener("change", async () => {
      if (!isAdmin()) return;

      try {
        await db.collection("orders")
          .doc(select.dataset.status)
          .update({
            status: select.value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

        await loadOrders();

        showMessage("adminMsg", "تم تحديث حالة الطلب.", "success");

      } catch (error) {
        console.error(error);
        alert("تعذر تحديث حالة الطلب: " + firebaseErrorMessage(error));
      }
    });
  });

  container.querySelectorAll("[data-delete-order]").forEach(button => {
    button.addEventListener("click", async () => {
      if (!isAdmin()) return;

      if (!confirm("هل تريد حذف الطلب؟")) return;

      try {
        await db.collection("orders")
          .doc(button.dataset.deleteOrder)
          .delete();

        await loadOrders();

        showMessage("adminMsg", "تم حذف الطلب.", "success");

      } catch (error) {
        console.error(error);
        alert("تعذر حذف الطلب: " + firebaseErrorMessage(error));
      }
    });
  });
}

/* =====================================================
   14) إحصائيات وتقارير المبيعات
===================================================== */

function updateStatistics() {
  const totalOrders = orders.length;

  const newOrders = orders.filter(
    order => order.status === "جديد"
  ).length;

  const completed = orders.filter(
    order => order.status === "مكتمل"
  ).length;

  const revenue = orders
    .filter(order => order.status === "مكتمل")
    .reduce(
      (sum, order) => sum + Number(order.total || 0),
      0
    );

  if ($("statOrders")) {
    $("statOrders").textContent = totalOrders;
  }

  if ($("statNew")) {
    $("statNew").textContent = newOrders;
  }

  if ($("statCompleted")) {
    $("statCompleted").textContent = completed;
  }

  if ($("statRevenue")) {
    $("statRevenue").textContent = money(revenue);
  }
}

function downloadSalesReport() {
  if (!isAdmin()) {
    alert("يجب تسجيل الدخول كمدير.");
    return;
  }

  const rows = [
    [
      "اسم العميل",
      "الهاتف",
      "العنوان",
      "الإجمالي",
      "الحالة",
      "التاريخ"
    ]
  ];

  orders.forEach(order => {
    const date = order.createdAt?.toDate
      ? order.createdAt.toDate().toLocaleString("ar-EG")
      : "";

    rows.push([
      order.customerName || "",
      order.customerPhone || "",
      order.customerAddress || "",
      order.total || 0,
      order.status || "",
      date
    ]);
  });

  const csv = "\uFEFF" + rows.map(row =>
    row.map(value =>
      '"' + String(value).replace(/"/g, '""') + '"'
    ).join(",")
  ).join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "zahret-hama-sales-report.csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =====================================================
   15) التنقل بين أقسام الإدارة
===================================================== */

function setupAdminTabs() {
  document.querySelectorAll("[data-admin-tab]").forEach(button => {
    button.addEventListener("click", () => {
      if (!isAdmin()) return;

      const target = button.dataset.adminTab;

      document.querySelectorAll("[data-admin-panel]").forEach(panel => {
        panel.classList.add("hidden");
      });

      const panel = document.querySelector(
        `[data-admin-panel="${target}"]`
      );

      if (panel) {
        panel.classList.remove("hidden");
      }

      if (target === "orders") {
        loadOrders();
      }

      if (target === "products") {
        renderAdminProducts();
      }

      if (target === "sales") {
        updateStatistics();
      }
    });
  });
}

/* =====================================================
   16) ربط أزرار الصور
===================================================== */

function setupImageControls() {
  $("chooseGallery")?.addEventListener("click", () => {
    $("productImageGallery")?.click();
  });

  $("takeProductPhoto")?.addEventListener("click", () => {
    $("productImageCamera")?.click();
  });

  $("productImageGallery")?.addEventListener("change", event => {
    handleProductImage(event.target.files?.[0]);
  });

  $("productImageCamera")?.addEventListener("change", event => {
    handleProductImage(event.target.files?.[0]);
  });

  $("removeProductImage")?.addEventListener("click", () => {
    selectedImage = "";

    if ($("productImagePreview")) {
      $("productImagePreview").src = "";
    }

    if ($("productImageGallery")) {
      $("productImageGallery").value = "";
    }

    if ($("productImageCamera")) {
      $("productImageCamera").value = "";
    }
  });
}

/* =====================================================
   17) ربط جميع الأحداث
===================================================== */

function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;

  $("openAdmin")?.addEventListener("click", openAdminLogin);

  $("closeAdmin")?.addEventListener("click", () => {
    closeModal("adminModal");
  });

  $("adminLogin")?.addEventListener("click", adminLogin);

  $("logout")?.addEventListener("click", adminLogout);

  $("saveStoreName")?.addEventListener("click", saveStoreName);

  $("saveSettings")?.addEventListener("click", saveContactSettings);

  $("updateAdminCredentials")?.addEventListener(
    "click",
    updateAdminCredentials
  );

  $("addProduct")?.addEventListener("click", addProduct);

  $("sendOrder")?.addEventListener("click", sendOrder);

  $("search")?.addEventListener("input", renderProducts);

  $("clearCart")?.addEventListener("click", () => {
    if (!cart.length) return;

    if (confirm("هل تريد تفريغ السلة؟")) {
      cart = [];
      saveCart();
    }
  });

  $("checkout")?.addEventListener("click", () => {
    if (!cart.length) {
      alert("السلة فارغة. أضف منتجات أولاً.");
      return;
    }

    openModal("checkoutModal");
  });

  $("downloadReport")?.addEventListener(
    "click",
    downloadSalesReport
  );

  setupImageControls();
  setupAdminTabs();
}

/* =====================================================
   18) تشغيل التطبيق
===================================================== */

async function startStore() {
  loadCart();
  bindEvents();
  renderCart();

  await loadSettings();
  await loadProducts();

  auth.onAuthStateChanged(user => {
    // لا نفتح الإدارة تلقائياً لمجرد وجود جلسة.
    // يجب تسجيل الدخول من واجهة الإدارة.
    adminSessionActive = false;

    if (!user || user.uid !== ADMIN_UID) {
      $("adminPane")?.classList.add("hidden");
      $("loginPane")?.classList.remove("hidden");
    }
  });
}

/* =====================================================
   19) بدء التطبيق
===================================================== */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startStore, {
    once: true
  });
} else {
  startStore();
}
