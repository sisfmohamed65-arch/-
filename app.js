// ==========================================
// زهرة حماة - التطبيق الرئيسي الكامل
// ==========================================

// Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBbS1MzPjkiLEagg97OTVCBa-yABqKt1Gg",
  authDomain: "zahret-hama.firebaseapp.com",
  projectId: "zahret-hama",
  storageBucket: "zahret-hama.firebasestorage.app",
  messagingSenderId: "525184861733",
  appId: "1:525184861733:web:0f5bb1090a2a29754921cc"
};

const ADMIN_UID = "bw9BjGepH9Z04LZ361DLc02QzEl2";

// ==========================================
// المتغيرات
// ==========================================

let db = null;
let auth = null;
let firebaseReady = false;

let products = [];
let orders = [];
let cart = {};

let settings = {
  name: "زهرة حماة",
  whatsapp: "",
  facebook: "",
  messenger: ""
};

let activeCategory = "الكل";
let selectedProductImage = "";
let adminSessionActive = false;

const $ = id => document.getElementById(id);

const money = value =>
  Number(value || 0).toLocaleString("ar-EG", {
    maximumFractionDigits: 2
  });

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function showMessage(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

function isAdmin() {
  return !!(
    adminSessionActive &&
    auth &&
    auth.currentUser &&
    auth.currentUser.uid === ADMIN_UID
  );
}

function setButtonLoading(button, loading, normalText) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? "جاري التنفيذ..." : normalText;
}

// ==========================================
// تهيئة Firebase
// ==========================================

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
  alert("تعذر تشغيل Firebase. راجع اتصال الإنترنت وإعدادات الموقع.");
}

// ==========================================
// النوافذ
// ==========================================

function openModal(id) {
  const modal = $(id);
  if (modal) modal.classList.remove("hidden");
}

function closeModal(id) {
  const modal = $(id);
  if (modal) modal.classList.add("hidden");
}

function resetAdminLogin() {
  adminSessionActive = false;

  if ($("adminPassword")) $("adminPassword").value = "";
  if ($("adminEmail")) $("adminEmail").value = "";

  $("adminPane")?.classList.add("hidden");
  $("loginPane")?.classList.remove("hidden");

  showMessage("loginMsg", "");
  showMessage("adminMsg", "");
}

async function closeAdminAndLogout() {
  resetAdminLogin();
  closeModal("adminModal");

  try {
    if (auth && auth.currentUser) {
      await auth.signOut();
    }
  } catch (error) {
    console.error("Logout error:", error);
  }
}

if ($("openAdmin")) {
  $("openAdmin").addEventListener("click", async () => {
    resetAdminLogin();
    openModal("adminModal");

    try {
      if (auth && auth.currentUser) {
        await auth.signOut();
      }
    } catch (error) {
      console.error(error);
    }
  });
}

if ($("closeAdmin")) {
  $("closeAdmin").addEventListener("click", closeAdminAndLogout);
}

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    const id = button.dataset.close;

    if (id === "adminModal") {
      closeAdminAndLogout();
    } else {
      closeModal(id);
    }
  });
});

["adminModal", "checkoutModal"].forEach(id => {
  const modal = $(id);
  if (!modal) return;

  modal.addEventListener("click", event => {
    if (event.target !== modal) return;

    if (id === "adminModal") {
      closeAdminAndLogout();
    } else {
      closeModal(id);
    }
  });
});

// ==========================================
// أقسام الإدارة
// ==========================================

function showAdminTab(tabId) {
  if (!isAdmin()) return;

  document.querySelectorAll(".admin-tab").forEach(section => {
    section.classList.toggle("hidden", section.id !== tabId);
  });

  document.querySelectorAll("[data-admin-tab]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.adminTab === tabId
    );
  });
}

document.querySelectorAll("[data-admin-tab]").forEach(button => {
  button.addEventListener("click", () => {
    showAdminTab(button.dataset.adminTab);
  });
});

// ==========================================
// تحميل بيانات المتجر
// ==========================================

async function loadStoreData() {
  if (!firebaseReady) return false;

  try {
    const snapshot = await db.collection("products").get();

    products = snapshot.docs.map(doc => {
      const data = doc.data();

      return {
        id: doc.id,
        ...data,
        name: data.name || "منتج",
        price: Number(data.price || 0),
        category: data.category || "أخرى",
        image: data.image || data.image_url || "",
        emoji: "🛍️"
      };
    });

    const settingsDoc = await db
      .collection("settings")
      .doc("main")
      .get();

    if (settingsDoc.exists) {
      const data = settingsDoc.data();

      settings = {
        name: data.name || "زهرة حماة",
        whatsapp: data.whatsapp || "",
        facebook: data.facebook || "",
        messenger: data.messenger || ""
      };
    }

    render();
    return true;

  } catch (error) {
    console.error("Store loading error:", error);
    return false;
  }
}

// ==========================================
// عرض المتجر
// ==========================================

function render() {
  if ($("storeTitle")) $("storeTitle").textContent = settings.name;
  if ($("footerName")) $("footerName").textContent = settings.name;
  if ($("footerNameBottom")) {
    $("footerNameBottom").textContent = settings.name;
  }

  renderCategories();
  renderProducts();
  renderCart();
}

function renderCategories() {
  if (!$("categories")) return;

  const categories = [
    "الكل",
    ...new Set(products.map(p => p.category).filter(Boolean))
  ];

  if (!categories.includes(activeCategory)) {
    activeCategory = "الكل";
  }

  $("categories").innerHTML = categories.map(category => `
    <button type="button"
      class="chip ${activeCategory === category ? "active" : ""}"
      data-cat="${esc(category)}">
      ${esc(category)}
    </button>
  `).join("");
}

function renderProducts() {
  if (!$("products")) return;

  const query = $("search")
    ? $("search").value.trim().toLowerCase()
    : "";

  const shown = products.filter(product => {
    const categoryMatch =
      activeCategory === "الكل" ||
      product.category === activeCategory;

    const searchMatch =
      String(product.name).toLowerCase().includes(query);

    return categoryMatch && searchMatch;
  });

  $("products").innerHTML = shown.length
    ? shown.map(product => `
      <article class="product">
        ${
          product.image
            ? `<img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">`
            : `<div class="placeholder">${product.emoji}</div>`
        }

        <h3>${esc(product.name)}</h3>
        <div class="price">${money(product.price)} جنيه</div>

        <button type="button"
          class="primary"
          data-add="${esc(product.id)}">
          أضف للسلة
        </button>
      </article>
    `).join("")
    : `<p class="muted">${
        products.length
          ? "مفيش منتجات مطابقة للبحث."
          : "لا توجد منتجات حاليًا."
      }</p>`;
}

if ($("products")) {
  $("products").addEventListener("click", event => {
    const button = event.target.closest("[data-add]");
    if (!button) return;

    const id = button.dataset.add;

    if (!products.some(p => p.id === id)) return;

    cart[id] = (cart[id] || 0) + 1;
    renderCart();
  });
}

if ($("categories")) {
  $("categories").addEventListener("click", event => {
    const button = event.target.closest("[data-cat]");
    if (!button) return;

    activeCategory = button.dataset.cat;
    renderCategories();
    renderProducts();
  });
}

if ($("search")) {
  $("search").addEventListener("input", renderProducts);
}

// ==========================================
// السلة
// ==========================================

function getCartEntries() {
  return Object.entries(cart).filter(([, qty]) => Number(qty) > 0);
}

function getCartTotal() {
  return getCartEntries().reduce((sum, [id, qty]) => {
    const product = products.find(p => p.id === id);

    return sum + (
      product
        ? product.price * Number(qty)
        : 0
    );
  }, 0);
}

function renderCart() {
  if (!$("cartItems")) return;

  const entries = getCartEntries();

  const count = entries.reduce(
    (sum, [, qty]) => sum + Number(qty),
    0
  );

  if ($("cartCount")) $("cartCount").textContent = count;
  if ($("total")) $("total").textContent = money(getCartTotal());

  $("cartItems").innerHTML = entries.length
    ? entries.map(([id, qty]) => {
        const product = products.find(p => p.id === id);
        if (!product) return "";

        return `
          <div class="cart-row">
            <span>
              ${esc(product.name)} — ${money(product.price)} جنيه
            </span>

            <span class="qty">
              <button type="button" data-minus="${esc(id)}">−</button>
              ${Number(qty)}
              <button type="button" data-plus="${esc(id)}">+</button>
            </span>
          </div>
        `;
      }).join("")
    : `<p class="muted">السلة لسه فاضية.</p>`;
}

if ($("cartItems")) {
  $("cartItems").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;

    const id = button.dataset.plus || button.dataset.minus;
    if (!id) return;

    cart[id] = (cart[id] || 0) + (
      button.dataset.plus ? 1 : -1
    );

    if (cart[id] <= 0) delete cart[id];

    renderCart();
  });
}

if ($("clearCart")) {
  $("clearCart").addEventListener("click", () => {
    cart = {};
    renderCart();
  });
}

// ==========================================
// الصور - ضغط الصورة قبل الحفظ
// ==========================================

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("الملف المختار ليس صورة."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
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

        resolve(
          canvas.toDataURL("image/jpeg", 0.72)
        );
      };

      image.onerror = () => reject(
        new Error("تعذر قراءة الصورة.")
      );

      image.src = reader.result;
    };

    reader.onerror = () => reject(
      new Error("تعذر تحميل الصورة.")
    );

    reader.readAsDataURL(file);
  });
}

function setupImagePicker() {
  const gallery = $("productImageGallery");
  const camera = $("productImageCamera");

  if ($("chooseGallery") && gallery) {
    $("chooseGallery").addEventListener("click", () => {
      gallery.click();
    });
  }

  if ($("takeProductPhoto") && camera) {
    $("takeProductPhoto").addEventListener("click", () => {
      camera.click();
    });
  }

  async function handleImage(file) {
    if (!file) return;

    try {
      selectedProductImage = await compressImage(file);

      if ($("productImagePreview")) {
        $("productImagePreview").src = selectedProductImage;
        $("productImagePreview").classList.remove("hidden");
      }

      $("removeProductImage")?.classList.remove("hidden");

    } catch (error) {
      alert(error.message || "تعذر تجهيز الصورة.");
    }
  }

  gallery?.addEventListener("change", () => {
    handleImage(gallery.files?.[0]);
  });

  camera?.addEventListener("change", () => {
    handleImage(camera.files?.[0]);
  });

  $("removeProductImage")?.addEventListener("click", () => {
    selectedProductImage = "";

    if ($("productImagePreview")) {
      $("productImagePreview").src = "";
      $("productImagePreview").classList.add("hidden");
    }

    $("removeProductImage").classList.add("hidden");

    if (gallery) gallery.value = "";
    if (camera) camera.value = "";
  });
}

setupImagePicker();

// ==========================================
// نسخ رسالة الطلب
// ==========================================

async function copyOrderMessage(message) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(message);
      return true;
    }
  } catch (error) {
    console.warn("Clipboard API unavailable:", error);
  }

  const textarea = document.createElement("textarea");

  textarea.value = message;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.left = "-9999px";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch (error) {
    console.warn("Copy fallback failed:", error);
  }

  textarea.remove();
  return copied;
}

// ==========================================
// إتمام الطلب
// ==========================================

if ($("checkout")) {
  $("checkout").addEventListener("click", event => {
    event.preventDefault();

    if (!getCartEntries().length) {
      alert("ضيف منتجات للسلة الأول.");
      return;
    }

    openModal("checkoutModal");
  });
}

if ($("sendOrder")) {
  $("sendOrder").addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();

    const button = $("sendOrder");

    if (button.disabled) return;

    const name = $("customerName")?.value.trim() || "";
    const phone = $("customerPhone")?.value.trim() || "";
    const address = $("customerAddress")?.value.trim() || "";
    const channel = $("contactChannel")?.value || "";

    if (!name || !phone || !address) {
      alert("اكتب الاسم ورقم الموبايل والعنوان.");
      return;
    }

    if (name.length < 2 || phone.length < 7 || address.length < 5) {
      alert("راجع الاسم ورقم الهاتف والعنوان.");
      return;
    }

    if (!["whatsapp", "messenger", "facebook"].includes(channel)) {
      alert("اختار وسيلة تواصل صحيحة.");
      return;
    }

    if (!firebaseReady) {
      alert("تعذر الاتصال بقاعدة البيانات.");
      return;
    }

    if (!getCartEntries().length) {
      alert("السلة فارغة. أضف المنتجات أولاً.");
      return;
    }

    const destination =
      channel === "whatsapp"
        ? settings.whatsapp
        : channel === "messenger"
          ? settings.messenger
          : settings.facebook;

    if (!destination) {
      alert("وسيلة التواصل المختارة غير مضافة في إعدادات المتجر.");
      return;
    }

    const items = getCartEntries().map(([id, qty]) => {
      const product = products.find(p => p.id === id);

      if (!product) return null;

      return {
        productId: id,
        name: product.name,
        price: Number(product.price),
        quantity: Number(qty)
      };
    }).filter(Boolean);

    if (!items.length) {
      alert("السلة فارغة أو المنتجات لم تعد متاحة.");
      return;
    }

    const total = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const message = `طلب جديد من ${settings.name}
الاسم: ${name}
الموبايل: ${phone}
العنوان: ${address}

${items.map(item =>
  `• ${item.name} × ${item.quantity} = ${money(item.price * item.quantity)} جنيه`
).join("\n")}

الإجمالي: ${money(total)} جنيه`;

    let contactUrl = "";

    if (channel === "whatsapp") {
      const digits = String(settings.whatsapp).replace(/\D/g, "");

      if (!digits) {
        alert("رقم واتساب غير صحيح. راجع إعدادات المتجر.");
        return;
      }

      contactUrl =
        `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

    } else {
      try {
        const parsed = new URL(destination);

        if (!["https:", "http:"].includes(parsed.protocol)) {
          throw new Error("رابط غير صالح.");
        }

        contactUrl = parsed.href;

      } catch (error) {
        alert("رابط التواصل غير صحيح. راجعه من إعدادات المتجر.");
        return;
      }
    }

    const normalText = button.textContent;

    // فتح نافذة أثناء ضغطة المستخدم لتقليل منع النوافذ المنبثقة
    let contactWindow = null;

    try {
      contactWindow = window.open("about:blank", "_blank");
    } catch (error) {
      console.warn("Popup error:", error);
    }

    button.disabled = true;
    button.textContent = "جاري تسجيل الطلب...";

    try {
      await db.collection("orders").add({
        customerName: name,
        phone,
        address,
        channel,
        items,
        total,
        status: "new",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      let copied = false;

      if (channel !== "whatsapp") {
        copied = await copyOrderMessage(message);
      }

      if (contactWindow && !contactWindow.closed) {
        contactWindow.location.href = contactUrl;
      } else {
        window.location.href = contactUrl;
      }

      cart = {};
      renderCart();

      $("customerName").value = "";
      $("customerPhone").value = "";
      $("customerAddress").value = "";

      closeModal("checkoutModal");

      if (channel !== "whatsapp") {
        alert(
          copied
            ? "تم حفظ الطلب ونسخ التفاصيل. الصق الرسالة في المحادثة."
            : "تم حفظ الطلب. افتح المحادثة وانسخ تفاصيله من لوحة الإدارة."
        );
      }

    } catch (error) {
      console.error("Order sending error:", error);

      if (contactWindow && !contactWindow.closed) {
        contactWindow.close();
      }

      alert(
        "تعذر تسجيل الطلب. راجع اتصال الإنترنت وقواعد Firebase، ثم حاول مرة أخرى."
      );

    } finally {
      button.disabled = false;
      button.textContent = normalText;
    }
  });
}

// ==========================================
// منع إعادة تحميل الصفحة عند الضغط على Enter
// ==========================================

if ($("checkoutModal")) {
  $("checkoutModal").addEventListener("submit", event => {
    event.preventDefault();
  });
}

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
      showMessage("loginMsg", "اكتب البريد الإلكتروني وكلمة المرور.");
      return;
    }

    const button = $("adminLogin");
    const normalText = button.textContent;

    setButtonLoading(button, true, normalText);

    try {
      const result = await auth.signInWithEmailAndPassword(
        email,
        password
      );

      if (result.user.uid !== ADMIN_UID) {
        await auth.signOut();

        showMessage(
          "loginMsg",
          "هذا الحساب غير مصرح له بدخول الإدارة."
        );

        return;
      }

      adminSessionActive = true;

      $("adminPassword").value = "";

      $("loginPane").classList.add("hidden");
      $("adminPane").classList.remove("hidden");

      showAdminTab("tabSales");

      const success = await loadCloud();

      if (success) {
        showMessage(
          "adminMsg",
          "تم تسجيل الدخول بنجاح."
        );
      }

    } catch (error) {
      console.error("Admin login error:", error);
      showMessage(
        "loginMsg",
        "تعذر تسجيل الدخول. راجع البريد وكلمة المرور."
      );
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

    orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

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

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  if (value.seconds) {
    return value.seconds * 1000;
  }

  const date = new Date(value).getTime();

  return Number.isFinite(date) ? date : 0;
}

function getOrderStatus(order) {
  const status = String(order.status || "new").toLowerCase();

  if (status === "completed" || status === "مكتمل") {
    return "completed";
  }

  if (status === "cancelled" || status === "ملغي" || status === "ملغى") {
    return "cancelled";
  }

  return "new";
}

// ==========================================
// إحصائيات الإدارة
// ==========================================

function renderStats() {
  const completed = orders.filter(
    order => getOrderStatus(order) === "completed"
  );

  const newOrders = orders.filter(
    order => getOrderStatus(order) === "new"
  );

  const revenue = completed.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0
  );

  if ($("statOrders")) {
    $("statOrders").textContent = orders.length;
  }

  if ($("statNew")) {
    $("statNew").textContent = newOrders.length;
  }

  if ($("statCompleted")) {
    $("statCompleted").textContent = completed.length;
  }

  if ($("statRevenue")) {
    $("statRevenue").textContent = money(revenue);
  }
}

// ==========================================
// عرض المنتجات داخل الإدارة
// ==========================================

function renderAdminProducts() {
  if (!$("adminProducts")) return;

  $("adminProducts").innerHTML = products.length
    ? products.map(product => `
      <div class="admin-product">
        <strong>${esc(product.name)}</strong>
        <span>${money(product.price)} جنيه</span>
        <button type="button"
          class="danger"
          data-delete-product="${esc(product.id)}">
          حذف
        </button>
      </div>
    `).join("")
    : `<p class="muted">لا توجد منتجات.</p>`;
}

if ($("adminProducts")) {
  $("adminProducts").addEventListener("click", async event => {
    const button = event.target.closest("[data-delete-product]");
    if (!button || !isAdmin()) return;

    const id = button.dataset.deleteProduct;

    if (!confirm("هل تريد حذف هذا المنتج؟")) return;

    try {
      await db.collection("products").doc(id).delete();

      products = products.filter(product => product.id !== id);

      render();
      renderAdminProducts();

      showMessage("adminMsg", "تم حذف المنتج.");

    } catch (error) {
      console.error(error);
      alert("تعذر حذف المنتج.");
    }
  });
}

// ==========================================
// إضافة منتج
// ==========================================

if ($("addProduct")) {
  $("addProduct").addEventListener("click", async () => {
    if (!isAdmin()) return;

    const name = $("newName")?.value.trim() || "";
    const price = Number($("newPrice")?.value);
    const category = $("newCategory")?.value.trim() || "أخرى";

    if (name.length < 2 || !Number.isFinite(price) || price < 0) {
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
        name,
        price,
        category,
        image: selectedProductImage || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      const doc = await db.collection("products").add(productData);

      products.push({
        id: doc.id,
        ...productData
      });

      if ($("newName")) $("newName").value = "";
      if ($("newPrice")) $("newPrice").value = "";
      if ($("newCategory")) $("newCategory").value = "";

      selectedProductImage = "";

      if ($("productImagePreview")) {
        $("productImagePreview").src = "";
        $("productImagePreview").classList.add("hidden");
      }

      $("removeProductImage")?.classList.add("hidden");

      if ($("productImageGallery")) $("productImageGallery").value = "";
      if ($("productImageCamera")) $("productImageCamera").value = "";

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
}

// ==========================================
// عرض الطلبات
// ==========================================

function renderOrders() {
  if (!$("adminOrders")) return;

  $("adminOrders").innerHTML = orders.length
    ? orders.map(order => {
        const status = getOrderStatus(order);

        const statusText = {
          new: "جديد",
          completed: "مكتمل",
          cancelled: "ملغي"
        }[status];

        const date = getOrderDate(order)
          ? new Date(getOrderDate(order)).toLocaleString("ar-EG")
          : "غير محدد";

        const items = Array.isArray(order.items)
          ? order.items.map(item =>
              `${esc(item.name)} × ${Number(item.quantity || 1)}`
            ).join("، ")
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
              ${status !== "completed" ? `
                <button type="button"
                  data-order-status="completed"
                  data-order-id="${esc(order.id)}">
                  إكمال الطلب
                </button>
              ` : ""}

              ${status !== "cancelled" ? `
                <button type="button"
                  class="danger"
                  data-order-status="cancelled"
                  data-order-id="${esc(order.id)}">
                  إلغاء الطلب
                </button>
              ` : ""}
            </div>
          </div>
        `;
      }).join("")
    : `<p class="muted">لا توجد طلبات حتى الآن.</p>`;
}

if ($("adminOrders")) {
  $("adminOrders").addEventListener("click", async event => {
    const button = event.target.closest("[data-order-status]");
    if (!button || !isAdmin()) return;

    const id = button.dataset.orderId;
    const status = button.dataset.orderStatus;

    if (!["completed", "cancelled"].includes(status)) return;

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
      alert("تعذر تحديث الطلب. راجع قواعد Firebase.");
    }
  });
}

// ==========================================
// إعدادات التواصل
// ==========================================

if ($("saveSettings")) {
  $("saveSettings").addEventListener("click", async () => {
    if (!isAdmin()) return;

    try {
      const updated = {
        whatsapp: $("editWhatsapp")?.value.trim() || "",
        facebook: $("editFacebook")?.value.trim() || "",
        messenger: $("editMessenger")?.value.trim() || ""
      };

      await db.collection("settings").doc("main").set(
        updated,
        { merge: true }
      );

      settings = { ...settings, ...updated };

      showMessage("adminMsg", "تم حفظ وسائل التواصل.");

    } catch (error) {
      console.error(error);
      alert("تعذر حفظ الإعدادات.");
    }
  });
}

// ==========================================
// تغيير اسم المتجر
// ==========================================

if ($("saveStoreName")) {
  $("saveStoreName").addEventListener("click", async () => {
    if (!isAdmin()) return;

    const name = $("editStoreName")?.value.trim() || "";

    if (name.length < 2) {
      alert("اكتب اسمًا صحيحًا للمتجر.");
      return;
    }

    try {
      await db.collection("settings").doc("main").set(
        { name },
        { merge: true }
      );

      settings.name = name;
      render();

      showMessage("adminMsg", "تم تغيير اسم المتجر.");

    } catch (error) {
      console.error(error);
      alert("تعذر تغيير اسم المتجر.");
    }
  });
}

// ==========================================
// تحديث بيانات دخول الإدارة
// ==========================================

if ($("updateAdminCredentials")) {
  $("updateAdminCredentials").addEventListener("click", async () => {
    if (!isAdmin() || !auth.currentUser) return;

    const email = $("newAdminEmail")?.value.trim() || "";
    const password = $("newAdminPassword")?.value || "";

    if (!email && !password) {
      alert("اكتب البريد الجديد أو كلمة المرور الجديدة.");
      return;
    }

    try {
      if (email) {
        await auth.currentUser.updateEmail(email);
      }

      if (password) {
        if (password.length < 6) {
          alert("كلمة المرور يجب ألا تقل عن 6 أحرف.");
          return;
        }

        await auth.currentUser.updatePassword(password);
      }

      if ($("newAdminEmail")) $("newAdminEmail").value = "";
      if ($("newAdminPassword")) $("newAdminPassword").value = "";

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
}

// ==========================================
// التقارير الشهرية
// ==========================================

let selectedReportMonth = "";

function monthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString("ar-EG", {
    month: "long",
    year: "numeric"
  });
}

function setupMonthlyReports() {
  const select = $("monthlyReportSelect");
  if (!select) return;

  const months = new Set([monthKey(new Date())]);

  orders.forEach(order => {
    const timestamp = getOrderDate(order);

    if (timestamp) {
      months.add(monthKey(new Date(timestamp)));
    }
  });

  const sortedMonths = [...months].sort().reverse();

  if (!selectedReportMonth || !months.has(selectedReportMonth)) {
    selectedReportMonth = sortedMonths[0];
  }

  select.innerHTML = sortedMonths.map(key => `
    <option value="${key}" ${key === selectedReportMonth ? "selected" : ""}>
      ${esc(monthLabel(key))}
    </option>
  `).join("");

  select.onchange = () => {
    selectedReportMonth = select.value;
    renderMonthlyReport();
  };

  const downloadButton = $("downloadMonthlyExcel");

  if (downloadButton) {
    downloadButton.onclick = downloadMonthlyExcel;
  }

  renderMonthlyReport();
}

// ==========================================
// حساب التقرير الشهري
// ==========================================

function getMonthlyOrders() {
  if (!selectedReportMonth) return [];

  return orders.filter(order => {
    const timestamp = getOrderDate(order);

    if (!timestamp) return false;

    return monthKey(new Date(timestamp)) === selectedReportMonth;
  });
}

function renderMonthlyReport() {
  if (!$("monthlyOrderDetails")) return;

  const monthlyOrders = getMonthlyOrders();

  const completed = monthlyOrders.filter(
    order => getOrderStatus(order) === "completed"
  );

  const newOrders = monthlyOrders.filter(
    order => getOrderStatus(order) === "new"
  );

  const cancelled = monthlyOrders.filter(
    order => getOrderStatus(order) === "cancelled"
  );

  const allTotal = monthlyOrders.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0
  );

  const revenue = completed.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0
  );

  if ($("monthlyAllTotal")) {
    $("monthlyAllTotal").textContent = money(allTotal) + " جنيه";
  }

  if ($("monthlyRevenue")) {
    $("monthlyRevenue").textContent = money(revenue) + " جنيه";
  }

  if ($("monthlyOrderCount")) {
    $("monthlyOrderCount").textContent = monthlyOrders.length;
  }

  if ($("monthlyCompleted")) {
    $("monthlyCompleted").textContent = completed.length;
  }

  if ($("monthlyNew")) {
    $("monthlyNew").textContent = newOrders.length;
  }

  if ($("monthlyCancelled")) {
    $("monthlyCancelled").textContent = cancelled.length;
  }

  $("monthlyOrderDetails").innerHTML = monthlyOrders.length
    ? monthlyOrders.map(order => {
        const date = new Date(getOrderDate(order)).toLocaleString("ar-EG");

        const status = {
          completed: "مكتمل",
          new: "جديد",
          cancelled: "ملغي"
        }[getOrderStatus(order)];

        return `
          <div class="admin-order">
            <strong>طلب ${esc(order.id)}</strong>
            <p>العميل: ${esc(order.customerName)}</p>
            <p>التاريخ: ${esc(date)}</p>
            <p>الإجمالي: ${money(order.total)} جنيه</p>
            <p>الحالة: ${status}</p>
          </div>
        `;
      }).join("")
    : `<p class="muted">لا توجد طلبات في هذا الشهر.</p>`;
}

// ==========================================
// تنزيل التقرير بصيغة CSV المتوافقة مع Excel
// ==========================================

function downloadMonthlyExcel() {
  if (!isAdmin()) return;

  const monthlyOrders = getMonthlyOrders();

  const rows = [
    [
      "رقم الطلب",
      "اسم العميل",
      "رقم الهاتف",
      "العنوان",
      "المنتجات",
      "الإجمالي بالجنيه",
      "الحالة",
      "التاريخ"
    ]
  ];

  monthlyOrders.forEach(order => {
    const date = getOrderDate(order)
      ? new Date(getOrderDate(order)).toLocaleString("ar-EG")
      : "";

    const items = Array.isArray(order.items)
      ? order.items.map(item =>
          `${item.name} × ${item.quantity}`
        ).join(" | ")
      : "";

    const status = {
      completed: "مكتمل",
      new: "جديد",
      cancelled: "ملغي"
    }[getOrderStatus(order)];

    rows.push([
      order.id,
      order.customerName || "",
      order.phone || "",
      order.address || "",
      items,
      Number(order.total || 0),
      status,
      date
    ]);
  });

  const csvEscape = value => {
    let text = String(value ?? "");

    if (/^[=+\-@]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
  };

  const csv = "\uFEFF" + rows
    .map(row => row.map(csvEscape).join(","))
    .join("\r\n");

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

// ==========================================
// تسجيل الخروج
// ==========================================

if ($("logout")) {
  $("logout").addEventListener("click", closeAdminAndLogout);
}

// ==========================================
// تشغيل المتجر
// ==========================================

async function startStore() {
  if (!firebaseReady) return;

  const success = await loadStoreData();

  if (!success) {
    console.error("تعذر تحميل بيانات المتجر.");
  }
}

startStore();
