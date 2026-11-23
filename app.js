
// ==========================================
// زهرة حماة - التطبيق الرئيسي
// ==========================================

// إعدادات Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBbS1MzPjkiLEagg97OTVCBa-yABqKt1Gg",
  authDomain: "zahret-hama.firebaseapp.com",
  projectId: "zahret-hama",
  storageBucket: "zahret-hama.firebasestorage.app",
  messagingSenderId: "525184861733",
  appId: "1:525184861733:web:0f5bb1090a2a29754921cc"
};

// رقم حساب الإدارة المصرح به
const ADMIN_UID = "bw9BjGepH9Z04LZ361DLc02QzEl2";

// ==========================================
// المتغيرات الأساسية
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
let authListenerStarted = false;

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

function setButtonLoading(button, loading, normalText) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? "جاري التنفيذ..." : normalText;
}

function isAdmin() {
  return !!(
    auth &&
    auth.currentUser &&
    auth.currentUser.uid === ADMIN_UID
  );
}

// ==========================================
// تشغيل Firebase
// ==========================================

try {
  if (!window.firebase) {
    throw new Error("Firebase SDK غير موجود في الصفحة.");
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

// ==========================================
// تحميل بيانات المتجر
// ==========================================

async function loadStoreData() {
  if (!firebaseReady) return false;

  try {
    const productsSnapshot = await db
      .collection("products")
      .get();

    products = productsSnapshot.docs.map(doc => {
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

    const settingsSnapshot = await db
      .collection("settings")
      .doc("main")
      .get();

    if (settingsSnapshot.exists) {
      const data = settingsSnapshot.data();

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
  if ($("storeTitle")) {
    $("storeTitle").textContent = settings.name;
  }

  if ($("footerName")) {
    $("footerName").textContent = settings.name;
  }

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
    ...new Set(
      products
        .map(product => product.category)
        .filter(Boolean)
    )
  ];

  if (!categories.includes(activeCategory)) {
    activeCategory = "الكل";
  }

  $("categories").innerHTML = categories.map(category => `
    <button
      type="button"
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
    const matchesCategory =
      activeCategory === "الكل" ||
      product.category === activeCategory;

    const matchesSearch =
      String(product.name || "")
        .toLowerCase()
        .includes(query);

    return matchesCategory && matchesSearch;
  });

  $("products").innerHTML = shown.length
    ? shown.map(product => `
        <article class="product">
          ${
            product.image
              ? `
                <img
                  src="${esc(product.image)}"
                  alt="${esc(product.name)}"
                  loading="lazy">
              `
              : `
                <div class="placeholder">
                  ${product.emoji}
                </div>
              `
          }

          <h3>${esc(product.name)}</h3>

          <div class="price">
            ${money(product.price)} جنيه
          </div>

          <button
            type="button"
            class="primary"
            data-add="${esc(product.id)}">
            أضف للسلة
          </button>
        </article>
      `).join("")
    : `
      <p class="muted">
        ${products.length
          ? "مفيش منتجات مطابقة للبحث."
          : "لا توجد منتجات حاليًا."}
      </p>
    `;
}

// ==========================================
// السلة
// ==========================================

function getCartEntries() {
  return Object.entries(cart).filter(([, quantity]) => {
    return Number(quantity) > 0;
  });
}

function getCartTotal() {
  return getCartEntries().reduce((sum, [id, quantity]) => {
    const product = products.find(item => item.id === id);

    return sum + (
      product
        ? product.price * Number(quantity)
        : 0
    );
  }, 0);
}

function renderCart() {
  if (!$("cartItems")) return;

  const entries = getCartEntries();

  const count = entries.reduce(
    (sum, [, quantity]) => sum + Number(quantity),
    0
  );

  if ($("cartCount")) {
    $("cartCount").textContent = count;
  }

  if ($("total")) {
    $("total").textContent = money(getCartTotal());
  }

  $("cartItems").innerHTML = entries.length
    ? entries.map(([id, quantity]) => {
        const product = products.find(item => item.id === id);

        if (!product) return "";

        return `
          <div class="cart-row">
            <span>
              ${esc(product.name)}
              — ${money(product.price)} جنيه
            </span>

            <span class="qty">
              <button
                type="button"
                data-minus="${esc(id)}">
                −
              </button>

              ${Number(quantity)}

              <button
                type="button"
                data-plus="${esc(id)}">
                +
              </button>
            </span>
          </div>
        `;
      }).join("")
    : `<p class="muted">السلة لسه فاضية.</p>`;
}

// إضافة منتج للسلة
if ($("products")) {
  $("products").addEventListener("click", event => {
    const button = event.target.closest("[data-add]");
    if (!button) return;

    const id = button.dataset.add;

    if (!products.some(product => product.id === id)) {
      return;
    }

    cart[id] = (cart[id] || 0) + 1;
    renderCart();
  });
}

// تغيير القسم
if ($("categories")) {
  $("categories").addEventListener("click", event => {
    const button = event.target.closest("[data-cat]");
    if (!button) return;

    activeCategory = button.dataset.cat;

    renderCategories();
    renderProducts();
  });
}

// زيادة وتقليل الكمية
if ($("cartItems")) {
  $("cartItems").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;

    const id = button.dataset.plus || button.dataset.minus;
    if (!id) return;

    if (button.dataset.plus) {
      cart[id] = (cart[id] || 0) + 1;
    } else {
      cart[id] = (cart[id] || 0) - 1;
    }

    if (cart[id] <= 0) {
      delete cart[id];
    }

    renderCart();
  });
}

// البحث
if ($("search")) {
  $("search").addEventListener("input", renderProducts);
}

// تفريغ السلة
if ($("clearCart")) {
  $("clearCart").onclick = () => {
    cart = {};
    renderCart();
  };
}

// ==========================================
// فتح وإغلاق النوافذ
// ==========================================

function openModal(id) {
  const modal = $(id);
  if (modal) modal.classList.remove("hidden");
}

function closeModal(id) {
  const modal = $(id);
  if (modal) modal.classList.add("hidden");
}

if ($("openAdmin")) {
  $("openAdmin").onclick = () => {
    openModal("adminModal");
  };
}

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    closeModal(button.dataset.close);
  });
});

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
      channel === "whatsapp"
        ? settings.whatsapp
        : channel === "messenger"
          ? settings.messenger
          : settings.facebook;

    if (!destination) {
      alert("وسيلة التواصل المختارة غير مضافة في إعدادات المتجر.");
      return;
    }

    const entries = getCartEntries();

    const items = entries.map(([id, quantity]) => {
      const product = products.find(item => item.id === id);

      if (!product) return null;

      return {
        productId: id,
        name: product.name,
        price: Number(product.price),
        quantity: Number(quantity)
      };
    }).filter(Boolean);

    if (!items.length) {
      alert("السلة فارغة أو المنتجات لم تعد متاحة.");
      return;
    }

    const total = items.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);

    const message = `طلب جديد من ${settings.name}
الاسم: ${name}
الموبايل: ${phone}
العنوان: ${address}

${items.map(item =>
  `• ${item.name} × ${item.quantity} = ${money(item.price * item.quantity)} جنيه`
).join("\n")}

الإجمالي: ${money(total)} جنيه`;

    const button = $("sendOrder");

    // فتح نافذة فارغة أثناء ضغطة المستخدم لتقليل منع النوافذ المنبثقة
    let contactWindow = null;

    try {
      contactWindow = window.open("about:blank", "_blank");
    } catch (error) {
      console.warn("Could not open contact window:", error);
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
      console.error("Order saving error:", error);

      if (contactWindow) {
        contactWindow.close();
      }

      alert("تعذر حفظ الطلب. حاول مرة أخرى.");

      button.disabled = false;
      button.textContent = "إرسال الطلب";
      return;
    }

    // تجهيز رابط التواصل
    let contactUrl = "";

    if (channel === "whatsapp") {
      const digits = settings.whatsapp.replace(/\D/g, "");

      contactUrl =
        `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

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
      alert("تم حفظ الطلب. تفاصيله جاهزة للنسخ وإرسالها في محادثة الصفحة.");
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
      const result = await auth.signInWithEmailAndPassword(
        email,
        password
      );

      if (result.user.uid !== ADMIN_UID) {
        await auth.signOut();

        showMessage(
          "loginMsg",
          "هذا الحساب غير مصرح له بدخول لوحة الإدارة."
        );

        return;
      }

      showMessage("loginMsg", "");
      closeModal("adminModal");

      $("adminPassword").value = "";

      $("loginPane").classList.add("hidden");
      $("adminPane").classList.remove("hidden");

      await loadCloud();

    } catch (error) {
      console.error("Admin login error:", error);

      showMessage(
        "loginMsg",
        "بيانات الدخول غير صحيحة أو تعذر الاتصال."
      );

    } finally {
      setButtonLoading(button, false, "تسجيل الدخول");
    }
  };
}

// ==========================================
// تحميل لوحة الإدارة
// ==========================================

async function loadCloud() {
  if (!firebaseReady || !isAdmin()) return;

  const success = await loadStoreData();

  if (!success) {
    showMessage("adminMsg", "تعذر تحميل بيانات المتجر.");
    return;
  }

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
}

// ==========================================
// تحميل الطلبات
// ==========================================

async function loadOrders() {
  if (!isAdmin()) return;

  try {
    const snapshot = await db
      .collection("orders")
      .get();

    orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    renderOrders();
    renderStats();

  } catch (error) {
    console.error("Orders loading error:", error);

    $("adminOrders").innerHTML =
      '<p class="hint">تعذر تحميل الطلبات.</p>';
  }
}

// ==========================================
// إحصائيات المتجر
// ==========================================

function renderStats() {
  const completed = orders.filter(order => {
    return order.status === "completed";
  });

  const newOrders = orders.filter(order => {
    return order.status === "new";
  });

  const revenue = completed.reduce((sum, order) => {
    return sum + Number(order.total || 0);
  }, 0);

  $("statOrders").textContent = orders.length;
  $("statNew").textContent = newOrders.length;
  $("statCompleted").textContent = completed.length;
  $("statRevenue").textContent = money(revenue) + " جنيه";
}

// ==========================================
// عرض الطلبات
// ==========================================

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
        ${esc(item.name)}
        × ${Number(item.quantity || 0)}
        — ${money(
          Number(item.price || 0) *
          Number(item.quantity || 0)
        )} جنيه
      </li>
    `).join("");

    return `
      <div class="admin-order panel">
        <h4>
          طلب رقم: ${esc(order.id.slice(0, 8))}
        </h4>

        <p><b>العميل:</b> ${esc(order.customerName)}</p>
        <p><b>الهاتف:</b> ${esc(order.phone)}</p>
        <p><b>العنوان:</b> ${esc(order.address)}</p>
        <p><b>التاريخ:</b> ${esc(date)}</p>
        <p><b>طريقة التواصل:</b> ${esc(order.channel)}</p>
        <p><b>الحالة:</b> ${statusText}</p>

        <p><b>المنتجات:</b></p>
        <ul>${itemsHtml}</ul>

        <p>
          <b>الإجمالي: ${money(order.total)} جنيه</b>
        </p>

        ${
          order.status === "new"
            ? `
              <div class="order-actions">
                <button
                  type="button"
                  class="primary"
                  data-status="completed"
                  data-id="${esc(order.id)}">
                  تأكيد اكتمال الطلب
                </button>

                <button
                  type="button"
                  class="link"
                  data-status="cancelled"
                  data-id="${esc(order.id)}">
                  إلغاء الطلب
                </button>
              </div>
            `
            : ""
        }
      </div>
    `;
  }).join("");
}

// ==========================================
// تغيير حالة الطلب
// ==========================================

if ($("adminOrders")) {
  $("adminOrders").addEventListener("click", async event => {
    const button = event.target.closest("[data-status]");
    if (!button) return;

    if (!isAdmin()) {
      alert("يجب تسجيل الدخول بحساب الإدارة.");
      return;
    }

    const id = button.dataset.id;
    const status = button.dataset.status;

    if (!["completed", "cancelled"].includes(status)) {
      return;
    }

    const message = status === "completed"
      ? "هل تؤكد أن الطلب اكتمل؟"
      : "هل تريد إلغاء هذا الطلب؟";

    if (!confirm(message)) return;

    button.disabled = true;

    try {
      await db
        .collection("orders")
        .doc(id)
        .update({ status });

      await loadOrders();

      showMessage("adminMsg", "تم تحديث حالة الطلب.");

    } catch (error) {
      console.error("Order status error:", error);

      showMessage("adminMsg", "تعذر تحديث حالة الطلب.");

      button.disabled = false;
    }
  });
}

// ==========================================
// تسجيل الخروج
// ==========================================

if ($("logout")) {
  $("logout").onclick = async () => {
    try {
      if (auth) {
        await auth.signOut();
      }

      $("adminPassword").value = "";

      $("adminPane").classList.add("hidden");
      $("loginPane").classList.remove("hidden");

      closeModal("adminModal");

      showMessage("loginMsg", "");
      showMessage("adminMsg", "");

    } catch (error) {
      console.error("Logout error:", error);
      alert("تعذر تسجيل الخروج. حاول مرة أخرى.");
    }
  };
}

// ==========================================
// حفظ إعدادات المتجر
// ==========================================

if ($("saveSettings")) {
  $("saveSettings").onclick = async () => {
    if (!isAdmin()) {
      alert("يجب تسجيل الدخول بحساب الإدارة.");
      return;
    }

    const name = $("editStoreName").value.trim();
    const whatsapp = $("editWhatsapp").value.trim();
    const facebook = $("editFacebook").value.trim();
    const messenger = $("editMessenger").value.trim();

    if (!name) {
      alert("اكتب اسم المتجر.");
      return;
    }

    const button = $("saveSettings");
    setButtonLoading(button, true, "حفظ الإعدادات");

    try {
      await db
        .collection("settings")
        .doc("main")
        .set({
          name,
          whatsapp,
          facebook,
          messenger
        }, { merge: true });

      settings = {
        name,
        whatsapp,
        facebook,
        messenger
      };

      render();

      showMessage(
        "adminMsg",
        "تم حفظ اسم المتجر وبيانات التواصل."
      );

    } catch (error) {
      console.error("Settings saving error:", error);

      showMessage(
        "adminMsg",
        "تعذر الحفظ: " + error.message
      );

    } finally {
      setButtonLoading(button, false, "حفظ الإعدادات");
    }
  };
}

// ==========================================
// ضغط صورة المنتج
// ==========================================

function compressProductImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("الملف المختار ليس صورة."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("تعذر قراءة الصورة."));
    };

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => {
        reject(new Error("الصورة غير صالحة."));
      };

      image.onload = () => {
        const maxSide = 700;

        const scale = Math.min(
          1,
          maxSide / Math.max(image.width, image.height)
        );

        const canvas = document.createElement("canvas");

        canvas.width = Math.max(
          1,
          Math.round(image.width * scale)
        );

        canvas.height = Math.max(
          1,
          Math.round(image.height * scale)
        );

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("تعذر تجهيز الصورة."));
          return;
        }

        context.fillStyle = "#ffffff";

        context.fillRect(
          0,
          0,
          canvas.width,
          canvas.height
        );

        context.drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height
        );

        let quality = 0.6;
        let result = canvas.toDataURL("image/jpeg", quality);

        while (result.length > 180000 && quality > 0.25) {
          quality -= 0.07;

          result = canvas.toDataURL(
            "image/jpeg",
            quality
          );
        }

        if (result.length > 180000) {
          reject(
            new Error("الصورة كبيرة جدًا. اختر صورة أصغر.")
          );
          return;
        }

        resolve(result);
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

// ==========================================
// معاينة صورة المنتج
// ==========================================

function previewProductImage(data) {
  selectedProductImage = data;

  $("productImagePreview").src = data;

  $("productImagePreview").classList.remove("hidden");

  $("removeProductImage").classList.remove("hidden");
}

async function handleProductImage(file) {
  if (!file) return;

  try {
    const image = await compressProductImage(file);

    previewProductImage(image);

  } catch (error) {
    alert(error.message || "تعذر تجهيز الصورة.");
  }
}

// اختيار صورة من المعرض
if ($("chooseGallery")) {
  $("chooseGallery").onclick = () => {
    $("productImageGallery").click();
  };
}

// التقاط صورة بالكاميرا
if ($("takeProductPhoto")) {
  $("takeProductPhoto").onclick = () => {
    $("productImageCamera").click();
  };
}

// استقبال صورة المعرض
if ($("productImageGallery")) {
  $("productImageGallery").addEventListener("change", event => {
    handleProductImage(event.target.files[0]);
    event.target.value = "";
  });
}

// استقبال صورة الكاميرا
if ($("productImageCamera")) {
  $("productImageCamera").addEventListener("change", event => {
    handleProductImage(event.target.files[0]);
    event.target.value = "";
  });
}

// حذف الصورة المختارة
if ($("removeProductImage")) {
  $("removeProductImage").onclick = () => {
    selectedProductImage = "";

    $("productImagePreview").src = "";

    $("productImagePreview").classList.add("hidden");

    $("removeProductImage").classList.add("hidden");
  };
}

// ==========================================
// إضافة منتج جديد
// ==========================================

if ($("addProduct")) {
  $("addProduct").onclick = async () => {
    if (!isAdmin()) {
      alert("يجب تسجيل الدخول بحساب الإدارة.");
      return;
    }

    const name = $("newName").value.trim();
    const priceText = $("newPrice").value.trim();
    const price = Number(priceText);
    const category = $("newCategory").value.trim();

    if (
      !name ||
      priceText === "" ||
      !Number.isFinite(price) ||
      price < 0 ||
      !category
    ) {
      alert("اكتب اسم المنتج والسعر والقسم بشكل صحيح.");
      return;
    }

    const button = $("addProduct");
    setButtonLoading(button, true, "إضافة المنتج");

    try {
      await db
        .collection("products")
        .add({
          name,
          price,
          category,
          image: selectedProductImage,
          createdAt:
            firebase.firestore.FieldValue.serverTimestamp()
        });

      $("newName").value = "";
      $("newPrice").value = "";
      $("newCategory").value = "";

      selectedProductImage = "";

      $("productImagePreview").src = "";
      $("productImagePreview").classList.add("hidden");
      $("removeProductImage").classList.add("hidden");

      await loadCloud();

      showMessage(
        "adminMsg",
        "تمت إضافة المنتج بنجاح."
      );

    } catch (error) {
      console.error("Add product error:", error);

      showMessage(
        "adminMsg",
        "تعذر إضافة المنتج: " + error.message
      );

    } finally {
      setButtonLoading(button, false, "إضافة المنتج");
    }
  };
}

// ==========================================
// عرض المنتجات في لوحة الإدارة
// ==========================================

function renderAdminProducts() {
  if (!$("adminProducts")) return;

  if (!products.length) {
    $("adminProducts").innerHTML =
      '<p class="muted">لا توجد منتجات حاليًا.</p>';

    return;
  }

  $("adminProducts").innerHTML = products.map(product => `
    <div class="admin-product panel">
      <div>
        <strong>${esc(product.name)}</strong>

        <p>${money(product.price)} جنيه</p>

        <small>${esc(product.category)}</small>
      </div>

      <button
        type="button"
        class="link"
        data-delete-product="${esc(product.id)}">
        حذف المنتج
      </button>
    </div>
  `).join("");
}

// ==========================================
// حذف منتج
// ==========================================

if ($("adminProducts")) {
  $("adminProducts").addEventListener("click", async event => {
    const button = event.target.closest("[data-delete-product]");
    if (!button) return;

    if (!isAdmin()) {
      alert("يجب تسجيل الدخول بحساب الإدارة.");
      return;
    }

    const id = button.dataset.deleteProduct;

    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
      return;
    }

    button.disabled = true;

    try {
      await db
        .collection("products")
        .doc(id)
        .delete();

      delete cart[id];

      await loadCloud();

      showMessage("adminMsg", "تم حذف المنتج بنجاح.");

    } catch (error) {
      console.error("Delete product error:", error);

      showMessage(
        "adminMsg",
        "تعذر حذف المنتج: " + error.message
      );

      button.disabled = false;
    }
  });
}

// ==========================================
// تحديث بيانات دخول الإدارة
// ==========================================

if ($("updateAdminCredentials")) {
  $("updateAdminCredentials").onclick = async () => {
    const user = auth && auth.currentUser;

    if (!user || user.uid !== ADMIN_UID) {
      alert("يجب تسجيل الدخول بحساب الإدارة أولًا.");
      return;
    }

    const email = $("newAdminEmail").value.trim();
    const password = $("newAdminPassword").value;

    if (!email && !password) {
      alert("اكتب البريد الجديد أو كلمة المرور الجديدة.");
      return;
    }

    if (password && password.length < 6) {
      alert("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }

    const button = $("updateAdminCredentials");

    setButtonLoading(
      button,
      true,
      "تحديث بيانات الدخول"
    );

    try {
      if (email) {
        await user.updateEmail(email);
      }

      if (password) {
        await user.updatePassword(password);
      }

      $("newAdminEmail").value = "";
      $("newAdminPassword").value = "";

      showMessage(
        "adminMsg",
        "تم تحديث بيانات الدخول بنجاح."
      );

    } catch (error) {
      console.error("Credentials update error:", error);

      showMessage(
        "adminMsg",
        "تعذر تحديث البيانات. قد تحتاج إلى تسجيل الدخول مرة أخرى. " +
        error.message
      );

    } finally {
      setButtonLoading(
        button,
        false,
        "تحديث بيانات الدخول"
      );
    }
  };
}

// ==========================================
// متابعة حالة تسجيل الدخول
// ==========================================

function startAuthListener() {
  if (!firebaseReady || authListenerStarted) return;

  authListenerStarted = true;

  auth.onAuthStateChanged(async user => {
    if (user && user.uid === ADMIN_UID) {
      $("loginPane").classList.add("hidden");
      $("adminPane").classList.remove("hidden");

      await loadCloud();

    } else {
      $("loginPane").classList.remove("hidden");
      $("adminPane").classList.add("hidden");

      // عدم السماح لحساب آخر بالبقاء مسجلًا داخل لوحة الإدارة
      if (user) {
        try {
          await auth.signOut();
        } catch (error) {
          console.error("Unauthorized sign out error:", error);
        }
      }
    }
  });
}

// ==========================================
// تشغيل الموقع
// ==========================================

async function startStore() {
  if (!firebaseReady) {
    if ($("products")) {
      $("products").innerHTML = `
        <p class="hint">
          تعذر الاتصال بخدمة المتجر.
          راجع إعدادات Firebase.
        </p>
      `;
    }

    return;
  }

  await loadStoreData();

  startAuthListener();
}

startStore();

// ==========================================
// نهاية التطبيق
// ==========================================
