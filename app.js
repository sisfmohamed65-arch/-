
// ==================================
// إعدادات Firebase
// ==================================

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

const $ = id => document.getElementById(id);

const money = n => Number(n || 0).toLocaleString("ar-EG", {
  maximumFractionDigits: 2
});

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// ==================================
// تشغيل Firebase
// ==================================

try {
  if (window.firebase) {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    db = firebase.firestore();
    auth = firebase.auth();
    firebaseReady = true;
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}

// ==================================
// تحميل بيانات المتجر
// ==================================

async function loadStoreData() {
  if (!firebaseReady) return false;

  try {
    const ps = await db.collection("products").get();

    products = ps.docs.map(doc => {
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

    const ss = await db.collection("settings").doc("main").get();

    if (ss.exists) {
      const data = ss.data();

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

// ==================================
// عرض المتجر والمنتجات
// ==================================

function render() {
  $("storeTitle").textContent = settings.name;
  $("footerName").textContent = settings.name;

  if ($("footerNameBottom")) {
    $("footerNameBottom").textContent = settings.name;
  }

  const cats = [
    "الكل",
    ...new Set(products.map(p => p.category).filter(Boolean))
  ];

  $("categories").innerHTML = cats.map(category => `
    <button
      class="chip ${activeCategory === category ? "active" : ""}"
      data-cat="${esc(category)}">
      ${esc(category)}
    </button>
  `).join("");

  const query = $("search").value.trim().toLowerCase();

  const shown = products.filter(p =>
    (activeCategory === "الكل" || p.category === activeCategory) &&
    String(p.name || "").toLowerCase().includes(query)
  );

  $("products").innerHTML = shown.length
    ? shown.map(p => `
      <article class="product">
        ${
          p.image
            ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">`
            : `<div class="placeholder">${p.emoji}</div>`
        }

        <h3>${esc(p.name)}</h3>
        <div class="price">${money(p.price)} جنيه</div>

        <button class="primary" data-add="${esc(p.id)}">
          أضف للسلة
        </button>
      </article>
    `).join("")
    : `<p class="muted">${
        products.length
          ? "مفيش منتجات مطابقة."
          : "لا توجد منتجات حاليًا."
      }</p>`;

  renderCart();
}

// ==================================
// السلة
// ==================================

function renderCart() {
  const entries = Object.entries(cart).filter(([, quantity]) => quantity > 0);

  const total = entries.reduce((sum, [id, quantity]) => {
    const product = products.find(p => String(p.id) === id);
    return sum + (product ? product.price * quantity : 0);
  }, 0);

  $("cartCount").textContent = entries.reduce(
    (sum, [, quantity]) => sum + quantity, 0
  );

  $("total").textContent = money(total);

  $("cartItems").innerHTML = entries.length
    ? entries.map(([id, quantity]) => {
        const product = products.find(p => String(p.id) === id);
        if (!product) return "";

        return `
          <div class="cart-row">
            <span>
              ${esc(product.name)} — ${money(product.price)} جنيه
            </span>

            <span class="qty">
              <button data-minus="${esc(id)}" type="button">−</button>
              ${quantity}
              <button data-plus="${esc(id)}" type="button">+</button>
            </span>
          </div>
        `;
      }).join("")
    : `<p class="muted">السلة لسه فاضية.</p>`;
}

$("products").addEventListener("click", event => {
  const button = event.target.closest("[data-add]");
  if (!button) return;

  const id = button.dataset.add;
  cart[id] = (cart[id] || 0) + 1;

  renderCart();
});

$("categories").addEventListener("click", event => {
  const button = event.target.closest("[data-cat]");
  if (!button) return;

  activeCategory = button.dataset.cat;
  render();
});

$("cartItems").addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;

  const id = button.dataset.plus || button.dataset.minus;
  if (!id) return;

  cart[id] = (cart[id] || 0) + (button.dataset.plus ? 1 : -1);

  if (cart[id] <= 0) {
    delete cart[id];
  }

  renderCart();
});

$("search").addEventListener("input", render);

$("clearCart").onclick = () => {
  cart = {};
  renderCart();
};

// ==================================
// إتمام الطلب
// ==================================

$("checkout").onclick = () => {
  if (!Object.keys(cart).length) {
    return alert("ضيف منتجات للسلة الأول.");
  }

  $("checkoutModal").classList.remove("hidden");
};

$("sendOrder").onclick = async () => {
  const name = $("customerName").value.trim();
  const phone = $("customerPhone").value.trim();
  const address = $("customerAddress").value.trim();
  const channel = $("contactChannel").value;

  if (!name || !phone || !address) {
    return alert("اكتب الاسم ورقم الموبايل والعنوان.");
  }

  if (!firebaseReady) {
    return alert("تعذر الاتصال بقاعدة البيانات.");
  }

  const destination =
    channel === "whatsapp"
      ? settings.whatsapp
      : channel === "messenger"
        ? settings.messenger
        : settings.facebook;

  if (!destination) {
    return alert("وسيلة التواصل المختارة غير مضافة في إعدادات المتجر.");
  }

  const entries = Object.entries(cart).filter(([, quantity]) => quantity > 0);

  const validEntries = entries.filter(([id]) =>
    products.some(p => String(p.id) === id)
  );

  if (!validEntries.length) {
    return alert("السلة فارغة أو المنتجات لم تعد متاحة.");
  }

  const items = validEntries.map(([id, quantity]) => {
    const product = products.find(p => String(p.id) === id);

    return {
      productId: id,
      name: product.name,
      price: Number(product.price),
      quantity
    };
  });

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

  const sendButton = $("sendOrder");
  sendButton.disabled = true;

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
    console.error("Order error:", error);
    alert("تعذر حفظ الطلب. حاول مرة أخرى.");
    sendButton.disabled = false;
    return;
  }

  if (channel === "whatsapp") {
    const digits = settings.whatsapp.replace(/\D/g, "");

    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      "_blank"
    );

  } else {
    try {
      await navigator.clipboard.writeText(message);
    } catch (error) {
      console.error("Clipboard error:", error);
    }

    window.open(destination, "_blank");
    alert("تفاصيل الطلب جاهزة. الصقها في محادثة الصفحة.");
  }

  cart = {};
  renderCart();

  $("checkoutModal").classList.add("hidden");
  $("customerName").value = "";
  $("customerPhone").value = "";
  $("customerAddress").value = "";

  sendButton.disabled = false;
};

// ==================================
// فتح وإغلاق النوافذ
// ==================================

$("openAdmin").onclick = () => {
  $("adminModal").classList.remove("hidden");
};

document.querySelectorAll("[data-close]").forEach(button => {
  button.onclick = () => {
    $(button.dataset.close).classList.add("hidden");
  };
});

// ==================================
// تسجيل دخول الإدارة
// ==================================

$("adminLogin").onclick = async () => {
  if (!firebaseReady) {
    $("loginMsg").textContent = "تعذر الاتصال بـ Firebase.";
    return;
  }

  try {
    const result = await auth.signInWithEmailAndPassword(
      $("adminEmail").value.trim(),
      $("adminPassword").value
    );

    if (result.user.uid !== ADMIN_UID) {
      await auth.signOut();
      $("loginMsg").textContent = "هذا الحساب ليس حساب الإدارة.";
      return;
    }

    $("loginPane").classList.add("hidden");
    $("adminPane").classList.remove("hidden");
    $("loginMsg").textContent = "";

    await loadCloud();

  } catch (error) {
    console.error(error);
    $("loginMsg").textContent =
      "بيانات الدخول غير صحيحة أو تعذر الاتصال.";
  }
};

// ==================================
// تحميل لوحة الإدارة
// ==================================

async function loadCloud() {
  if (!firebaseReady) return;

  const success = await loadStoreData();

  if (!success) {
    $("adminMsg").textContent = "تعذر تحميل بيانات المتجر.";
    return;
  }

  $("editStoreName").value = settings.name;
  $("editWhatsapp").value = settings.whatsapp;
  $("editFacebook").value = settings.facebook;
  $("editMessenger").value = settings.messenger;

  await loadOrders();
  renderAdminProducts();
}

// ==================================
// الطلبات
// ==================================

async function loadOrders() {
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

    $("adminOrders").innerHTML =
      '<p class="hint">تعذر تحميل الطلبات.</p>';
  }
}

// ==================================
// إحصائيات المتجر
// ==================================

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

  $("statOrders").textContent = orders.length;
  $("statNew").textContent = newOrders.length;
  $("statCompleted").textContent = completed.length;
  $("statRevenue").textContent = money(revenue) + " جنيه";
}

// ==================================
// عرض تفاصيل الطلبات
// ==================================

function renderOrders() {
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
    const items = Array.isArray(order.items) ? order.items : [];

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
        — ${money(Number(item.price || 0) * Number(item.quantity || 0))} جنيه
      </li>
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

        ${
          order.status === "new"
            ? `
              <div class="order-actions">
                <button
                  class="primary"
                  data-status="completed"
                  data-id="${esc(order.id)}">
                  تأكيد اكتمال الطلب
                </button>

                <button
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

// ==================================
// تغيير حالة الطلب
// ==================================

$("adminOrders").addEventListener("click", async event => {
  const button = event.target.closest("[data-status]");
  if (!button) return;

  const id = button.dataset.id;
  const status = button.dataset.status;

  const message = status === "completed"
    ? "هل تؤكد أن الطلب اكتمل؟"
    : "هل تريد إلغاء هذا الطلب؟";

  if (!confirm(message)) return;

  try {
    await db.collection("orders").doc(id).update({ status });

    await loadOrders();
    $("adminMsg").textContent = "تم تحديث حالة الطلب.";

  } catch (error) {
    console.error(error);
    $("adminMsg").textContent = "تعذر تحديث حالة الطلب.";
  }
});

// ==================================
// تسجيل الخروج
// ==================================

$("logout").onclick = async () => {
  if (auth) {
    await auth.signOut();
  }

  $("adminPane").classList.add("hidden");
  $("loginPane").classList.remove("hidden");
  $("adminModal").classList.add("hidden");
  $("adminPassword").value = "";
};

// ==================================
// حفظ بيانات المتجر والتواصل
// ==================================

$("saveSettings").onclick = async () => {
  const name = $("editStoreName").value.trim();
  const whatsapp = $("editWhatsapp").value.trim();
  const facebook = $("editFacebook").value.trim();
  const messenger = $("editMessenger").value.trim();

  if (!name) {
    return alert("اكتب اسم المتجر.");
  }

  if (!firebaseReady) {
    return alert("Firebase غير مربوط.");
  }

  try {
    await db.collection("settings").doc("main").set({
      name,
      whatsapp,
      facebook,
      messenger
    }, { merge: true });

    settings = { name, whatsapp, facebook, messenger };

    render();

    $("adminMsg").textContent =
      "تم حفظ اسم المتجر وبيانات التواصل.";

  } catch (error) {
    console.error(error);
    $("adminMsg").textContent = "تعذر الحفظ: " + error.message;
  }
};

// ==================================
// اختيار وضغط صورة المنتج
// ==================================

function compressProductImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("الملف المختار ليس صورة."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("تعذر قراءة الصورة."));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error("الصورة غير صالحة."));

      img.onload = () => {
        const maxSide = 900;
        const scale = Math.min(
          1,
          maxSide / Math.max(img.width, img.height)
        );

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("تعذر تجهيز الصورة."));
          return;
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let quality = 0.65;
        let result = canvas.toDataURL("image/jpeg", quality);

        while (result.length > 240000 && quality > 0.3) {
          quality -= 0.08;
          result = canvas.toDataURL("image/jpeg", quality);
        }

        if (result.length > 240000) {
          reject(new Error("الصورة كبيرة جدًا. اختر صورة أصغر."));
          return;
        }

        resolve(result);
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

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

// زر اختيار صورة من المعرض
$("chooseGallery").onclick = () => {
  $("productImageGallery").click();
};

// زر التصوير بالكاميرا
$("takeProductPhoto").onclick = () => {
  $("productImageCamera").click();
};

// استقبال صورة المعرض
$("productImageGallery").addEventListener("change", event => {
  handleProductImage(event.target.files[0]);
  event.target.value = "";
});

// استقبال صورة الكاميرا
$("productImageCamera").addEventListener("change", event => {
  handleProductImage(event.target.files[0]);
  event.target.value = "";
});

// إزالة الصورة المختارة
$("removeProductImage").onclick = () => {
  selectedProductImage = "";

  $("productImagePreview").src = "";
  $("productImagePreview").classList.add("hidden");
  $("removeProductImage").classList.add("hidden");
};

// ==================================
// إضافة منتج جديد بالصورة
// ==================================

$("addProduct").onclick = async () => {
  const name = $("newName").value.trim();
  const price = Number($("newPrice").value);
  const category = $("newCategory").value.trim();

  if (
    !name ||
    $("newPrice").value.trim() === "" ||
    !Number.isFinite(price) ||
    price < 0 ||
    !category
  ) {
    return alert("اكتب اسم المنتج والسعر والقسم بشكل صحيح.");
  }

  if (!firebaseReady) {
    return alert("Firebase غير مربوط.");
  }

  const button = $("addProduct");
  button.disabled = true;
  button.textContent = "جاري إضافة المنتج...";

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

    selectedProductImage = "";

    $("productImagePreview").src = "";
    $("productImagePreview").classList.add("hidden");
    $("removeProductImage").classList.add("hidden");

    await loadCloud();

    $("adminMsg").textContent = "تمت إضافة المنتج بالصورة بنجاح.";

  } catch (error) {
    console.error("Add product error:", error);
    $("adminMsg").textContent =
      "تعذر إضافة المنتج: " + error.message;

  } finally {
    button.disabled = false;
    button.textContent = "إضافة المنتج";
  }
};

// ==================================
// عرض المنتجات داخل لوحة الإدارة
// ==================================

function renderAdminProducts() {
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
        class="link"
        type="button"
        data-delete-product="${esc(product.id)}">
        حذف المنتج
      </button>
    </div>
  `).join("");
}

// ==================================
// حذف المنتجات
// ==================================

$("adminProducts").addEventListener("click", async event => {
  const button = event.target.closest("[data-delete-product]");
  if (!button) return;

  const id = button.dataset.deleteProduct;

  if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;

  try {
    await db.collection("products").doc(id).delete();

    await loadCloud();

    $("adminMsg").textContent = "تم حذف المنتج بنجاح.";

  } catch (error) {
    console.error("Delete product error:", error);
    $("adminMsg").textContent =
      "تعذر حذف المنتج: " + error.message;
  }
});

// ==================================
// تحديث بيانات دخول الإدارة
// ==================================

$("updateAdminCredentials").onclick = async () => {
  const email = $("newAdminEmail").value.trim();
  const password = $("newAdminPassword").value;

  const user = auth && auth.currentUser;

  if (!user || user.uid !== ADMIN_UID) {
    return alert("يجب تسجيل الدخول بحساب الإدارة أولًا.");
  }

  if (!email && !password) {
    return alert("اكتب البريد الجديد أو كلمة المرور الجديدة.");
  }

  if (password && password.length < 6) {
    return alert("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
  }

  try {
    if (email) {
      await user.updateEmail(email);
    }

    if (password) {
      await user.updatePassword(password);
    }

    $("newAdminEmail").value = "";
    $("newAdminPassword").value = "";

    $("adminMsg").textContent =
      "تم تحديث بيانات الدخول بنجاح.";

  } catch (error) {
    console.error("Credentials update error:", error);

    $("adminMsg").textContent =
      "تعذر تحديث البيانات. قد تحتاج إلى تسجيل الدخول مرة أخرى. " +
      error.message;
  }
};

// ==================================
// بدء تشغيل المتجر
// ==================================

async function startStore() {
  if (!firebaseReady) {
    $("products").innerHTML =
      '<p class="hint">تعذر الاتصال بخدمة المتجر. راجع إعدادات Firebase.</p>';
    return;
  }

  await loadStoreData();

  auth.onAuthStateChanged(async user => {
    if (user && user.uid === ADMIN_UID) {
      $("loginPane").classList.add("hidden");
      $("adminPane").classList.remove("hidden");

      await loadCloud();

    } else {
      $("loginPane").classList.remove("hidden");
      $("adminPane").classList.add("hidden");
    }
  });
}

// ==================================
// تشغيل الموقع
// ==================================

startStore();
