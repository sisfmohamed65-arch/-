
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
  if (!$("adminPane")) return;

  let tabButton = document.querySelector(
    '[data-admin-tab="tabMonthlyReports"]'
  );

  if (!tabButton) {
    const nav = document.querySelector("[data-admin-tab]")?.parentElement;

    if (nav) {
      tabButton = document.createElement("button");
      tabButton.type = "button";
      tabButton.className = "admin-tab-button";
      tabButton.dataset.adminTab = "tabMonthlyReports";
      tabButton.textContent = "التقارير الشهرية";
      nav.appendChild(tabButton);

      tabButton.addEventListener("click", () => {
        showAdminTab("tabMonthlyReports");
      });
    }
  }

  let section = $("tabMonthlyReports");

  if (!section) {
    section = document.createElement("section");
    section.id = "tabMonthlyReports";
    section.className = "admin-tab hidden";

    section.innerHTML = `
      <h2>التقارير الشهرية</h2>
      <p>اختر الشهر لعرض المبيعات والطلبات وتفاصيل الحساب.</p>

      <label for="monthlyReportSelect">اختيار الشهر</label>
      <select id="monthlyReportSelect"></select>

      <div class="monthly-report-stats">
        <div>
          <strong>إجمالي قيمة الطلبات</strong>
          <p id="monthlyAllTotal">0</p>
        </div>

        <div>
          <strong>المبيعات المكتملة</strong>
          <p id="monthlyRevenue">0</p>
        </div>

        <div>
          <strong>عدد الطلبات</strong>
          <p id="monthlyOrderCount">0</p>
        </div>

        <div>
          <strong>طلبات مكتملة</strong>
          <p id="monthlyCompleted">0</p>
        </div>

        <div>
          <strong>طلبات جديدة</strong>
          <p id="monthlyNew">0</p>
        </div>

        <div>
          <strong>طلبات ملغاة</strong>
          <p id="monthlyCancelled">0</p>
        </div>
      </div>

      <h3>تفاصيل طلبات الشهر</h3>
      <div id="monthlyOrderDetails"></div>

      <button type="button" id="downloadMonthlyExcel">
        تحميل تقرير الشهر Excel
      </button>
    `;

    $("adminPane").appendChild(section);
  }

  const months = new Set([monthKey(new Date())]);

  orders.forEach(order => {
    const timestamp = getOrderDate(order);

    if (timestamp) {
      months.add(monthKey(new Date(timestamp)));
    }
  });

  const sortedMonths = [...months].sort().reverse();
  const select = $("monthlyReportSelect");

  if (!select) return;

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
