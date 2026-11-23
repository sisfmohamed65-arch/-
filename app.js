
/* =====================================================
   زهرة حماة - app.js
   المتجر + Firebase + الإدارة + الطلبات + التقارير
===================================================== */

"use strict";

/* ===============================
   1- إعداد Firebase
================================ */

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

/* ===============================
   2- متغيرات التطبيق
================================ */

let products = [];
let orders = [];
let settings = {};
let cart = [];
let selectedImage = "";
let activeCategory = "الكل";
let adminSessionActive = false;

/* ===============================
   3- أدوات مساعدة
================================ */

const $ = id => document.getElementById(id);

function money(value) {
  return Number(value || 0).toLocaleString("ar-EG") + " ج.م";
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

function showMessage(id, message, success = false) {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.style.color = success ? "#16834a" : "#d93025";
}

function setLoading(button, loading, normalText) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? "جارٍ التنفيذ..." : normalText;
}

function isAdmin() {
  return !!(
    auth.currentUser &&
    auth.currentUser.uid === ADMIN_UID &&
    adminSessionActive
  );
}

function closeModal(id) {
  const element = $(id);
  if (element) element.classList.add("hidden");
}

function openModal(id) {
  const element = $(id);
  if (element) element.classList.remove("hidden");
}

function saveCart() {
  localStorage.setItem("zahretHamaCart", JSON.stringify(cart));
  renderCart();
}

function loadCart() {
  try {
    cart = JSON.parse(
      localStorage.getItem("zahretHamaCart") || "[]"
    );

    if (!Array.isArray(cart)) cart = [];
  } catch {
    cart = [];
  }
}

/* ===============================
   4- إعدادات المتجر
================================ */

async function loadSettings() {
  try {
    const doc = await db.collection("settings").doc("main").get();

    settings = doc.exists ? doc.data() : {};

    applyStoreName(settings.storeName || "زهرة حماة");

    if ($("editWhatsapp")) {
      $("editWhatsapp").value = settings.whatsapp || "";
    }

    if ($("editFacebook")) {
      $("editFacebook").value = settings.facebook || "";
    }

    if ($("editMessenger")) {
      $("editMessenger").value = settings.messenger || "";
    }

    if ($("editStoreName")) {
      $("editStoreName").value = settings.storeName || "زهرة حماة";
    }

  } catch (error) {
    console.error("Settings error:", error);
  }
}

function applyStoreName(name) {
  const safeName = name || "زهرة حماة";

  if ($("storeTitle")) $("storeTitle").textContent = safeName;
  if ($("footerName")) $("footerName").textContent = safeName;
  if ($("footerNameBottom")) {
    $("footerNameBottom").textContent = safeName;
  }

  document.title = safeName + " | المتجر";

  const heading = document.querySelector(".hero h1");
  if (heading) heading.textContent = safeName;
}

async function saveContactSettings() {
  if (!isAdmin()) return;

  const button = $("saveSettings");
  setLoading(button, true, "حفظ الإعدادات");

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

    showMessage("adminMsg", "تم حفظ بيانات التواصل بنجاح.", true);

  } catch (error) {
    console.error(error);
    showMessage("adminMsg", "تعذر حفظ الإعدادات: " + error.message);
  } finally {
    setLoading(button, false, "حفظ الإعدادات");
  }
}

/* ===============================
   5- تغيير اسم المتجر
================================ */

async function saveStoreName() {
  if (!isAdmin()) return;

  const name = $("editStoreName")?.value.trim();

  if (!name) {
    showMessage("adminMsg", "اكتب اسم المتجر أولاً.");
    return;
  }

  const button = $("saveStoreName");
  setLoading(button, true, "حفظ الاسم");

  try {
    await db.collection("settings").doc("main").set({
      storeName: name,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    settings.storeName = name;
    applyStoreName(name);

    showMessage("adminMsg", "تم تحديث اسم المتجر.", true);

  } catch (error) {
    console.error(error);
    showMessage("adminMsg", "فشل تحديث الاسم: " + error.message);
  } finally {
    setLoading(button, false, "حفظ الاسم");
  }
}

/* ===============================
   6- تسجيل دخول الإدارة
================================ */

async function adminLogin() {
  const email = $("adminEmail")?.value.trim();
  const password = $("adminPassword")?.value;
  const button = $("adminLogin");

  if (!email || !password) {
    showMessage("loginMsg", "اكتب البريد وكلمة المرور.");
    return;
  }

  setLoading(button, true, "تسجيل الدخول");

  try {
    const result = await auth.signInWithEmailAndPassword(
      email,
      password
    );

    if (result.user.uid !== ADMIN_UID) {
      await auth.signOut();
      throw new Error("هذا الحساب ليس حساب الإدارة المصرح به.");
    }

    adminSessionActive = true;

    if ($("loginPane")) $("loginPane").classList.add("hidden");
    if ($("adminPane")) $("adminPane").classList.remove("hidden");

    await Promise.all([
      loadSettings(),
      loadProducts(),
      loadOrders()
    ]);

    updateStatistics();
    showMessage("adminMsg", "تم تسجيل الدخول بنجاح.", true);

  } catch (error) {
    console.error("Admin login error:", error);

    const messages = {
      "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحة.",
      "auth/user-not-found": "الحساب غير موجود.",
      "auth/wrong-password": "كلمة المرور غير صحيحة.",
      "auth/too-many-requests": "محاولات كثيرة. حاول لاحقاً.",
      "auth/network-request-failed": "تحقق من اتصال الإنترنت."
    };

    showMessage(
      "loginMsg",
      messages[error.code] || error.message || "تعذر تسجيل الدخول."
    );
  } finally {
    setLoading(button, false, "تسجيل الدخول");
  }
}

/* ===============================
   7- تحديث البريد وكلمة المرور
================================ */

async function updateAdminCredentials() {
  if (!isAdmin()) {
    showMessage("adminMsg", "يجب تسجيل الدخول كمدير.");
    return;
  }

  const user = auth.currentUser;
  const newEmail = $("newAdminEmail")?.value.trim();
  const newPassword = $("newAdminPassword")?.value;

  if (!newEmail && !newPassword) {
    showMessage("adminMsg", "اكتب البريد الجديد أو كلمة المرور الجديدة.");
    return;
  }

  if (newPassword && newPassword.length < 6) {
    showMessage("adminMsg", "كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
    return;
  }

  const button = $("updateAdminCredentials");
  setLoading(button, true, "تحديث بيانات الإدارة");

  try {
    const currentPassword = prompt(
      "لأمان الحساب، اكتب كلمة المرور الحالية:"
    );

    if (!currentPassword) {
      throw new Error("تم إلغاء العملية.");
    }

    const credential = firebase.auth.EmailAuthProvider.credential(
      user.email,
      currentPassword
    );

    await user.reauthenticateWithCredential(credential);

    let emailMessage = "";
    let passwordMessage = "";

    if (newEmail && newEmail !== user.email) {
      if (typeof user.verifyBeforeUpdateEmail === "function") {
        await user.verifyBeforeUpdateEmail(newEmail);
        emailMessage = "تم إرسال رسالة تأكيد إلى البريد الجديد.";
      } else {
        await user.updateEmail(newEmail);
        emailMessage = "تم تحديث البريد الإلكتروني.";
      }
    }

    if (newPassword) {
      await user.updatePassword(newPassword);
      passwordMessage = "تم تحديث كلمة المرور.";
    }

    $("newAdminEmail").value = "";
    $("newAdminPassword").value = "";

    showMessage(
      "adminMsg",
      [emailMessage, passwordMessage].filter(Boolean).join(" ") ||
      "لم يتم إجراء أي تغيير.",
      true
    );

  } catch (error) {
    console.error("Credentials update error:", error);

    const messages = {
      "auth/wrong-password": "كلمة المرور الحالية غير صحيحة.",
      "auth/invalid-credential": "بيانات التحقق غير صحيحة.",
      "auth/requires-recent-login": "انتهت صلاحية التحقق. سجّل الخروج ثم ادخل مجدداً.",
      "auth/email-already-in-use": "البريد الجديد مستخدم بالفعل.",
      "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
      "auth/weak-password": "كلمة المرور الجديدة ضعيفة.",
      "auth/operation-not-allowed": "تحديث بيانات الحساب غير مسموح في إعدادات Firebase.",
      "auth/network-request-failed": "تحقق من اتصال الإنترنت."
    };

    showMessage(
      "adminMsg",
      messages[error.code] || error.message || "فشل تحديث البيانات."
    );
  } finally {
    setLoading(button, false, "تحديث بيانات الإدارة");
  }
}

/* ===============================
   8- تسجيل الخروج
================================ */

async function adminLogout() {
  try {
    adminSessionActive = false;
    await auth.signOut();

    if ($("adminPane")) $("adminPane").classList.add("hidden");
    if ($("loginPane")) $("loginPane").classList.remove("hidden");

    openModal("adminModal");

  } catch (error) {
    console.error(error);
  }
}

/* ===============================
   9- تحميل المنتجات
================================ */

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
  }
}

function renderCategories() {
  const container = $("categories");
  if (!container) return;

  const categories = [
    "الكل",
    ...new Set(products.map(p => p.category).filter(Boolean))
  ];

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
      String(product.name || "").toLowerCase().includes(search);

    return matchesCategory && matchesSearch;
  });

  if (!filtered.length) {
    container.innerHTML = "<p>لا توجد منتجات حالياً.</p>";
    return;
  }

  container.innerHTML = filtered.map(product => `
    <article class="product-card">
      <img
        src="${esc(product.image || "")}"
        alt="${esc(product.name)}"
        loading="lazy"
        onerror="this.style.display='none'">

      <h3>${esc(product.name)}</h3>
      <p>${money(product.price)}</p>
      <small>${esc(product.category || "")}</small>

      <button
        type="button"
        data-add-cart="${esc(product.id)}">
        أضف إلى السلة
      </button>
    </article>
  `).join("");

  container.querySelectorAll("[data-add-cart]").forEach(button => {
    button.addEventListener("click", () => {
      addToCart(button.dataset.addCart);
    });
  });
}

/* ===============================
   10- السلة
================================ */

function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(item => item.id === productId);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price || 0),
      quantity: 1
    });
  }

  saveCart();
}

function changeQuantity(productId, amount) {
  const item = cart.find(p => p.id === productId);
  if (!item) return;

  item.quantity += amount;

  if (item.quantity <= 0) {
    cart = cart.filter(p => p.id !== productId);
  }

  saveCart();
}

function getCartTotal() {
  return cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
}

function renderCart() {
  const container = $("cartItems");
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  if ($("cartCount")) $("cartCount").textContent = count;
  if ($("total")) $("total").textContent = money(getCartTotal());

  if (!container) return;

  if (!cart.length) {
    container.innerHTML = "<p>السلة فارغة.</p>";
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div>
        <strong>${esc(item.name)}</strong>
        <p>${money(item.price)} × ${item.quantity}</p>
      </div>

      <div class="cart-controls">
        <button type="button" data-plus="${esc(item.id)}">+</button>
        <span>${item.quantity}</span>
        <button type="button" data-minus="${esc(item.id)}">-</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("[data-plus]").forEach(button => {
    button.addEventListener("click", () => {
      changeQuantity(button.dataset.plus, 1);
    });
  });

  container.querySelectorAll("[data-minus]").forEach(button => {
    button.addEventListener("click", () => {
      changeQuantity(button.dataset.minus, -1);
    });
  });
}

/* ===============================
   11- تجهيز رسالة واتساب
================================ */

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
  const lines = order.items.map(item =>
    `- ${item.name} × ${item.quantity} = ${money(
      item.price * item.quantity
    )}`
  );

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
    `الإجمالي: ${money(order.total)}`,
    "شكراً لطلبكم."
  ].join("\n");
}

/* ===============================
   12- إرسال الطلب
================================ */

async function sendOrder() {
  const customerName = $("customerName")?.value.trim();
  const customerPhone = $("customerPhone")?.value.trim();
  const customerAddress = $("customerAddress")?.value.trim();
  const contactChannel = $("contactChannel")?.value || "whatsapp";
  const button = $("sendOrder");

  if (!cart.length) {
    alert("السلة فارغة.");
    return;
  }

  if (!customerName || !customerPhone || !customerAddress) {
    alert("من فضلك اكتب الاسم ورقم الهاتف والعنوان.");
    return;
  }

  /*
    فتح نافذة واتساب أثناء ضغطة المستخدم
    لتقليل احتمال منع النافذة المنبثقة.
  */
  let waWindow = null;

  if (contactChannel === "whatsapp") {
    waWindow = window.open("about:blank", "_blank");
  }

  setLoading(button, true, "إرسال الطلب");

  const orderItems = cart.map(item => ({
    id: item.id,
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
    total: getCartTotal(),
    status: "جديد",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection("orders").add(order);

    if (contactChannel === "whatsapp") {
      const phone = normalizeWhatsAppNumber(settings.whatsapp);

      if (!phone) {
        if (waWindow) waWindow.close();

        alert(
          "تم حفظ الطلب، لكن رقم واتساب المتجر غير مضبوط. " +
          "أضف الرقم من لوحة الإدارة."
        );
      } else {
        const message = buildWhatsAppMessage(order);
        const url =
          "https://wa.me/" + phone +
          "?text=" + encodeURIComponent(message);

        if (waWindow) {
          waWindow.location.href = url;
        } else {
          alert("تم حفظ الطلب. افتح الرابط التالي لإكمال الطلب:\n" + url);
          window.location.href = url;
        }
      }
    } else {
      if (waWindow) waWindow.close();

      alert(
        "تم حفظ الطلب بنجاح. " +
        "يرجى متابعة التواصل عبر وسيلة التواصل المختارة."
      );
    }

    cart = [];
    saveCart();

    if ($("customerName")) $("customerName").value = "";
    if ($("customerPhone")) $("customerPhone").value = "";
    if ($("customerAddress")) $("customerAddress").value = "";

    closeModal("checkoutModal");

  } catch (error) {
    console.error("Order error:", error);

    if (waWindow) waWindow.close();

    alert(
      "تعذر حفظ الطلب. تحقق من الإنترنت وصلاحيات قاعدة البيانات."
    );
  } finally {
    setLoading(button, false, "إرسال الطلب");
  }
}

/* ===============================
   13- إضافة منتج
================================ */

async function addProduct() {
  if (!isAdmin()) return;

  const name = $("newName")?.value.trim();
  const price = Number($("newPrice")?.value);
  const category = $("newCategory")?.value.trim();

  if (!name || !Number.isFinite(price) || price < 0 || !category) {
    showMessage("adminMsg", "أدخل اسم المنتج والسعر والقسم بشكل صحيح.");
    return;
  }

  const button = $("addProduct");
  setLoading(button, true, "إضافة المنتج");

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

    showMessage("adminMsg", "تمت إضافة المنتج بنجاح.", true);

  } catch (error) {
    console.error(error);
    showMessage("adminMsg", "فشل إضافة المنتج: " + error.message);
  } finally {
    setLoading(button, false, "إضافة المنتج");
  }
}

/* ===============================
   14- اختيار صورة المنتج
================================ */

function handleProductImage(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("اختر ملف صورة صالحاً.");
    return;
  }

  const reader = new FileReader();

  reader.onload = event => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSize = 700;

      let width = image.width;
      let height = image.height;

      if (width > height && width > maxSize) {
        height = Math.round(height * maxSize / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round(width * maxSize / height);
        height = maxSize;
      }

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
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

/* ===============================
   15- منتجات لوحة الإدارة
================================ */

function renderAdminProducts() {
  const container = $("adminProducts");
  if (!container) return;

  container.innerHTML = products.map(product => `
    <div class="admin-product">
      <div>
        <strong>${esc(product.name)}</strong>
        <p>${money(product.price)} - ${esc(product.category || "")}</p>
      </div>

      <button type="button" data-delete-product="${esc(product.id)}">
        حذف
      </button>
    </div>
  `).join("");

  container.querySelectorAll("[data-delete-product]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.deleteProduct;

      if (!confirm("هل تريد حذف هذا المنتج؟")) return;

      try {
        await db.collection("products").doc(id).delete();
        await loadProducts();

        showMessage("adminMsg", "تم حذف المنتج.", true);
      } catch (error) {
        console.error(error);
        showMessage("adminMsg", "تعذر حذف المنتج.");
      }
    });
  });
}

/* ===============================
   16- تحميل الطلبات
================================ */

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
    const items = (order.items || []).map(item =>
      `${esc(item.name)} × ${Number(item.quantity || 0)}`
    ).join("، ");

    let date = "غير محدد";

    if (order.createdAt?.toDate) {
      date = order.createdAt.toDate().toLocaleString("ar-EG");
    }

    return `
      <article class="admin-order">
        <h3>${esc(order.customerName)}</h3>
        <p>الهاتف: ${esc(order.customerPhone)}</p>
        <p>العنوان: ${esc(order.customerAddress)}</p>
        <p>المنتجات: ${items}</p>
        <p>الإجمالي: ${money(order.total)}</p>
        <p>التواصل: ${esc(order.contactChannel || "")}</p>
        <p>التاريخ: ${esc(date)}</p>

        <label>حالة الطلب:</label>
        <select data-status="${esc(order.id)}">
          <option value="جديد" ${order.status === "جديد" ? "selected" : ""}>جديد</option>
          <option value="قيد التجهيز" ${order.status === "قيد التجهيز" ? "selected" : ""}>قيد التجهيز</option>
          <option value="مكتمل" ${order.status === "مكتمل" ? "selected" : ""}>مكتمل</option>
          <option value="ملغي" ${order.status === "ملغي" ? "selected" : ""}>ملغي</option>
        </select>

        <button type="button" data-delete-order="${esc(order.id)}">
          حذف الطلب
        </button>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-status]").forEach(select => {
    select.addEventListener("change", async () => {
      try {
        await db.collection("orders")
          .doc(select.dataset.status)
          .update({ status: select.value });

        await loadOrders();
      } catch (error) {
        console.error(error);
        alert("تعذر تحديث حالة الطلب.");
      }
    });
  });

  container.querySelectorAll("[data-delete-order]").forEach(button => {
    button.addEventListener("click", async () => {
      if (!confirm("هل تريد حذف الطلب؟")) return;

      try {
        await db.collection("orders")
          .doc(button.dataset.deleteOrder)
          .delete();

        await loadOrders();
      } catch (error) {
        console.error(error);
        alert("تعذر حذف الطلب.");
      }
    });
  });
}

/* ===============================
   17- إحصائيات المبيعات
================================ */

function updateStatistics() {
  const totalOrders = orders.length;
  const newOrders = orders.filter(o => o.status === "جديد").length;
  const completed = orders.filter(o => o.status === "مكتمل").length;

  const revenue = orders
    .filter(o => o.status === "مكتمل")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);

  if ($("statOrders")) $("statOrders").textContent = totalOrders;
  if ($("statNew")) $("statNew").textContent = newOrders;
  if ($("statCompleted")) $("statCompleted").textContent = completed;
  if ($("statRevenue")) $("statRevenue").textContent = money(revenue);
}

/* ===============================
   18- تقرير المبيعات CSV
================================ */

function downloadSalesReport() {
  if (!isAdmin()) return;

  const rows = [
    ["اسم العميل", "الهاتف", "العنوان", "الإجمالي", "الحالة", "التاريخ"]
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
  link.click();

  URL.revokeObjectURL(url);
}

/* ===============================
   19- التنقل بين أقسام الإدارة
================================ */

function setupAdminTabs() {
  document.querySelectorAll("[data-admin-tab]").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.adminTab;

      document.querySelectorAll("[data-admin-panel]").forEach(panel => {
        panel.classList.add("hidden");
      });

      const panel = document.querySelector(
        `[data-admin-panel="${target}"]`
      );

      if (panel) panel.classList.remove("hidden");

      if (target === "orders") loadOrders();
      if (target === "products") renderAdminProducts();
    });
  });
}

/* ===============================
   20- ربط الأزرار
================================ */

function bindEvents() {
  $("adminLogin")?.addEventListener("click", adminLogin);

  $("updateAdminCredentials")?.addEventListener(
    "click",
    updateAdminCredentials
  );

  $("logout")?.addEventListener("click", adminLogout);

  $("saveSettings")?.addEventListener(
    "click",
    saveContactSettings
  );

  $("saveStoreName")?.addEventListener(
    "click",
    saveStoreName
  );

  $("addProduct")?.addEventListener("click", addProduct);

  $("sendOrder")?.addEventListener("click", sendOrder);

  $("search")?.addEventListener("input", renderProducts);

  $("clearCart")?.addEventListener("click", () => {
    if (!cart.length) return;

    if (confirm("هل تريد إفراغ السلة؟")) {
      cart = [];
      saveCart();
    }
  });

  $("checkout")?.addEventListener("click", () => {
    if (!cart.length) {
      alert("السلة فارغة.");
      return;
    }

    openModal("checkoutModal");
  });

  $("openAdmin")?.addEventListener("click", () => {
    openModal("adminModal");
  });

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

  setupAdminTabs();
}

/* ===============================
   21- تشغيل المتجر
================================ */

async function startStore() {
  loadCart();
  bindEvents();
  renderCart();

  await loadSettings();
  await loadProducts();

  auth.onAuthStateChanged(user => {
    adminSessionActive = false;

    if (user && user.uid === ADMIN_UID) {
      // لا يتم فتح الإدارة تلقائياً بمجرد وجود جلسة.
      // يجب تسجيل الدخول من واجهة الإدارة.
    }
  });
}

/* ===============================
   22- بدء التطبيق
================================ */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startStore, {
    once: true
  });
} else {
  startStore();
}
