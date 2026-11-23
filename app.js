
/* =====================================================
   زهرة حماة - التطبيق الرئيسي الكامل
   Firebase + Store + Cart + Orders + Admin + Reports
===================================================== */

// ================= إعدادات Firebase =================

const firebaseConfig = {
  apiKey: "AIzaSyBbS1MzPjkiLEagg97OTVCBa-yABqKt1Gg",
  authDomain: "zahret-hama.firebaseapp.com",
  projectId: "zahret-hama",
  storageBucket: "zahret-hama.firebasestorage.app",
  messagingSenderId: "525184861733",
  appId: "1:525184861733:web:0f5bb1090a2a29754921cc"
};

const ADMIN_UID = "bw9BjGepH9Z04LZ361DLc02QzEl2";

// ================= المتغيرات العامة =================

let db = null;
let auth = null;
let firebaseReady = false;

let products = [];
let orders = [];
let cart = [];

let settings = {
  storeName: "زهرة حماة",
  whatsapp: "",
  facebook: "",
  messenger: ""
};

let activeCategory = "الكل";
let selectedProductImage = "";
let adminSessionActive = false;
let selectedReportMonth = "";

// ================= أدوات مساعدة =================

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

function showMessage(id, message) {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.classList.remove("hidden");

  clearTimeout(element._messageTimer);
  element._messageTimer = setTimeout(() => {
    element.classList.add("hidden");
  }, 4500);
}

function setButtonLoading(button, loading, normalText) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? "جارٍ التنفيذ..." : normalText;
}

function isAdmin() {
  return Boolean(
    adminSessionActive &&
    auth &&
    auth.currentUser &&
    auth.currentUser.uid === ADMIN_UID
  );
}

function getOrderDate(order) {
  const value = order.createdAt;

  if (value && typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value && value.seconds) {
    return new Date(value.seconds * 1000);
  }

  if (value) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
  }

  return new Date(0);
}

function getOrderStatus(order) {
  return order.status || "new";
}

function formatDate(date) {
  if (!date || isNaN(date.getTime())) return "غير محدد";

  return date.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

// ================= تشغيل Firebase =================

try {
  if (!window.firebase) {
    throw new Error("Firebase SDK غير موجود.");
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  db = firebase.firestore();
  auth = firebase.auth();
  firebaseReady = true;

} catch (error) {
  console.error("Firebase initialization error:", error);
  firebaseReady = false;
}

// ================= النوافذ =================

function openModal(id) {
  $(id)?.classList.remove("hidden");
}

function closeModal(id) {
  $(id)?.classList.add("hidden");
}

function resetAdminLogin() {
  if ($("adminEmail")) $("adminEmail").value = "";
  if ($("adminPassword")) $("adminPassword").value = "";

  $("loginPane")?.classList.remove("hidden");
  $("adminPane")?.classList.add("hidden");
}

async function openAdminLogin() {
  adminSessionActive = false;

  if (auth?.currentUser) {
    try {
      await auth.signOut();
    } catch (error) {
      console.error(error);
    }
  }

  resetAdminLogin();
  openModal("adminModal");
}

async function closeAdminAndLogout() {
  adminSessionActive = false;

  try {
    if (auth?.currentUser) {
      await auth.signOut();
    }
  } catch (error) {
    console.error(error);
  }

  closeModal("adminModal");
  resetAdminLogin();
}

// ================= تبويبات الإدارة =================

function showAdminTab(tabId) {
  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.classList.add("hidden");
  });

  $(tabId)?.classList.remove("hidden");

  document.querySelectorAll("[data-admin-tab]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.adminTab === tabId
    );
  });
}

document.querySelectorAll("[data-admin-tab]").forEach(button => {
  button.addEventListener("click", () => {
    if (!isAdmin()) return;
    showAdminTab(button.dataset.adminTab);
  });
});

// ================= تحميل بيانات المتجر =================

async function loadStoreData() {
  if (!firebaseReady) return false;

  try {
    const productSnapshot = await db.collection("products").get();

    products = productSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const settingsDoc = await db.collection("settings")
      .doc("main")
      .get();

    if (settingsDoc.exists) {
      settings = {
        ...settings,
        ...settingsDoc.data()
      };
    }

    renderStoreName();
    renderCategories();
    renderProducts();
    renderCart();

    return true;

  } catch (error) {
    console.error("Store loading error:", error);
    showMessage("storeMsg", "تعذر تحميل بيانات المتجر.");
    return false;
  }
}

function renderStoreName() {
  const name = settings.storeName || "زهرة حماة";

  if ($("storeTitle")) $("storeTitle").textContent = name;
  if ($("footerName")) $("footerName").textContent = name;
  if ($("footerNameBottom")) {
    $("footerNameBottom").textContent = name;
  }
}

// ================= عرض الأقسام =================

function renderCategories() {
  const container = $("categories");
  if (!container) return;

  const categories = [
    "الكل",
    ...new Set(products.map(p => p.category).filter(Boolean))
  ];

  container.innerHTML = categories.map(category => `
    <button
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

// ================= عرض المنتجات =================

function renderProducts() {
  const container = $("products");
  if (!container) return;

  const search = $("search")?.value.trim().toLowerCase() || "";

  const filtered = products.filter(product => {
    const categoryMatch =
      activeCategory === "الكل" ||
      product.category === activeCategory;

    const searchMatch =
      String(product.name || "").toLowerCase().includes(search);

    return categoryMatch && searchMatch;
  });

  if (!filtered.length) {
    container.innerHTML = "<p>لا توجد منتجات حالياً.</p>";
    return;
  }

  container.innerHTML = filtered.map(product => `
    <article class="product-card">
      ${
        product.image
          ? `<img src="${esc(product.image)}" alt="${esc(product.name)}">`
          : `<div class="product-placeholder">لا توجد صورة</div>`
      }

      <h3>${esc(product.name)}</h3>
      <p>${esc(product.category || "")}</p>
      <strong>${money(product.price)}</strong>

      <button data-add-cart="${esc(product.id)}">
        أضف للسلة
      </button>
    </article>
  `).join("");

  container.querySelectorAll("[data-add-cart]").forEach(button => {
    button.addEventListener("click", () => {
      addToCart(button.dataset.addCart);
    });
  });
}

$("search")?.addEventListener("input", renderProducts);

// ================= السلة =================

function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(item => item.id === productId);

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price || 0),
      image: product.image || "",
      quantity: 1
    });
  }

  renderCart();
}

function changeCartQuantity(productId, amount) {
  const item = cart.find(p => p.id === productId);
  if (!item) return;

  item.quantity += amount;

  if (item.quantity <= 0) {
    cart = cart.filter(p => p.id !== productId);
  }

  renderCart();
}

function renderCart() {
  const container = $("cartItems");
  const totalElement = $("total");

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  if (totalElement) totalElement.textContent = money(total);
  if ($("cartCount")) {
    $("cartCount").textContent = cart.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }

  if (!container) return;

  if (!cart.length) {
    container.innerHTML = "<p>السلة فارغة.</p>";
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <span>${esc(item.name)}</span>
      <span>${money(item.price * item.quantity)}</span>

      <button data-minus="${esc(item.id)}">−</button>
      <span>${item.quantity}</span>
      <button data-plus="${esc(item.id)}">+</button>
    </div>
  `).join("");

  container.querySelectorAll("[data-minus]").forEach(button => {
    button.addEventListener("click", () => {
      changeCartQuantity(button.dataset.minus, -1);
    });
  });

  container.querySelectorAll("[data-plus]").forEach(button => {
    button.addEventListener("click", () => {
      changeCartQuantity(button.dataset.plus, 1);
    });
  });
}

$("clearCart")?.addEventListener("click", () => {
  cart = [];
  renderCart();
});

// ================= الصور =================

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("الملف المحدد ليس صورة."));
      return;
    }

    const reader = new FileReader();

    reader.onload = event => {
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement("canvas");

        const maxWidth = 900;
        const scale = Math.min(1, maxWidth / image.width);

        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");
        context.drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height
        );

        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };

      image.onerror = reject;
      image.src = event.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setupImagePicker(inputId) {
  $(inputId)?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      selectedProductImage = await compressImage(file);

      const preview = $("productImagePreview");
      if (preview) {
        preview.src = selectedProductImage;
        preview.classList.remove("hidden");
      }

    } catch (error) {
      console.error(error);
      showMessage("productMsg", "تعذر تحميل الصورة.");
    }
  });
}

$("chooseGallery")?.addEventListener("click", () => {
  $("productImageGallery")?.click();
});

$("takeProductPhoto")?.addEventListener("click", () => {
  $("productImageCamera")?.click();
});

setupImagePicker("productImageGallery");
setupImagePicker("productImageCamera");

$("removeProductImage")?.addEventListener("click", () => {
  selectedProductImage = "";

  if ($("productImagePreview")) {
    $("productImagePreview").src = "";
    $("productImagePreview").classList.add("hidden");
  }

  if ($("productImageGallery")) $("productImageGallery").value = "";
  if ($("productImageCamera")) $("productImageCamera").value = "";
});

// ================= إرسال الطلبات =================

function getContactLink(channel) {
  if (channel === "whatsapp" && settings.whatsapp) {
    const phone = settings.whatsapp.replace(/\D/g, "");
    return `https://wa.me/${phone}`;
  }

  if (channel === "messenger" && settings.messenger) {
    return settings.messenger;
  }

  if (channel === "facebook" && settings.facebook) {
    return settings.facebook;
  }

  return "";
}

function buildOrderMessage(order) {
  const lines = [
    `طلب جديد من ${settings.storeName || "زهرة حماة"}`,
    `الاسم: ${order.customerName}`,
    `الهاتف: ${order.phone}`,
    `العنوان: ${order.address}`,
    "المنتجات:"
  ];

  order.items.forEach(item => {
    lines.push(
      `${item.name} × ${item.quantity} = ${money(item.price * item.quantity)}`
    );
  });

  lines.push(`الإجمالي: ${money(order.total)}`);

  return lines.join("\n");
}

$("checkout")?.addEventListener("click", () => {
  if (!cart.length) {
    alert("السلة فارغة.");
    return;
  }

  openModal("checkoutModal");
});

$("sendOrder")?.addEventListener("click", async function () {
  if (!firebaseReady) {
    showMessage("checkoutMsg", "الاتصال بقاعدة البيانات غير متاح.");
    return;
  }

  if (!cart.length) {
    showMessage("checkoutMsg", "السلة فارغة.");
    return;
  }

  const customerName = $("customerName")?.value.trim() || "";
  const phone = $("customerPhone")?.value.trim() || "";
  const address = $("customerAddress")?.value.trim() || "";
  const channel = $("contactChannel")?.value || "whatsapp";

  if (!customerName || !phone || !address) {
    showMessage("checkoutMsg", "أكمل الاسم ورقم الهاتف والعنوان.");
    return;
  }

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const order = {
    customerName,
    phone,
    address,
    channel,
    items: cart.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    })),
    total,
    status: "new",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const button = this;
  const normalText = button.textContent;

  setButtonLoading(button, true, normalText);

  try {
    await db.collection("orders").add(order);

    const message = buildOrderMessage(order);
    const contactLink = getContactLink(channel);

    cart = [];
    renderCart();
    closeModal("checkoutModal");

    if (contactLink) {
      const separator = contactLink.includes("?") ? "&" : "?";
      const url = channel === "whatsapp"
        ? `${contactLink}?text=${encodeURIComponent(message)}`
        : contactLink;

      window.open(url, "_blank", "noopener");
    } else {
      alert(message);
    }

    if ($("customerName")) $("customerName").value = "";
    if ($("customerPhone")) $("customerPhone").value = "";
    if ($("customerAddress")) $("customerAddress").value = "";

    alert("تم تسجيل طلبك بنجاح.");

  } catch (error) {
    console.error("Order error:", error);
    showMessage("checkoutMsg", "تعذر حفظ الطلب. حاول مرة أخرى.");
  } finally {
    setButtonLoading(button, false, normalText);
  }
});

// ================= تسجيل دخول الإدارة =================

$("openAdmin")?.addEventListener("click", openAdminLogin);

$("closeAdmin")?.addEventListener("click", closeAdminAndLogout);

$("adminLogin")?.addEventListener("click", async function () {
  if (!firebaseReady) {
    showMessage("loginMsg", "خدمة تسجيل الدخول غير متاحة.");
    return;
  }

  const email = $("adminEmail")?.value.trim() || "";
  const password = $("adminPassword")?.value || "";

  if (!email || !password) {
    showMessage("loginMsg", "اكتب البريد الإلكتروني وكلمة المرور.");
    return;
  }

  const button = this;
  const normalText = button.textContent;

  setButtonLoading(button, true, normalText);

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
        "هذا الحساب غير مصرح له بدخول لوحة الإدارة."
      );

      return;
    }

    adminSessionActive = true;

    if ($("adminPassword")) $("adminPassword").value = "";

    $("loginPane")?.classList.add("hidden");
    $("adminPane")?.classList.remove("hidden");

    showAdminTab("tabSales");

    const success = await loadCloud();

    if (success) {
      showMessage("adminMsg", "تم تسجيل الدخول بنجاح.");
    }

  } catch (error) {
    console.error("Admin login error:", error);

    adminSessionActive = false;

    showMessage(
      "loginMsg",
      "تعذر تسجيل الدخول. راجع البريد وكلمة المرور."
    );

  } finally {
    setButtonLoading(button, false, normalText);
  }
});

// ================= تحميل بيانات الإدارة =================

async function loadCloud() {
  if (!isAdmin()) return false;

  try {
    await loadStoreData();

    const snapshot = await db.collection("orders").get();

    orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    orders.sort((a, b) => getOrderDate(b) - getOrderDate(a));

    renderStats();
    renderAdminProducts();
    renderOrders();
    setupMonthlyReports();

    return true;

  } catch (error) {
    console.error("Admin loading error:", error);
    showMessage("adminMsg", "تعذر تحميل بيانات الإدارة.");
    return false;
  }
}

// ================= إحصائيات الإدارة =================

function renderStats() {
  if (!isAdmin()) return;

  const newOrders = orders.filter(
    order => getOrderStatus(order) === "new"
  );

  const completed = orders.filter(
    order => getOrderStatus(order) === "completed"
  );

  const revenue = completed.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0
  );

  if ($("statOrders")) $("statOrders").textContent = orders.length;
  if ($("statNew")) $("statNew").textContent = newOrders.length;
  if ($("statCompleted")) {
    $("statCompleted").textContent = completed.length;
  }
  if ($("statRevenue")) {
    $("statRevenue").textContent = money(revenue);
  }
}

// ================= إدارة المنتجات =================

function renderAdminProducts() {
  if (!isAdmin()) return;

  const container = $("adminProducts");
  if (!container) return;

  container.innerHTML = products.map(product => `
    <div class="admin-product">
      <div>
        <strong>${esc(product.name)}</strong>
        <span>${money(product.price)}</span>
        <small>${esc(product.category || "")}</small>
      </div>

      <button data-delete-product="${esc(product.id)}">
        حذف
      </button>
    </div>
  `).join("");
}

$("adminProducts")?.addEventListener("click", async event => {
  const button = event.target.closest("[data-delete-product]");
  if (!button || !isAdmin()) return;

  const id = button.dataset.deleteProduct;

  if (!confirm("هل تريد حذف هذا المنتج؟")) return;

  try {
    await db.collection("products").doc(id).delete();

    products = products.filter(product => product.id !== id);

    renderAdminProducts();
    renderCategories();
    renderProducts();

    showMessage("adminMsg", "تم حذف المنتج.");

  } catch (error) {
    console.error(error);
    showMessage("adminMsg", "تعذر حذف المنتج.");
  }
});

$("addProduct")?.addEventListener("click", async function () {
  if (!isAdmin()) return;

  const name = $("newName")?.value.trim() || "";
  const price = Number($("newPrice")?.value || 0);
  const category = $("newCategory")?.value.trim() || "";

  if (!name || price <= 0 || !category) {
    showMessage("productMsg", "أدخل اسم المنتج والسعر والقسم.");
    return;
  }

  const button = this;
  const normalText = button.textContent;

  setButtonLoading(button, true, normalText);

  try {
    const product = {
      name,
      price,
      category,
      image: selectedProductImage || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const doc = await db.collection("products").add(product);

    products.push({
      id: doc.id,
      ...product
    });

    if ($("newName")) $("newName").value = "";
    if ($("newPrice")) $("newPrice").value = "";
    if ($("newCategory")) $("newCategory").value = "";

    selectedProductImage = "";

    if ($("productImagePreview")) {
      $("productImagePreview").src = "";
      $("productImagePreview").classList.add("hidden");
    }

    renderAdminProducts();
    renderCategories();
    renderProducts();

    showMessage("productMsg", "تمت إضافة المنتج بنجاح.");

  } catch (error) {
    console.error(error);
    showMessage("productMsg", "تعذر إضافة المنتج.");
  } finally {
    setButtonLoading(button, false, normalText);
  }
});

// ================= إدارة الطلبات =================

function renderOrders() {
  if (!isAdmin()) return;

  const container = $("adminOrders");
  if (!container) return;

  if (!orders.length) {
    container.innerHTML = "<p>لا توجد طلبات حتى الآن.</p>";
    return;
  }

  container.innerHTML = orders.map(order => {
    const status = getOrderStatus(order);

    const items = (order.items || []).map(item => `
      <li>
        ${esc(item.name)} × ${Number(item.quantity || 1)}
      </li>
    `).join("");

    return `
      <div class="admin-order">
        <h3>طلب رقم ${esc(order.id.slice(0, 8))}</h3>

        <p>الاسم: ${esc(order.customerName)}</p>
        <p>الهاتف: ${esc(order.phone)}</p>
        <p>العنوان: ${esc(order.address)}</p>
        <p>التاريخ: ${formatDate(getOrderDate(order))}</p>
        <p>الإجمالي: ${money(order.total)}</p>
        <p>الحالة: ${esc(status)}</p>

        <ul>${items}</ul>

        <button data-order-status="completed"
          data-order-id="${esc(order.id)}">
          مكتمل
        </button>

        <button data-order-status="new"
          data-order-id="${esc(order.id)}">
          جديد
        </button>

        <button data-order-status="cancelled"
          data-order-id="${esc(order.id)}">
          إلغاء الطلب
        </button>
      </div>
    `;
  }).join("");
}

$("adminOrders")?.addEventListener("click", async event => {
  const button = event.target.closest("[data-order-status]");
  if (!button || !isAdmin()) return;

  const id = button.dataset.orderId;
  const status = button.dataset.orderStatus;

  try {
    await db.collection("orders").doc(id).update({ status });

    const order = orders.find(item => item.id === id);
    if (order) order.status = status;

    renderOrders();
    renderStats();
    renderMonthlyReport();

    showMessage("adminMsg", "تم تحديث حالة الطلب.");

  } catch (error) {
    console.error(error);
    showMessage("adminMsg", "تعذر تحديث حالة الطلب.");
  }
});

// ================= إعدادات التواصل =================

$("saveSettings")?.addEventListener("click", async function () {
  if (!isAdmin()) return;

  const whatsapp = $("editWhatsapp")?.value.trim() || "";
  const facebook = $("editFacebook")?.value.trim() || "";
  const messenger = $("editMessenger")?.value.trim() || "";

  try {
    await db.collection("settings").doc("main").set({
      ...settings,
      whatsapp,
      facebook,
      messenger
    }, { merge: true });

    settings.whatsapp = whatsapp;
    settings.facebook = facebook;
    settings.messenger = messenger;

    showMessage("settingsMsg", "تم حفظ إعدادات التواصل.");

  } catch (error) {
    console.error(error);
    showMessage("settingsMsg", "تعذر حفظ الإعدادات.");
  }
});

// ================= اسم المتجر =================

$("saveStoreName")?.addEventListener("click", async function () {
  if (!isAdmin()) return;

  const name = $("editStoreName")?.value.trim() || "";

  if (!name) {
    showMessage("settingsMsg", "اكتب اسم المتجر.");
    return;
  }

  try {
    await db.collection("settings").doc("main").set({
      storeName: name
    }, { merge: true });

    settings.storeName = name;
    renderStoreName();

    showMessage("settingsMsg", "تم تحديث اسم المتجر.");

  } catch (error) {
    console.error(error);
    showMessage("settingsMsg", "تعذر تحديث اسم المتجر.");
  }
});

// ================= تحديث بيانات حساب الإدارة =================

$("updateAdminCredentials")?.addEventListener("click", async function () {
  if (!isAdmin()) return;

  const email = $("newAdminEmail")?.value.trim() || "";
  const password = $("newAdminPassword")?.value || "";

  if (!email && !password) {
    showMessage("settingsMsg", "أدخل البريد الجديد أو كلمة المرور الجديدة.");
    return;
  }

  try {
    const user = auth.currentUser;

    if (email) {
      await user.updateEmail(email);
    }

    if (password) {
      if (password.length < 6) {
        showMessage("settingsMsg", "كلمة المرور يجب ألا تقل عن 6 أحرف.");
        return;
      }

      await user.updatePassword(password);
    }

    if ($("newAdminEmail")) $("newAdminEmail").value = "";
    if ($("newAdminPassword")) $("newAdminPassword").value = "";

    showMessage("settingsMsg", "تم تحديث بيانات الدخول.");

  } catch (error) {
    console.error(error);

    if (error.code === "auth/requires-recent-login") {
      showMessage(
        "settingsMsg",
        "لأمان الحساب، سجّل الخروج ثم ادخل مجدداً قبل تغيير بيانات الدخول."
      );
    } else {
      showMessage("settingsMsg", "تعذر تحديث بيانات الحساب.");
    }
  }
});

// ================= التقارير الشهرية =================

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long"
  });
}

function getMonthlyOrders() {
  return orders.filter(order => {
    const date = getOrderDate(order);
    return monthKey(date) === selectedReportMonth;
  });
}

function setupMonthlyReports() {
  if (!isAdmin()) return;

  let navButton = document.getElementById("tabMonthlyReports");

  if (!navButton) {
    const nav = document.querySelector("[data-admin-tab]")?.parentElement;

    if (nav) {
      navButton = document.createElement("button");
      navButton.id = "tabMonthlyReports";
      navButton.type = "button";
      navButton.dataset.adminTab = "monthlyReports";
      navButton.textContent = "التقارير الشهرية";
      nav.appendChild(navButton);
    }
  }

  if (navButton) {
    navButton.onclick = () => {
      if (!isAdmin()) return;
      showAdminTab("monthlyReports");
      renderMonthlyReport();
    };
  }

  let section = $("monthlyReports");

  if (!section) {
    section = document.createElement("section");
    section.id = "monthlyReports";
    section.className = "admin-tab hidden";

    const adminPane = $("adminPane");
    if (!adminPane) return;

    section.innerHTML = `
      <h2>التقارير الشهرية</h2>

      <div class="monthly-report-controls">
        <label for="reportMonth">اختر الشهر</label>
        <select id="reportMonth"></select>

        <button id="refreshMonthlyReport" type="button">
          تحديث التقرير
        </button>

        <button id="downloadMonthlyReport" type="button">
          تحميل تقرير Excel
        </button>
      </div>

      <div class="monthly-report-stats">
        <div>
          <span>عدد الطلبات</span>
          <strong id="monthOrders">0</strong>
        </div>

        <div>
          <span>الطلبات الجديدة</span>
          <strong id="monthNew">0</strong>
        </div>

        <div>
          <span>الطلبات المكتملة</span>
          <strong id="monthCompleted">0</strong>
        </div>

        <div>
          <span>الطلبات الملغاة</span>
          <strong id="monthCancelled">0</strong>
        </div>

        <div>
          <span>إجمالي قيمة الطلبات</span>
          <strong id="monthTotal">0</strong>
        </div>

        <div>
          <span>إيرادات الطلبات المكتملة</span>
          <strong id="monthRevenue">0</strong>
        </div>
      </div>

      <div id="monthlyReportDetails"></div>
    `;

    adminPane.appendChild(section);
  }

  const select = $("reportMonth");
  if (!select) return;

  const months = new Set([monthKey(new Date())]);

  orders.forEach(order => {
    const date = getOrderDate(order);
    if (date.getTime() > 0) months.add(monthKey(date));
  });

  const sortedMonths = [...months].sort().reverse();

  if (!selectedReportMonth || !months.has(selectedReportMonth)) {
    selectedReportMonth = sortedMonths[0];
  }

  select.innerHTML = sortedMonths.map(key => `
    <option value="${key}" ${key === selectedReportMonth ? "selected" : ""}>
      ${monthLabel(key)}
    </option>
  `).join("");

  select.onchange = () => {
    selectedReportMonth = select.value;
    renderMonthlyReport();
  };

  $("refreshMonthlyReport").onclick = refreshMonthlyReport;
  $("downloadMonthlyReport").onclick = downloadMonthlyExcel;

  renderMonthlyReport();
}

function renderMonthlyReport() {
  if (!isAdmin()) return;

  const monthlyOrders = getMonthlyOrders();

  const newOrders = monthlyOrders.filter(
    order => getOrderStatus(order) === "new"
  );

  const completed = monthlyOrders.filter(
    order => getOrderStatus(order) === "completed"
  );

  const cancelled = monthlyOrders.filter(
    order => getOrderStatus(order) === "cancelled"
  );

  const total = monthlyOrders.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0
  );

  const revenue = completed.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0
  );

  if ($("monthOrders")) $("monthOrders").textContent = monthlyOrders.length;
  if ($("monthNew")) $("monthNew").textContent = newOrders.length;
  if ($("monthCompleted")) {
    $("monthCompleted").textContent = completed.length;
  }
  if ($("monthCancelled")) {
    $("monthCancelled").textContent = cancelled.length;
  }
  if ($("monthTotal")) $("monthTotal").textContent = money(total);
  if ($("monthRevenue")) {
    $("monthRevenue").textContent = money(revenue);
  }

  const details = $("monthlyReportDetails");
  if (!details) return;

  if (!monthlyOrders.length) {
    details.innerHTML = "<p>لا توجد طلبات في هذا الشهر.</p>";
    return;
  }

  details.innerHTML = `
    <h3>تفاصيل طلبات ${monthLabel(selectedReportMonth)}</h3>

    ${monthlyOrders.map(order => `
      <div class="monthly-order">
        <strong>${esc(order.customerName || "عميل")}</strong>
        <span>${money(order.total)}</span>
        <span>${esc(getOrderStatus(order))}</span>
        <small>${formatDate(getOrderDate(order))}</small>
      </div>
    `).join("")}
  `;
}

// تحديث بيانات الطلبات من Firebase ثم تحديث التقرير

async function refreshMonthlyReport() {
  if (!isAdmin()) return;

  const button = $("refreshMonthlyReport");
  const normalText = button?.textContent || "تحديث التقرير";

  setButtonLoading(button, true, normalText);

  try {
    const snapshot = await db.collection("orders").get();

    orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    orders.sort((a, b) => getOrderDate(b) - getOrderDate(a));

    renderStats();
    renderOrders();
    setupMonthlyReports();

    showMessage("adminMsg", "تم تحديث التقارير والطلبات بنجاح.");

  } catch (error) {
    console.error("Monthly report refresh error:", error);
    showMessage("adminMsg", "تعذر تحديث التقرير.");
  } finally {
    setButtonLoading(button, false, normalText);
  }
}

// تحميل التقرير بصيغة CSV المتوافقة مع Excel

function downloadMonthlyExcel() {
  if (!isAdmin()) return;

  const monthlyOrders = getMonthlyOrders();

  const rows = [
    ["الاسم", "الهاتف", "العنوان", "التاريخ", "الحالة", "الإجمالي"]
  ];

  monthlyOrders.forEach(order => {
    rows.push([
      order.customerName || "",
      order.phone || "",
      order.address || "",
      formatDate(getOrderDate(order)),
      getOrderStatus(order),
      Number(order.total || 0)
    ]);
  });

  const csv = "\uFEFF" + rows.map(row =>
    row.map(value =>
      `"${String(value).replace(/"/g, '""')}"`
    ).join(",")
  ).join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `تقرير-زهرة-حماة-${selectedReportMonth}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

// ================= تسجيل الخروج =================

$("logout")?.addEventListener("click", closeAdminAndLogout);

// لا تحتفظ بجلسة إدارة قديمة عند إعادة تحميل الصفحة
if (auth) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      adminSessionActive = false;
      return;
    }

    if (user.uid !== ADMIN_UID) {
      adminSessionActive = false;
      auth.signOut().catch(console.error);
    }
  });
}

// ================= تشغيل المتجر =================

async function startStore() {
  if (!firebaseReady) {
    console.error("Firebase is not ready.");
    return;
  }

  await loadStoreData();
}

document.addEventListener("DOMContentLoaded", startStore);
