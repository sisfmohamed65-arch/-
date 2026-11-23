
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

const money = value => Number(value || 0).toLocaleString("ar-EG", {
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
// Firebase
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
  console.error("Firebase error:", error);
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
// التنقل بين أقسام الإدارة
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
  if ($("footerNameBottom")) $("footerNameBottom").textContent = settings.name;

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
        ${product.image
          ? `<img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">`
          : `<div class="placeholder">${product.emoji}</div>`
        }
        <h3>${esc(product.name)}</h3>
        <div class="price">${money(product.price)} جنيه</div>
        <button type="button" class="primary" data-add="${esc(product.id)}">
          أضف للسلة
        </button>
      </article>
    `).join("")
    : `<p class="muted">${products.length ? "مفيش منتجات مطابقة للبحث." : "لا توجد منتجات حاليًا."}</p>`;
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
    return sum + (product ? product.price * Number(qty) : 0);
  }, 0);
}

function renderCart() {
  if (!$("cartItems")) return;

  const entries = getCartEntries();
  const count = entries.reduce((sum, [, qty]) => sum + Number(qty), 0);

  if ($("cartCount")) $("cartCount").textContent = count;
  if ($("total")) $("total").textContent = money(getCartTotal());

  $("cartItems").innerHTML = entries.length
    ? entries.map(([id, qty]) => {
      const product = products.find(p => p.id === id);
      if (!product) return "";

      return `
        <div class="cart-row">
          <span>${esc(product.name)} — ${money(product.price)} جنيه</span>
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

    cart[id] = (cart[id] || 0) + (button.dataset.plus ? 1 : -1);

    if (cart[id] <= 0) delete cart[id];
    renderCart();
  });
}

if ($("clearCart")) {
  $("clearCart").onclick = () => {
    cart = {};
    renderCart();
  };
}

// ==========================================
// إتمام الطلب
// ==========================================

if ($("checkout")) {
  $("checkout").onclick = () => {
    if (!getCartEntries().length) {
      alert("ضيف منتجات للسلة الأول.");
      return;
    }
    openModal("checkoutModal");
  };
}

if ($("sendOrder")) {
  $("sendOrder").onclick = async () => {
    const name = $("customerName").value.trim();
    const phone = $("customerPhone").value.trim();
    const address = $("customerAddress").value.trim();
    const channel = $("contactChannel").value;

    if (!name || !phone || !address) {
      alert("اكتب الاسم ورقم الموبايل والعنوان.");
      return;
    }

    if (!firebaseReady) {
      alert("تعذر الاتصال بقاعدة البيانات.");
      return;
    }

    const destination =
      channel === "whatsapp" ? settings.whatsapp :
      channel === "messenger" ? settings.messenger :
      settings.facebook;

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

    const button = $("sendOrder");
    let contactWindow = null;

    try {
      contactWindow = window.open("about:blank", "_blank");
    } catch (error) {
      console.warn(error);
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
    } catch (error) {
      console.error(error);
      if (contactWindow) contactWindow.close();

      alert("تعذر حفظ الطلب. حاول مرة أخرى.");
      button.disabled = false;
      button.textContent = "إرسال الطلب";
      return;
    }

    let contactUrl = "";

    if (channel === "whatsapp") {
      const digits = settings.whatsapp.replace(/\D/g, "");
      contactUrl = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    } else {
      try {
        await navigator.clipboard.writeText(message);
      } catch (error) {
        console.warn("Clipboard unavailable:", error);
      }
      contactUrl = destination;
    }

    if (contactWindow && contactUrl) {
      contactWindow.location.href = contactUrl;
    } else if (contactUrl) {
      window.location.href = contactUrl;
    }

    if (channel !== "whatsapp") {
      alert("تم حفظ الطلب. تفاصيله جاهزة للنسخ والإرسال.");
    }

    cart = {};
    renderCart();

    $("customerName").value = "";
    $("customerPhone").value = "";
    $("customerAddress").value = "";

    closeModal("checkoutModal");

    button.disabled = false;
    button.textContent = "إرسال الطلب";
  };
}

// ==========================================
// تسجيل دخول الإدارة
// ==========================================

if ($("adminLogin")) {
  $("adminLogin").onclick = async () => {
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
    setButtonLoading(button, true, "تسجيل الدخول");

    try {
      const result = await auth.signInWithEmailAndPassword(email, password);

      if (result.user.uid !== ADMIN_UID) {
        await auth.signOut();
        showMessage("loginMsg", "هذا الحساب غير مصرح له بدخول الإدارة.");
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
      }

    } catch (error) {
      console.error("Admin login error:", error);
      showMessage("loginMsg", "بيانات الدخول غير صحيحة أو تعذر الاتصال.");
    } finally {
      setButtonLoading(button, false, "تسجيل الدخول");
    }
  };
}

// ==========================================
// تحميل لوحة الإدارة
// ==========================================

async function loadCloud() {
  if (!firebaseReady || !isAdmin()) return false;

  const success = await loadStoreData();
  if (!success) return false;

  if ($("editStoreName")) $("editStoreName").value = settings.name;
  if ($("editWhatsapp")) $("editWhatsapp").value = settings.whatsapp;
  if ($("editFacebook")) $("editFacebook").value = settings.facebook;
  if ($("editMessenger")) $("editMessenger").value = settings.messenger;

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
    console.error(error);
    if ($("adminOrders")) {
      $("adminOrders").innerHTML = '<p class="hint">تعذر تحميل الطلبات.</p>';
    }
  }
}

function renderStats() {
  const completed = orders.filter(o => o.status === "completed");
  const newOrders = orders.filter(o => o.status === "new");

  const revenue = completed.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0
  );

  if ($("statOrders")) $("statOrders").textContent = orders.length;
  if ($("statNew")) $("statNew").textContent = newOrders.length;
  if ($("statCompleted")) $("statCompleted").textContent = completed.length;
  if ($("statRevenue")) $("statRevenue").textContent = money(revenue) + " جنيه";
}

function renderOrders() {
  if (!$("adminOrders")) return;

  if (!orders.length) {
    $("adminOrders").innerHTML = '<p class="muted">لا توجد طلبات حتى الآن.</p>';
    return;
  }

  const sorted = [...orders].sort((a, b) => {
    const dateA = a.createdAt?.toMillis?.() || 0;
    const dateB = b.createdAt?.toMillis?.() || 0;
    return dateB - dateA;
  });

  $("adminOrders").innerHTML = sorted.map(order => {
    const items = Array.isArray(order.items) ? order.items : [];

    const statusText =
      order.status === "completed" ? "مكتمل" :
      order.status === "cancelled" ? "ملغي" : "جديد";

    const date = order.createdAt?.toDate
      ? order.createdAt.toDate().toLocaleString("ar-EG")
      : "وقت التسجيل غير متاح";

    const itemsHtml = items.map(item => `
      <li>${esc(item.name)} × ${Number(item.quantity || 0)}
      — ${money(Number(item.price || 0) * Number(item.quantity || 0))} جنيه</li>
    `).join("");

    return `
      <div class="admin-order panel">
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
        ${order.status === "new" ? `
          <div class="order-actions">
            <button type="button" class="primary"
              data-status="completed" data-id="${esc(order.id)}">
              تأكيد اكتمال الطلب
            </button>
            <button type="button" class="link"
              data-status="cancelled" data-id="${esc(order.id)}">
              إلغاء الطلب
            </button>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

if ($("adminOrders")) {
  $("adminOrders").addEventListener("click", async event => {
    const button = event.target.closest("[data-status]");
    if (!button || !isAdmin()) return;

    const id = button.dataset.id;
    const status = button.dataset.status;

    if (!["completed", "cancelled"].includes(status)) return;

    const question = status === "completed"
      ? "هل تؤكد اكتمال الطلب؟"
      : "هل تريد إلغاء الطلب؟";

    if (!confirm(question)) return;

    button.disabled = true;

    try {
      await db.collection("orders").doc(id).update({ status });
      await loadOrders();
      showMessage("adminMsg", "تم تحديث حالة الطلب.");
    } catch (error) {
      console.error(error);
      showMessage("adminMsg", "تعذر تحديث حالة الطلب.");
      button.disabled = false;
    }
  });
}

// ==========================================
// إدارة المنتجات
// ==========================================

function renderAdminProducts() {
  if (!$("adminProducts")) return;

  if (!products.length) {
    $("adminProducts").innerHTML = '<p class="muted">لا توجد منتجات.</p>';
    return;
  }

  $("adminProducts").innerHTML = products.map(product => `
    <div class="admin-order">
      <strong>${esc(product.name)}</strong>
      <p>السعر: ${money(product.price)} جنيه</p>
      <p>القسم: ${esc(product.category)}</p>
      ${product.image ? `<img src="${esc(product.image)}" alt="" style="max-width:100px;max-height:100px">` : ""}
      <button type="button" class="link"
        data-delete-product="${esc(product.id)}">
        حذف المنتج
      </button>
    </div>
  `).join("");
}

if ($("adminProducts")) {
  $("adminProducts").addEventListener("click", async event => {
    const button = event.target.closest("[data-delete-product]");
    if (!button || !isAdmin()) return;

    if (!confirm("هل تريد حذف هذا المنتج؟")) return;

    button.disabled = true;

    try {
      await db.collection("products").doc(button.dataset.deleteProduct).delete();
      await loadStoreData();
      renderAdminProducts();
      showMessage("adminMsg", "تم حذف المنتج.");
    } catch (error) {
      console.error(error);
      showMessage("adminMsg", "تعذر حذف المنتج.");
      button.disabled = false;
    }
  });
}

// ==========================================
// صور المنتجات
// ==========================================

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxSide = 700;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };

      image.onerror = reject;
      image.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setSelectedImage(imageData) {
  selectedProductImage = imageData || "";

  const preview = $("productImagePreview");
  const remove = $("removeProductImage");

  if (preview) {
    if (selectedProductImage) {
      preview.src = selectedProductImage;
      preview.classList.remove("hidden");
    } else {
      preview.src = "";
      preview.classList.add("hidden");
    }
  }

  if (remove) {
    remove.classList.toggle("hidden", !selectedProductImage);
  }
}

if ($("chooseGallery")) {
  $("chooseGallery").onclick = () => $("productImageGallery")?.click();
}

if ($("takeProductPhoto")) {
  $("takeProductPhoto").onclick = () => $("productImageCamera")?.click();
}

["productImageGallery", "productImageCamera"].forEach(id => {
  if (!$(id)) return;

  $(id).addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("اختار ملف صورة فقط.");
      return;
    }

    try {
      const compressed = await compressImage(file);
      setSelectedImage(compressed);
    } catch (error) {
      console.error(error);
      alert("تعذر تجهيز الصورة.");
    }

    event.target.value = "";
  });
});

if ($("removeProductImage")) {
  $("removeProductImage").onclick = () => setSelectedImage("");
}

// ==========================================
// إضافة منتج
// ==========================================

if ($("addProduct")) {
  $("addProduct").onclick = async () => {
    if (!isAdmin()) {
      alert("سجل دخول الإدارة أولاً.");
      return;
    }

    const name = $("newName").value.trim();
    const price = Number($("newPrice").value);
    const category = $("newCategory").value.trim();

    if (!name || !Number.isFinite(price) || price < 0 || !category) {
      alert("اكتب اسم المنتج والسعر والقسم بشكل صحيح.");
      return;
    }

    const button = $("addProduct");
    setButtonLoading(button, true, "إضافة المنتج");

    try {
      await db.collection("products").add({
        name,
        price,
        category,
        image: selectedProductImage,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      $("newName").value = "";
      $("newPrice").value = "";
      $("newCategory").value = "";
      setSelectedImage("");

      await loadStoreData();
      renderAdminProducts();

      showMessage("adminMsg", "تمت إضافة المنتج بنجاح.");

    } catch (error) {
      console.error(error);
      showMessage("adminMsg", "تعذرت إضافة المنتج. تحقق من الاتصال وحجم الصورة.");
    } finally {
      setButtonLoading(button, false, "إضافة المنتج");
    }
  };
}

// ==========================================
// إعدادات المتجر والتواصل
// ==========================================

async function saveSettings() {
  if (!isAdmin()) {
    alert("سجل دخول الإدارة أولاً.");
    return;
  }

  const name = $("editStoreName")?.value.trim() || settings.name;
  const whatsapp = $("editWhatsapp")?.value.trim() || "";
  const facebook = $("editFacebook")?.value.trim() || "";
  const messenger = $("editMessenger")?.value.trim() || "";

  try {
    await db.collection("settings").doc("main").set({
      name,
      whatsapp,
      facebook,
      messenger
    }, { merge: true });

    settings = { name, whatsapp, facebook, messenger };
    render();

    showMessage("adminMsg", "تم حفظ إعدادات المتجر بنجاح.");

  } catch (error) {
    console.error(error);
    showMessage("adminMsg", "تعذر حفظ الإعدادات.");
  }
}

if ($("saveSettings")) {
  $("saveSettings").onclick = saveSettings;
}

if ($("saveStoreName")) {
  $("saveStoreName").onclick = saveSettings;
}

// ==========================================
// تحديث بيانات دخول الإدارة
// ==========================================

if ($("updateAdminCredentials")) {
  $("updateAdminCredentials").onclick = async () => {
    if (!isAdmin()) {
      alert("سجل دخول الإدارة أولاً.");
      return;
    }

    const email = $("newAdminEmail").value.trim();
    const password = $("newAdminPassword").value;

    if (!email && !password) {
      alert("اكتب البريد الجديد أو كلمة المرور الجديدة.");
      return;
    }

    try {
      const user = auth.currentUser;

      if (email) {
        await user.updateEmail(email);
      }

      if (password) {
        await user.updatePassword(password);
      }

      $("newAdminEmail").value = "";
      $("newAdminPassword").value = "";

      showMessage("adminMsg", "تم تحديث بيانات الدخول بنجاح.");

    } catch (error) {
      console.error(error);

      if (error.code === "auth/requires-recent-login") {
        showMessage("adminMsg", "لأمان الحساب، سجل خروج ثم ادخل مجددًا قبل تغيير البيانات.");
      } else {
        showMessage("adminMsg", "تعذر تحديث بيانات الدخول.");
      }
    }
  };
}

// ==========================================
// تسجيل الخروج
// ==========================================

if ($("logout")) {
  $("logout").onclick = closeAdminAndLogout;
}

// ==========================================
// تشغيل المتجر
// ==========================================

async function startStore() {
  if (!firebaseReady) {
    console.error("Firebase غير جاهز.");
    return;
  }

  // إلغاء الجلسة المحفوظة عند بدء الموقع
  try {
    if (auth.currentUser) {
      await auth.signOut();
    }
  } catch (error) {
    console.error("Initial sign out error:", error);
  }

  resetAdminLogin();

  await loadStoreData();
}

startStore();
