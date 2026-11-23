
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

      if (!success) {
        showMessage("adminMsg", "تعذر تحميل بيانات الإدارة.");
      } else {
        showMessage("adminMsg", "تم تسجيل الدخول بنجاح.");
      }

    } catch (error) {
      console.error("Admin login error:", error);

      showMessage(
        "loginMsg",
        "بيانات الدخول غير صحيحة أو تعذر الاتصال."
      );

    } finally {
      setButtonLoading(button, false, normalText);
    }
  });
}

// ==========================================
// تحميل لوحة الإدارة
// ==========================================

async function loadCloud() {
  if (!firebaseReady || !isAdmin()) return false;

  const success = await loadStoreData();

  if (!success) return false;

  if ($("editStoreName")) {
    $("editStoreName").value = settings.name;
  }

  if ($("editWhatsapp")) {
    $("editWhatsapp").value = settings.whatsapp;
  }

  if ($("editFacebook")) {
    $("editFacebook").value = settings.facebook;
  }

  if ($("editMessenger")) {
    $("editMessenger").value = settings.messenger;
  }

  await loadOrders();
  renderAdminProducts();

  return true;
}

// ==========================================
// الطلبات
// ==========================================

async function loadOrders() {
  if (!isAdmin()) return;

  try {
    const snapshot = await db.collection("orders").get();

    orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    renderOrders();
    renderStats();

  } catch (error) {
    console.error("Orders loading error:", error);

    if ($("adminOrders")) {
      $("adminOrders").innerHTML =
        '<p class="hint">تعذر تحميل الطلبات.</p>';
    }
  }
}

function renderStats() {
  const completed = orders.filter(
    order => order.status === "completed"
  );

  const newOrders = orders.filter(
    order => order.status === "new"
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
    $("statRevenue").textContent = money(revenue) + " جنيه";
  }
}

function renderOrders() {
  if (!$("adminOrders")) return;

  if (!orders.length) {
    $("adminOrders").innerHTML =
      '<p class="muted">لا توجد طلبات حتى الآن.</p>';
    return;
  }

  const sorted = [...orders].sort((a, b) => {
    const dateA = a.createdAt?.toMillis?.() || 0;
    const dateB = b.createdAt?.toMillis?.() || 0;

    return dateB - dateA;
  });

  $("adminOrders").innerHTML = sorted.map(order => {
    const items = Array.isArray(order.items)
      ? order.items
      : [];

    const statusText =
      order.status === "completed"
        ? "مكتمل"
        : order.status === "cancelled"
          ? "ملغي"
          : "جديد";

    const date = order.createdAt?.toDate
      ? order.createdAt.toDate().toLocaleString("ar-EG")
      : "وقت التسجيل غير متاح";

    const itemsHtml = items.map(item => `
      <li>
        ${esc(item.name)} × ${Number(item.quantity || 0)}
        — ${money(
          Number(item.price || 0) *
          Number(item.quantity || 0)
        )} جنيه
      </li>
    `).join("");

    return `
      <div class="admin-order">
        <h4>طلب رقم: ${esc(order.id.slice(0, 8))}</h4>

        <p><b>العميل:</b> ${esc(order.customerName)}</p>
        <p><b>الهاتف:</b> ${esc(order.phone)}</p>
        <p><b>العنوان:</b> ${esc(order.address)}</p>
        <p><b>التاريخ:</b> ${esc(date)}</p>
        <p><b>طريقة التواصل:</b> ${esc(order.channel)}</p>
        <p><b>الحالة:</b> ${statusText}</p>

        <p><b>المنتجات:</b></p>
        <ul>${itemsHtml}</ul>

        <p><b>الإجمالي: ${money(order.total)} جنيه</b></p>

        <div class="order-actions">
          ${
            order.status !== "completed"
              ? `<button type="button" class="primary"
                   data-order-status="${esc(order.id)}"
                   data-status="completed">
                   إكمال الطلب
                 </button>`
              : ""
          }

          ${
            order.status !== "cancelled"
              ? `<button type="button" class="secondary"
                   data-order-status="${esc(order.id)}"
                   data-status="cancelled">
                   إلغاء الطلب
                 </button>`
              : ""
          }

          <button type="button" class="secondary"
            data-order-copy="${esc(order.id)}">
            نسخ التفاصيل
          </button>
        </div>
      </div>
    `;
  }).join("");
}

if ($("adminOrders")) {
  $("adminOrders").addEventListener("click", async event => {
    const statusButton = event.target.closest("[data-order-status]");
    const copyButton = event.target.closest("[data-order-copy]");

    if (statusButton) {
      if (!isAdmin()) return;

      const id = statusButton.dataset.orderStatus;
      const status = statusButton.dataset.status;

      if (!["completed", "cancelled"].includes(status)) return;

      statusButton.disabled = true;

      try {
        await db.collection("orders").doc(id).update({
          status
        });

        await loadOrders();

      } catch (error) {
        console.error("Order update error:", error);
        alert("تعذر تحديث حالة الطلب. راجع قواعد Firebase.");
        statusButton.disabled = false;
      }

      return;
    }

    if (copyButton) {
      const order = orders.find(
        item => item.id === copyButton.dataset.orderCopy
      );

      if (!order) return;

      const message = `طلب من ${settings.name}
الاسم: ${order.customerName}
الهاتف: ${order.phone}
العنوان: ${order.address}

${(order.items || []).map(item =>
  `• ${item.name} × ${item.quantity} = ${money(item.price * item.quantity)} جنيه`
).join("\n")}

الإجمالي: ${money(order.total)} جنيه`;

      const copied = await copyOrderMessage(message);

      alert(
        copied
          ? "تم نسخ تفاصيل الطلب."
          : "تعذر النسخ على هذا الجهاز."
      );
    }
  });
}

// ==========================================
// المنتجات في لوحة الإدارة
// ==========================================

function renderAdminProducts() {
  if (!$("adminProducts")) return;

  if (!products.length) {
    $("adminProducts").innerHTML =
      '<p class="muted">لا توجد منتجات حاليًا.</p>';
    return;
  }

  $("adminProducts").innerHTML = products.map(product => `
    <div class="admin-product">
      <div>
        <strong>${esc(product.name)}</strong>
        <p>${money(product.price)} جنيه</p>
        <p class="hint">${esc(product.category)}</p>
      </div>

      <button type="button"
        class="secondary"
        data-delete-product="${esc(product.id)}">
        حذف
      </button>
    </div>
  `).join("");
}

if ($("adminProducts")) {
  $("adminProducts").addEventListener("click", async event => {
    const button = event.target.closest("[data-delete-product]");
    if (!button || !isAdmin()) return;

    const id = button.dataset.deleteProduct;

    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
      return;
    }

    button.disabled = true;

    try {
      await db.collection("products").doc(id).delete();

      products = products.filter(product => product.id !== id);

      delete cart[id];

      render();
      renderAdminProducts();

      alert("تم حذف المنتج.");

    } catch (error) {
      console.error("Product delete error:", error);
      alert("تعذر حذف المنتج. راجع قواعد Firebase.");
      button.disabled = false;
    }
  });
}

// ==========================================
// إضافة منتج جديد
// ==========================================

if ($("addProduct")) {
  $("addProduct").addEventListener("click", async () => {
    if (!isAdmin()) {
      alert("يجب تسجيل الدخول للإدارة أولاً.");
      return;
    }

    const name = $("newName")?.value.trim() || "";
    const price = Number($("newPrice")?.value);
    const category = $("newCategory")?.value.trim() || "";

    if (!name || !category || !Number.isFinite(price) || price < 0) {
      alert("اكتب اسم المنتج والسعر والقسم بشكل صحيح.");
      return;
    }

    const button = $("addProduct");
    const normalText = button.textContent;

    setButtonLoading(button, true, normalText);

    try {
      await db.collection("products").add({
        name,
        price,
        category,
        image: selectedProductImage || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      $("newName").value = "";
      $("newPrice").value = "";
      $("newCategory").value = "";

      selectedProductImage = "";

      if ($("productImagePreview")) {
        $("productImagePreview").src = "";
        $("productImagePreview").classList.add("hidden");
      }

      $("removeProductImage")?.classList.add("hidden");

      if ($("productImageGallery")) {
        $("productImageGallery").value = "";
      }

      if ($("productImageCamera")) {
        $("productImageCamera").value = "";
      }

      await loadStoreData();
      renderAdminProducts();

      alert("تمت إضافة المنتج بنجاح.");

    } catch (error) {
      console.error("Add product error:", error);

      alert(
        "تعذر إضافة المنتج. قد تكون الصورة كبيرة أو قواعد Firebase تمنع الحفظ."
      );

    } finally {
      setButtonLoading(button, false, normalText);
    }
  });
}

// ==========================================
// حفظ وسائل التواصل
// ==========================================

if ($("saveSettings")) {
  $("saveSettings").addEventListener("click", async () => {
    if (!isAdmin()) return;

    const whatsapp = $("editWhatsapp").value.trim();
    const facebook = $("editFacebook").value.trim();
    const messenger = $("editMessenger").value.trim();

    const button = $("saveSettings");
    const normalText = button.textContent;

    setButtonLoading(button, true, normalText);

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

      showMessage("adminMsg", "تم حفظ وسائل التواصل بنجاح.");

    } catch (error) {
      console.error("Settings save error:", error);
      alert("تعذر حفظ وسائل التواصل. راجع قواعد Firebase.");

    } finally {
      setButtonLoading(button, false, normalText);
    }
  });
}

// ==========================================
// حفظ اسم المتجر
// ==========================================

if ($("saveStoreName")) {
  $("saveStoreName").addEventListener("click", async () => {
    if (!isAdmin()) return;

    const name = $("editStoreName").value.trim();

    if (name.length < 2) {
      alert("اكتب اسم متجر صحيح.");
      return;
    }

    const button = $("saveStoreName");
    const normalText = button.textContent;

    setButtonLoading(button, true, normalText);

    try {
      await db.collection("settings").doc("main").set({
        ...settings,
        name
      }, { merge: true });

      settings.name = name;

      render();

      showMessage("adminMsg", "تم حفظ اسم المتجر.");

    } catch (error) {
      console.error("Store name error:", error);
      alert("تعذر حفظ اسم المتجر.");

    } finally {
      setButtonLoading(button, false, normalText);
    }
  });
}

// ==========================================
// تحديث بيانات دخول الإدارة
// ==========================================

if ($("updateAdminCredentials")) {
  $("updateAdminCredentials").addEventListener("click", async () => {
    if (!isAdmin()) return;

    const user = auth.currentUser;

    const email = $("newAdminEmail").value.trim();
    const password = $("newAdminPassword").value;

    if (!email && !password) {
      alert("اكتب البريد الجديد أو كلمة المرور الجديدة.");
      return;
    }

    if (password && password.length < 6) {
      alert("كلمة المرور يجب ألا تقل عن 6 أحرف.");
      return;
    }

    const button = $("updateAdminCredentials");
    const normalText = button.textContent;

    setButtonLoading(button, true, normalText);

    try {
      if (email) {
        await user.updateEmail(email);
      }

      if (password) {
        await user.updatePassword(password);
      }

      $("newAdminEmail").value = "";
      $("newAdminPassword").value = "";

      alert("تم تحديث بيانات الدخول.");

    } catch (error) {
      console.error("Credentials update error:", error);

      if (error.code === "auth/requires-recent-login") {
        alert(
          "لأمان الحساب، سجّل الخروج ثم ادخل مرة أخرى وحاول تحديث البيانات."
        );
      } else {
        alert("تعذر تحديث بيانات الدخول. راجع البيانات وحاول مرة أخرى.");
      }

    } finally {
      setButtonLoading(button, false, normalText);
    }
  });
}

// ==========================================
// تسجيل الخروج
// ==========================================

if ($("logout")) {
  $("logout").addEventListener("click", closeAdminAndLogout);
}

// ==========================================
// تشغيل الموقع
// ==========================================

async function startStore() {
  render();

  if (!firebaseReady) {
    if ($("products")) {
      $("products").innerHTML =
        '<p class="hint">تعذر الاتصال بقاعدة البيانات.</p>';
    }
    return;
  }

  const success = await loadStoreData();

  if (!success && $("products")) {
    $("products").innerHTML =
      '<p class="hint">تعذر تحميل المنتجات. حدّث الصفحة وحاول مرة أخرى.</p>';
  }
}

startStore();

// ==========================================
// نهاية ملف زهرة حماة
// ==========================================
