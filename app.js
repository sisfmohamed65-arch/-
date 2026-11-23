
// ==========================================
// زهرة حماة - التطبيق الرئيسي الكامل
// Firebase + المتجر + الإدارة + التقارير
// ==========================================

// 1) إعداد Firebase
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

// 2) متغيرات المتجر
let adminSessionActive = false;
let products = [];
let orders = [];
let settings = {};
let cart = [];
let selectedImage = "";
let activeCategory = "الكل";

const $ = id => document.getElementById(id);

try {
  cart = JSON.parse(localStorage.getItem("zahretHamaCart") || "[]");
  if (!Array.isArray(cart)) cart = [];
} catch {
  cart = [];
}

// ==========================================
// 3) أدوات مساعدة
// ==========================================

function money(value) {
  return (Number(value) || 0).toLocaleString("ar-EG");
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showMessage(id, message, type = "info") {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.style.display = "block";
  element.style.color =
    type === "error" ? "#b42318" :
    type === "success" ? "#16803c" : "";

  element.setAttribute("role", "status");
}

function setLoading(button, loading, text) {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = text || "جاري التنفيذ...";
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || text || "حفظ";
  }
}

function isAdmin() {
  return !!(
    adminSessionActive &&
    auth.currentUser &&
    auth.currentUser.uid === ADMIN_UID
  );
}

function saveCart() {
  localStorage.setItem("zahretHamaCart", JSON.stringify(cart));
  renderCart();
}

function closeModal(id) {
  $(id)?.classList.add("hidden");
}

// ==========================================
// 4) اسم المتجر والإعدادات
// ==========================================

function applyStoreName(name) {
  const storeName = String(name || "زهرة حماة").trim() || "زهرة حماة";

  if ($("storeTitle")) $("storeTitle").textContent = storeName;
  if ($("footerName")) $("footerName").textContent = storeName;
  if ($("footerNameBottom")) $("footerNameBottom").textContent = storeName;

  const adminHeading = document.querySelector("#adminModal h2");
  if (adminHeading) adminHeading.textContent = "لوحة إدارة " + storeName;

  document.title = storeName + " | المتجر";

  const heroHeading = document.querySelector(".hero h1");
  if (heroHeading) {
    heroHeading.textContent = "أهلاً بيكم في " + storeName + " 🌿";
  }
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
    console.error("Settings load:", error);
  }
}

// حفظ اسم المتجر
$("saveStoreName")?.addEventListener("click", async function () {
  if (!isAdmin()) {
    showMessage("adminMsg", "يجب تسجيل الدخول للإدارة أولاً.", "error");
    return;
  }

  const name = $("editStoreName")?.value.trim();

  if (!name) {
    showMessage("adminMsg", "اكتب اسم المتجر أولاً.", "error");
    return;
  }

  setLoading(this, true, "جاري حفظ الاسم...");

  try {
    await db.collection("settings").doc("main").set({
      storeName: name,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    settings.storeName = name;
    applyStoreName(name);

    showMessage("adminMsg", "تم تغيير اسم المتجر وحفظه بنجاح.", "success");
  } catch (error) {
    console.error(error);
    showMessage("adminMsg", "لم يتم حفظ الاسم. تأكد من صلاحيات Firebase والاتصال.", "error");
  } finally {
    setLoading(this, false);
  }
});

// حفظ وسائل التواصل
$("saveSettings")?.addEventListener("click", async function () {
  if (!isAdmin()) {
    showMessage("adminMsg", "غير مصرح لك بتعديل الإعدادات.", "error");
    return;
  }

  const whatsapp = $("editWhatsapp")?.value.trim() || "";
  const facebook = $("editFacebook")?.value.trim() || "";
  const messenger = $("editMessenger")?.value.trim() || "";

  setLoading(this, true, "جاري الحفظ...");

  try {
    await db.collection("settings").doc("main").set({
      whatsapp,
      facebook,
      messenger,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    settings = { ...settings, whatsapp, facebook, messenger };
    showMessage("adminMsg", "تم حفظ وسائل التواصل بنجاح.", "success");
  } catch (error) {
    console.error(error);
    showMessage("adminMsg", "تعذر حفظ وسائل التواصل.", "error");
  } finally {
    setLoading(this, false);
  }
});

// ==========================================
// 5) تسجيل دخول الإدارة
// ==========================================

async function openAdminLogin() {
  $("adminModal")?.classList.remove("hidden");

  if (isAdmin()) {
    $("loginPane")?.classList.add("hidden");
    $("adminPane")?.classList.remove("hidden");
    return;
  }

  $("loginPane")?.classList.remove("hidden");
  $("adminPane")?.classList.add("hidden");

  if ($("adminEmail")) $("adminEmail").value = "";
  if ($("adminPassword")) $("adminPassword").value = "";
}

$("openAdmin")?.addEventListener("click", openAdminLogin);

$("closeAdmin")?.addEventListener("click", () => closeModal("adminModal"));

$("adminLogin")?.addEventListener("click", async function () {
  const email = $("adminEmail")?.value.trim();
  const password = $("adminPassword")?.value;
  
  if (!email || !password) {
    showMessage("loginMsg", "اكتب البريد الإلكتروني وكلمة المرور.", "error");
    return;
  }

  setLoading(this, true, "جاري تسجيل الدخول...");

  try {
    const result = await auth.signInWithEmailAndPassword(email, password);

    if (result.user.uid !== ADMIN_UID) {
      await auth.signOut();
      adminSessionActive = false;
      showMessage("loginMsg", "هذا الحساب غير مصرح له بدخول الإدارة.", "error");
      return;
    }

    adminSessionActive = true;

    $("adminEmail").value = "";
    $("adminPassword").value = "";

    $("loginPane")?.classList.add("hidden");
    $("adminPane")?.classList.remove("hidden");

    await loadCloud();
    await loadSettings();

    showMessage("adminMsg", "تم تسجيل الدخول بنجاح.", "success");
  } catch (error) {
    console.error("Admin login:", error);
    adminSessionActive = false;
    showMessage("loginMsg", "تعذر تسجيل الدخول. راجع البريد وكلمة المرور.", "error");
  } finally {
    setLoading(this, false);
  }
});

// تسجيل الخروج
$("logout")?.addEventListener("click", async function () {
  adminSessionActive = false;

  try {
    await auth.signOut();
  } catch (error) {
    console.error(error);
  }

  $("adminPane")?.classList.add("hidden");
  $("loginPane")?.classList.remove("hidden");
  closeModal("adminModal");
});

// ==========================================
// 6) تحديث البريد وكلمة المرور
// ==========================================

$("updateAdminCredentials")?.addEventListener("click", async function () {
  if (!isAdmin()) {
    showMessage("adminMsg", "يجب تسجيل الدخول للإدارة أولاً.", "error");
    return;
  }

  const newEmail = $("newAdminEmail")?.value.trim() || "";
  const newPassword = $("newAdminPassword")?.value || "";

  if (!newEmail && !newPassword) {
    showMessage("adminMsg", "اكتب البريد الجديد أو كلمة المرور الجديدة.", "error");
    return;
  }

  if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    showMessage("adminMsg", "صيغة البريد الإلكتروني غير صحيحة.", "error");
    return;
  }

  if (newPassword && newPassword.length < 6) {
    showMessage("adminMsg", "كلمة المرور يجب ألا تقل عن 6 أحرف.", "error");
    return;
  }

  const currentPassword = prompt("للتأكيد الأمني، اكتب كلمة مرور الإدارة الحالية:");
  if (!currentPassword) {
    showMessage("adminMsg", "تم إلغاء تحديث بيانات الدخول.", "error");
    return;
  }

  setLoading(this, true, "جاري تحديث البيانات...");

  try {
    const user = auth.currentUser;
    const credential = firebase.auth.EmailAuthProvider.credential(
      user.email,
      currentPassword
    );

    await user.reauthenticateWithCredential(credential);

    // تحديث البريد الإلكتروني أولاً
    if (newEmail && newEmail !== user.email) {
      await user.updateEmail(newEmail);
    }

    // تحديث كلمة المرور
    if (newPassword) {
      await user.updatePassword(newPassword);
    }

    $("newAdminEmail").value = "";
    $("newAdminPassword").value = "";

    showMessage(
      "adminMsg",
      "تم تحديث بيانات دخول الإدارة بنجاح. احتفظ بالبيانات الجديدة في مكان آمن.",
      "success"
    );

  } catch (error) {
    console.error("Credentials update:", error);

    let message = "تعذر تحديث بيانات الدخول.";

    if (error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential") {
      message = "كلمة المرور الحالية غير صحيحة.";
    } else if (error.code === "auth/email-already-in-use") {
      message = "هذا البريد مستخدم بالفعل في حساب آخر.";
    } else if (error.code === "auth/invalid-email") {
      message = "البريد الإلكتروني غير صالح.";
    } else if (error.code === "auth/weak-password") {
      message = "كلمة المرور الجديدة ضعيفة.";
    } else if (error.code === "auth/requires-recent-login") {
      message = "انتهت صلاحية التأكيد. سجل الدخول مرة أخرى ثم حاول.";
    } else if (error.code === "auth/operation-not-allowed") {
      message = "تحديث بيانات الدخول غير مفعّل في إعدادات Firebase Authentication.";
    }

    showMessage("adminMsg", message, "error");
  } finally {
    setLoading(this, false);
  }
});

// ==========================================
// 7) تحميل المنتجات
// ==========================================

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
    console.error("Products load:", error);
    if ($("products")) {
      $("products").innerHTML = '<p class="muted">تعذر تحميل المنتجات. حاول تحديث الصفحة.</p>';
    }
  }
}

function productName(product) {
  return product.name || product.title || "منتج";
}

function productPrice(product) {
  return Number(product.price || 0);
}

function productImage(product) {
  return product.image || product.imageUrl || product.photo || "";
}

function renderCategories() {
  const container = $("categories");
  if (!container) return;

  const categories = ["الكل", ...new Set(
    products.map(p => p.category).filter(Boolean)
  )];

  container.innerHTML = categories.map(category => `
    <button type="button"
      class="${activeCategory === category ? "primary" : "secondary"}"
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
      activeCategory === "الكل" || product.category === activeCategory;

    const matchesSearch =
      productName(product).toLowerCase().includes(search);

    return matchesCategory && matchesSearch;
  });

  if (!filtered.length) {
    container.innerHTML = '<p class="muted">لا توجد منتجات مطابقة حالياً.</p>';
    return;
  }

  container.innerHTML = filtered.map(product => {
    const image = productImage(product);

    return `
      <article class="product-card">
        ${image
          ? `<img src="${esc(image)}" alt="${esc(productName(product))}" loading="lazy">`
          : `<div class="product-placeholder">🛍️</div>`}
        <div class="product-info">
          <h3>${esc(productName(product))}</h3>
          <p>${esc(product.category || "")}</p>
          <strong>${money(productPrice(product))} جنيه</strong>
          <button class="primary" type="button" data-add-cart="${esc(product.id)}">
            أضف للسلة
          </button>
        </div>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-add-cart]").forEach(button => {
    button.addEventListener("click", () => addToCart(button.dataset.addCart));
  });
}

$("search")?.addEventListener("input", renderProducts);

// ==========================================
// 8) السلة
// ==========================================

function addToCart(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  const existing = cart.find(item => item.id === id);

  if (existing) {
    existing.quantity = (Number(existing.quantity) || 1) + 1;
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
    return sum + Number(item.price || 0) * Number(item.quantity || 1);
  }, 0);
}

function renderCart() {
  const container = $("cartItems");
  const total = cartTotal();

  if (container) {
    if (!cart.length) {
      container.innerHTML = '<p class="muted">السلة لسه فاضية.</p>';
    } else {
      container.innerHTML = cart.map(item => `
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
    }

    container.querySelectorAll("[data-cart-minus]").forEach(button => {
      button.addEventListener("click", () => changeQuantity(button.dataset.cartMinus, -1));
    });

    container.querySelectorAll("[data-cart-plus]").forEach(button => {
      button.addEventListener("click", () => changeQuantity(button.dataset.cartPlus, 1));
    });

    container.querySelectorAll("[data-cart-remove]").forEach(button => {
      button.addEventListener("click", () => {
        cart = cart.filter(item => item.id !== button.dataset.cartRemove);
        saveCart();
      });
    });
  }

  if ($("total")) $("total").textContent = money(total);

  if ($("cartCount")) {
    $("cartCount").textContent = cart.reduce(
      (sum, item) => sum + Number(item.quantity || 1), 0
    );
  }
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

$("clearCart")?.addEventListener("click", () => {
  if (!cart.length) return;

  if (confirm("هل تريد تفريغ السلة؟")) {
    cart = [];
    saveCart();
  }
});

// ==========================================
// 9) إتمام الطلب
// ==========================================

$("checkout")?.addEventListener("click", () => {
  if (!cart.length) {
    alert("السلة فارغة. أضف منتجات أولاً.");
    return;
  }

  $("checkoutModal")?.classList.remove("hidden");
});

$("sendOrder")?.addEventListener("click", async function () {
  if (!cart.length) {
    alert("السلة فارغة.");
    return;
  }

  const customerName = $("customerName")?.value.trim();
  const customerPhone = $("customerPhone")?.value.trim();
  const customerAddress = $("customerAddress")?.value.trim();
  const contactChannel = $("contactChannel")?.value || "whatsapp";

  if (!customerName || !customerPhone || !customerAddress) {
    alert("من فضلك اكتب الاسم ورقم الموبايل والعنوان.");
    return;
  }

  if (!/^[0-9+\s()-]{8,20}$/.test(customerPhone)) {
    alert("رقم الموبايل غير صحيح.");
    return;
  }

  const orderItems = cart.map(item => ({
    productId: item.id,
    name: item.name,
    price: Number(item.price),
    quantity: Number(item.quantity)
  }));

  const total = cartTotal();

  setLoading(this, true, "جاري إرسال الطلب...");

  try {
    await db.collection("orders").add({
      customerName,
      customerPhone,
      customerAddress,
      contactChannel,
      items: orderItems,
      total,
      status: "جديد",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    cart = [];
    saveCart();

    if ($("customerName")) $("customerName").value = "";
    if ($("customerPhone")) $("customerPhone").value = "";
    if ($("customerAddress")) $("customerAddress").value = "";

    closeModal("checkoutModal");

    alert("تم إرسال طلبك بنجاح. شكراً لثقتكم بنا.");

  } catch (error) {
    console.error("Order save:", error);
    alert("تعذر إرسال الطلب. حاول مرة أخرى أو تواصل مع المتجر.");
  } finally {
    setLoading(this, false);
  }
});

// ==========================================
// 10) إدارة المنتجات
// ==========================================

function renderAdminProducts() {
  const container = $("adminProducts");
  if (!container) return;

  if (!products.length) {
    container.innerHTML = "<p>لا توجد منتجات حالياً.</p>";
    return;
  }

  container.innerHTML = products.map(product => `
    <div class="admin-order">
      <strong>${esc(productName(product))}</strong>
      <p>السعر: ${money(productPrice(product))} جنيه</p>
      <p>القسم: ${esc(product.category || "بدون قسم")}</p>
      <div class="order-actions">
        <button type="button" class="secondary" data-edit-product="${esc(product.id)}">تعديل</button>
        <button type="button" class="secondary" data-delete-product="${esc(product.id)}">حذف</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("[data-edit-product]").forEach(button => {
    button.addEventListener("click", () => editProduct(button.dataset.editProduct));
  });

  container.querySelectorAll("[data-delete-product]").forEach(button => {
    button.addEventListener("click", () => deleteProduct(button.dataset.deleteProduct));
  });
}

$("chooseGallery")?.addEventListener("click", () => $("productImageGallery")?.click());
$("takeProductPhoto")?.addEventListener("click", () => $("productImageCamera")?.click());

async function prepareImage(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("الملف المختار ليس صورة.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("حجم الصورة كبير. اختر صورة أقل من 8 ميجابايت.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("تعذر قراءة الصورة."));

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("الصورة غير صالحة."));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 1000;
        const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));

        canvas.width = Math.round(image.width * ratio);
        canvas.height = Math.round(image.height * ratio);

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

async function handleImageInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    selectedImage = await prepareImage(file);

    if ($("productImagePreview")) {
      $("productImagePreview").src = selectedImage;
      $("productImagePreview").classList.remove("hidden");
    }

    $("removeProductImage")?.classList.remove("hidden");
  } catch (error) {
    alert(error.message);
  }

  event.target.value = "";
}

$("productImageGallery")?.addEventListener("change", handleImageInput);
$("productImageCamera")?.addEventListener("change", handleImageInput);

$("removeProductImage")?.addEventListener("click", () => {
  selectedImage = "";

  if ($("productImagePreview")) {
    $("productImagePreview").src = "";
    $("productImagePreview").classList.add("hidden");
  }

  $("removeProductImage")?.classList.add("hidden");
});

$("addProduct")?.addEventListener("click", async function () {
  if (!isAdmin()) return;

  const name = $("newName")?.value.trim();
  const price = Number($("newPrice")?.value);
  const category = $("newCategory")?.value.trim();

  if (!name || !Number.isFinite(price) || price < 0 || !category) {
    alert("اكتب اسم المنتج والسعر والقسم بشكل صحيح.");
    return;
  }

  setLoading(this, true, "جاري إضافة المنتج...");

  try {
    await db.collection("products").add({
      name,
      price,
      category,
      image: selectedImage || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    $("newName").value = "";
    $("newPrice").value = "";
    $("newCategory").value = "";
    selectedImage = "";

    $("productImagePreview")?.classList.add("hidden");
    $("removeProductImage")?.classList.add("hidden");

    await loadProducts();
    showMessage("adminMsg", "تمت إضافة المنتج بنجاح.", "success");

  } catch (error) {
    console.error(error);
    showMessage("adminMsg", "تعذرت إضافة المنتج. راجع صلاحيات Firebase.", "error");
  } finally {
    setLoading(this, false);
  }
});

async function editProduct(id) {
  if (!isAdmin()) return;

  const product = products.find(p => p.id === id);
  if (!product) return;

  const name = prompt("اسم المنتج:", productName(product));
  if (name === null) return;

  const priceText = prompt("السعر:", productPrice(product));
  if (priceText === null) return;

  const category = prompt("القسم:", product.category || "");
  if (category === null) return;

  const price = Number(priceText);

  if (!name.trim() || !Number.isFinite(price) || price < 0 || !category.trim()) {
    alert("البيانات المدخلة غير صحيحة.");
    return;
  }

  try {
    await db.collection("products").doc(id).update({
      name: name.trim(),
      price,
      category: category.trim()
    });

    await loadProducts();
    showMessage("adminMsg", "تم تعديل المنتج.", "success");
  } catch (error) {
    console.error(error);
    showMessage("adminMsg", "تعذر تعديل المنتج.", "error");
  }
}

async function deleteProduct(id) {
  if (!isAdmin()) return;

  if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;

  try {
    await db.collection("products").doc(id).delete();
    await loadProducts();
    showMessage("adminMsg", "تم حذف المنتج.", "success");
  } catch (error) {
    console.error(error);
    showMessage("adminMsg", "تعذر حذف المنتج.", "error");
  }
}

// ==========================================
// 11) الطلبات والإحصائيات
// ==========================================

function orderDate(order) {
  if (order.createdAt?.toDate) return order.createdAt.toDate();
  if (order.createdAt?.seconds) return new Date(order.createdAt.seconds * 1000);
  return null;
}

function orderItems(order) {
  return Array.isArray(order.items) ? order.items : [];
}

function orderCustomer(order) {
  return order.customerName || order.name || "عميل";
}

function orderPhone(order) {
  return order.customerPhone || order.phone || "";
}

function orderAddress(order) {
  return order.customerAddress || order.address || "";
}

function orderStatus(order) {
  return order.status || "جديد";
}

async function loadCloud() {
  if (!isAdmin()) return;

  try {
    const snapshot = await db.collection("orders").get();

    orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    orders.sort((a, b) => {
      const da = orderDate(a)?.getTime() || 0;
      const dbb = orderDate(b)?.getTime() || 0;
      return dbb - da;
    });

    renderOrders();
    renderStats();
    renderMonthlyReport();

  } catch (error) {
    console.error("Orders load:", error);
    showMessage("adminMsg", "تعذر تحميل الطلبات. راجع قواعد Firestore.", "error");
  }
}

function renderStats() {
  const completed = orders.filter(o =>
    ["مكتمل", "مكتملة", "completed"].includes(orderStatus(o))
  );

  const newOrders = orders.filter(o =>
    ["جديد", "new"].includes(orderStatus(o))
  );

  const revenue = completed.reduce((sum, order) => {
    return sum + Number(order.total || 0);
  }, 0);

  if ($("statOrders")) $("statOrders").textContent = money(orders.length);
  if ($("statNew")) $("statNew").textContent = money(newOrders.length);
  if ($("statCompleted")) $("statCompleted").textContent = money(completed.length);
  if ($("statRevenue")) $("statRevenue").textContent = money(revenue) + " جنيه";
}

function renderOrders() {
  const container = $("adminOrders");
  if (!container) return;

  if (!orders.length) {
    container.innerHTML = "<p>لا توجد طلبات حتى الآن.</p>";
    return;
  }

  container.innerHTML = orders.map(order => {
    const date = orderDate(order);
    const items = orderItems(order);

    return `
      <article class="admin-order">
        <h3>طلب ${esc(order.id.slice(0, 8))}</h3>
        <p><strong>العميل:</strong> ${esc(orderCustomer(order))}</p>
        <p><strong>الهاتف:</strong> ${esc(orderPhone(order))}</p>
        <p><strong>العنوان:</strong> ${esc(orderAddress(order))}</p>
        <p><strong>التاريخ:</strong> ${date ? esc(date.toLocaleString("ar-EG")) : "غير محدد"}</p>
        <p><strong>الحالة:</strong> ${esc(orderStatus(order))}</p>
        <p><strong>الإجمالي:</strong> ${money(order.total)} جنيه</p>
        <ul>
          ${items.map(item => `
            <li>${esc(item.name || item.productName || "منتج")} —
              ${money(item.quantity || 1)} × ${money(item.price || 0)} جنيه
            </li>
          `).join("")}
        </ul>
        <div class="order-actions">
          <button type="button" class="secondary" data-order-status="${esc(order.id)}" data-status="مكتمل">تحديد مكتمل</button>
          <button type="button" class="secondary" data-order-status="${esc(order.id)}" data-status="جديد">تحديد جديد</button>
          <button type="button" class="secondary" data-order-delete="${esc(order.id)}">حذف الطلب</button>
        </div>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-order-status]").forEach(button => {
    button.addEventListener("click", () => {
      updateOrderStatus(button.dataset.orderStatus, button.dataset.status);
    });
  });

  container.querySelectorAll("[data-order-delete]").forEach(button => {
    button.addEventListener("click", () => {
      deleteOrder(button.dataset.orderDelete);
    });
  });
}

async function updateOrderStatus(id, status) {
  if (!isAdmin()) return;

  try {
    await db.collection("orders").doc(id).update({ status });
    await loadCloud();
    showMessage("adminMsg", "تم تحديث حالة الطلب.", "success");
  } catch (error) {
    console.error(error);
    showMessage("adminMsg", "تعذر تحديث حالة الطلب.", "error");
  }
}

async function deleteOrder(id) {
  if (!isAdmin()) return;

  if (!confirm("هل تريد حذف هذا الطلب نهائياً؟")) return;

  try {
    await db.collection("orders").doc(id).delete();
    await loadCloud();
    showMessage("adminMsg", "تم حذف الطلب.", "success");
  } catch (error) {
    console.error(error);
    showMessage("adminMsg", "تعذر حذف الطلب.", "error");
  }
}

// ==========================================
// 12) التقارير الشهرية والتصدير
// ==========================================

function renderMonthlyReport() {
  const pane = $("adminPane");
  if (!pane || !isAdmin()) return;

  let report = $("monthlyReportSection");

  if (!report) {
    report = document.createElement("section");
    report.id = "monthlyReportSection";
    report.className = "admin-section";

    report.innerHTML = `
      <h3>📅 التقارير الشهرية</h3>
      <p id="monthlyReportText">التقرير الشهري</p>
      <button type="button" class="secondary" id="refreshMonthlyReport">تحديث التقرير</button>
      <button type="button" class="primary" id="downloadMonthlyReport">تحميل تقرير CSV</button>
    `;

    pane.querySelector(".admin-content")?.appendChild(report);

    $("refreshMonthlyReport")?.addEventListener("click", renderMonthlyReport);
    $("downloadMonthlyReport")?.addEventListener("click", downloadMonthlyReport);
  }

  const now = new Date();
  const monthOrders = orders.filter(order => {
    const date = orderDate(order);
    return date &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
  });

  const completed = monthOrders.filter(order =>
    ["مكتمل", "مكتملة", "completed"].includes(orderStatus(order))
  );

  const revenue = completed.reduce((sum, order) =>
    sum + Number(order.total || 0), 0
  );

  const text = $("monthlyReportText");

  if (text) {
    text.textContent =
      `طلبات الشهر: ${monthOrders.length} | الطلبات المكتملة: ${completed.length} | إجمالي المبيعات المكتملة: ${money(revenue)} جنيه`;
  }
}

function downloadMonthlyReport() {
  if (!isAdmin()) return;

  const rows = [
    ["رقم الطلب", "اسم العميل", "رقم الهاتف", "الإجمالي", "الحالة", "التاريخ"]
  ];

  orders.forEach(order => {
    const date = orderDate(order);

    rows.push([
      order.id,
      orderCustomer(order),
      orderPhone(order),
      Number(order.total || 0),
      orderStatus(order),
      date ? date.toLocaleString("ar-EG") : ""
    ]);
  });

  const csv = "\uFEFF" + rows.map(row =>
    row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "zahret-hama-orders-report.csv";
  link.click();

  URL.revokeObjectURL(url);
}

// ==========================================
// 13) التنقل داخل لوحة الإدارة
// ==========================================

document.querySelectorAll("[data-admin-tab]").forEach(button => {
  button.addEventListener("click", () => {
    if (!isAdmin()) return;

    const tabId = button.dataset.adminTab;

    document.querySelectorAll(".admin-tab").forEach(tab => {
      tab.classList.add("hidden");
    });

    $(tabId)?.classList.remove("hidden");

    document.querySelectorAll("[data-admin-tab]").forEach(navButton => {
      navButton.classList.remove("active");
    });

    button.classList.add("active");

    if (tabId === "tabOrders" || tabId === "tabSales") {
      loadCloud();
    }

    if (tabId === "tabContact" || tabId === "tabSettings") {
      loadSettings();
    }
  });
});

// ==========================================
// 14) إغلاق النوافذ
// ==========================================

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    closeModal(button.dataset.close);
  });
});

["checkoutModal", "adminModal"].forEach(id => {
  $(id)?.addEventListener("click", event => {
    if (event.target === $(id)) {
      closeModal(id);
    }
  });
});

// ==========================================
// 15) تشغيل المتجر
// ==========================================

async function startStore() {
  renderCart();

  await loadSettings();
  await loadProducts();

  // لا نفتح لوحة الإدارة تلقائياً.
  // يجب أن يسجل المدير الدخول بنفسه.
}

document.addEventListener("DOMContentLoaded", startStore);
