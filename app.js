
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

try {
  if (window.firebase) {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    firebaseReady = true;
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}

const sampleProducts = [
  {id:"s1",name:"جبنة بيضاء",price:85,category:"أجبان",image:"",emoji:"🧀"},
  {id:"s2",name:"لبن كامل الدسم",price:32,category:"ألبان",image:"",emoji:"🥛"},
  {id:"s3",name:"زيتون أخضر",price:65,category:"مخللات",image:"",emoji:"🫒"},
  {id:"s4",name:"عسل أسود",price:45,category:"بقالة",image:"",emoji:"🍯"}
];

let products = [...sampleProducts];
let cart = {};
let settings = {
  name:"زهرة حماة",
  whatsapp:"",
  messenger:"",
  facebook:""
};
let activeCategory = "الكل";
let pressTimer;

const $ = id => document.getElementById(id);
const money = n => Number(n).toLocaleString("ar-EG",{maximumFractionDigits:2});

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function render() {
  $("storeTitle").textContent = settings.name;
  $("footerName").textContent = settings.name;

  const cats = ["الكل",...new Set(products.map(p=>p.category).filter(Boolean))];

  $("categories").innerHTML = cats.map(c =>
    `<button class="chip ${activeCategory===c?"active":""}" data-cat="${esc(c)}">${esc(c)}</button>`
  ).join("");

  const q = $("search").value.trim().toLowerCase();

  const shown = products.filter(p =>
    (activeCategory==="الكل" || p.category===activeCategory) &&
    p.name.toLowerCase().includes(q)
  );

  $("products").innerHTML = shown.length
    ? shown.map(p => `
      <article class="product">
        ${p.image
          ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">`
          : `<div class="placeholder">${p.emoji||"🛍️"}</div>`}
        <h3>${esc(p.name)}</h3>
        <div class="price">${money(p.price)} جنيه</div>
        <button class="primary" data-add="${esc(p.id)}">أضف للسلة</button>
      </article>`).join("")
    : `<p class="muted">مفيش منتجات مطابقة.</p>`;

  renderCart();
}

function renderCart() {
  const entries = Object.entries(cart).filter(([,n])=>n>0);
  const total = entries.reduce((sum,[id,n]) =>
    sum + (products.find(p=>String(p.id)===id)?.price||0)*n,0
  );

  $("cartCount").textContent = entries.reduce((s,[,n])=>s+n,0);
  $("total").textContent = money(total);

  $("cartItems").innerHTML = entries.length
    ? entries.map(([id,n]) => {
        const p = products.find(x=>String(x.id)===id);
        return p ? `
          <div class="cart-row">
            <span>${esc(p.name)} — ${money(p.price)} جنيه</span>
            <span class="qty">
              <button data-minus="${esc(id)}">−</button>
              ${n}
              <button data-plus="${esc(id)}">+</button>
            </span>
          </div>` : "";
      }).join("")
    : `<p class="muted">السلة لسه فاضية.</p>`;
}

$("products").addEventListener("click",e=>{
  const b=e.target.closest("[data-add]");
  if(!b)return;
  const id=b.dataset.add;
  cart[id]=(cart[id]||0)+1;
  renderCart();
});

$("categories").addEventListener("click",e=>{
  const b=e.target.closest("[data-cat]");
  if(!b)return;
  activeCategory=b.dataset.cat;
  render();
});

$("cartItems").addEventListener("click",e=>{
  const b=e.target.closest("button");
  if(!b)return;
  const id=b.dataset.plus||b.dataset.minus;
  if(!id)return;
  cart[id]=(cart[id]||0)+(b.dataset.plus?1:-1);
  if(cart[id]<=0)delete cart[id];
  renderCart();
});

$("search").addEventListener("input",render);
$("clearCart").onclick=()=>{cart={};renderCart();};

$("checkout").onclick=()=>{
  if(!Object.keys(cart).length)return alert("ضيف منتجات للسلة الأول.");
  $("checkoutModal").classList.remove("hidden");
};

$("sendOrder").onclick=async()=>{
  const name=$("customerName").value.trim();
  const phone=$("customerPhone").value.trim();
  const address=$("customerAddress").value.trim();

  if(!name||!phone||!address)
    return alert("من فضلك اكتب الاسم ورقم الموبايل والعنوان.");

  const channel=$("contactChannel").value;
  const destination=channel==="whatsapp"
    ? settings.whatsapp
    : channel==="messenger" ? settings.messenger : settings.facebook;

  if(!destination)
    return alert("وسيلة التواصل المختارة لسه مش متضافة في إعدادات المتجر.");

  const entries=Object.entries(cart);
  const lines=entries.map(([id,n])=>{
    const p=products.find(x=>String(x.id)===id);
    return p?`• ${p.name} × ${n} = ${money(p.price*n)} جنيه`:"";
  }).filter(Boolean);

  const total=entries.reduce((s,[id,n])=>
    s+(products.find(p=>String(p.id)===id)?.price||0)*n,0
  );

  const msg=`طلب جديد من ${settings.name}
الاسم: ${name}
الموبايل: ${phone}
العنوان: ${address}

${lines.join("\n")}

الإجمالي: ${money(total)} جنيه`;

  if(firebaseReady) {
    try {
      await db.collection("orders").add({
        customerName:name,
        phone,
        address,
        channel,
        items:entries.map(([id,quantity])=>{
          const p=products.find(x=>String(x.id)===id);
          return p ? {
            productId:id,
            name:p.name,
            price:Number(p.price),
            quantity
          } : null;
        }).filter(Boolean),
        total,
        status:"new",
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(error) {
      console.error(error);
      return alert("تعذر حفظ الطلب. حاول مرة أخرى.");
    }
  }

  if(channel==="whatsapp") {
    const digits=settings.whatsapp.replace(/\D/g,"");
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`,"_blank");
  } else {
    try { await navigator.clipboard.writeText(msg); } catch(e) {}
    window.open(destination,"_blank");
    alert("تم نسخ تفاصيل الطلب. الصقها في محادثة الصفحة.");
  }

  cart={};
  renderCart();
  $("checkoutModal").classList.add("hidden");
};

$("brand").addEventListener("pointerdown",()=>{
  pressTimer=setTimeout(()=>$("adminModal").classList.remove("hidden"),900);
});

["pointerup","pointerleave","pointercancel"].forEach(ev=>
  $("brand").addEventListener(ev,()=>clearTimeout(pressTimer))
);

document.querySelectorAll("[data-close]").forEach(b=>{
  b.onclick=()=>$(b.dataset.close).classList.add("hidden");
});

$("adminLogin").onclick=async()=>{
  if(!firebaseReady) {
    $("loginMsg").textContent="أكمل إعداد Firebase أولاً.";
    return;
  }

  try {
    const result=await auth.signInWithEmailAndPassword(
      $("adminEmail").value.trim(),
      $("adminPassword").value
    );

    if(result.user.uid!==ADMIN_UID) {
      await auth.signOut();
      $("loginMsg").textContent="هذا الحساب ليس حساب الإدارة.";
      return;
    }

    $("loginPane").classList.add("hidden");
    $("adminPane").classList.remove("hidden");
    await loadCloud();
  } catch(error) {
    $("loginMsg").textContent="بيانات الدخول غير صحيحة أو تعذر الاتصال.";
  }
};

$("logout").onclick=async()=>{
  if(auth)await auth.signOut();
  $("adminPane").classList.add("hidden");
  $("loginPane").classList.remove("hidden");
};

async function loadCloud() {
  if(!firebaseReady)return;

  try {
    const ps=await db.collection("products").get();

    products=ps.empty ? [...sampleProducts] : ps.docs.map(doc=>({
      id:doc.id,
      ...doc.data(),
      image:doc.data().image || doc.data().image_url || "",
      emoji:"🛍️"
    }));

    const ss=await db.collection("settings").doc("main").get();

    if(ss.exists) {
      const data=ss.data();
      settings={
        name:data.name||"زهرة حماة",
        whatsapp:data.whatsapp||"",
        messenger:data.messenger||"",
        facebook:data.facebook||""
      };
    }

    $("editStoreName").value=settings.name;
    $("editWhatsapp").value=settings.whatsapp;
    $("editMessenger").value=settings.messenger;
    $("editFacebook").value=settings.facebook;

    render();
    renderAdminProducts();
  } catch(error) {
    console.error(error);
    $("adminMsg").textContent="تعذر تحميل بيانات المتجر.";
  }
}

$("saveSettings").onclick=async()=>{
  const name=$("editStoreName").value.trim();
  const whatsapp=$("editWhatsapp").value.trim();
  const messenger=$("editMessenger").value.trim();
  const facebook=$("editFacebook").value.trim();

  if(!name)return alert("اكتب اسم المتجر.");
  if(!firebaseReady)return alert("Firebase غير مربوط.");

  try {
    await db.collection("settings").doc("main").set({
      name,whatsapp,messenger,facebook
    },{merge:true});

    settings={name,whatsapp,messenger,facebook};
    render();
    $("adminMsg").textContent="تم حفظ إعدادات المتجر.";
  } catch(error) {
    $("adminMsg").textContent="تعذر الحفظ: "+error.message;
  }
};

$("addProduct").onclick=async()=>{
  const name=$("newName").value.trim();
  const price=Number($("newPrice").value);
  const category=$("newCategory").value.trim();
  const image=$("newImage").value.trim();

  if(!name||!Number.isFinite(price)||price<0||!category)
    return alert("اكتب اسم المنتج والسعر والقسم بشكل صحيح.");

  try {
    await db.collection("products").add({
      name,price,category,image,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });

    $("newName").value="";
    $("newPrice").value="";
    $("newCategory").value="";
    $("newImage").value="";

    await loadCloud();
    $("adminMsg").textContent="تمت إضافة المنتج.";
  } catch(error) {
    $("adminMsg").textContent="تعذر إضافة المنتج: "+error.message;
  }
};

function renderAdminProducts() {
  $("adminProducts").innerHTML="<h3>المنتجات الحالية</h3>"+
    products.map(p=>`
      <div class="admin-product">
        <span>${esc(p.name)} — ${money(p.price)} ج</span>
        <button class="link" data-delete="${esc(p.id)}">حذف</button>
      </div>`).join("");
}

$("adminProducts").addEventListener("click",async e=>{
  const b=e.target.closest("[data-delete]");
  if(!b||!confirm("متأكد من حذف المنتج؟"))return;

  try {
    await db.collection("products").doc(b.dataset.delete).delete();
    await loadCloud();
  } catch(error) {
    $("adminMsg").textContent="تعذر حذف المنتج.";
  }
});

$("updateCredentials").onclick=async()=>{
  if(!auth||!auth.currentUser)
    return alert("سجّل دخول الإدارة أولاً.");

  const email=$("newAdminEmail").value.trim();
  const password=$("newAdminPassword").value;

  if(!email&&!password)
    return alert("اكتب الإيميل الجديد أو كلمة السر الجديدة.");

  if(password&&password.length<8)
    return alert("كلمة السر لازم تكون 8 أحرف على الأقل.");

  try {
    const user=auth.currentUser;

    if(email)await user.verifyBeforeUpdateEmail(email);
    if(password)await user.updatePassword(password);

    $("newAdminEmail").value="";
    $("newAdminPassword").value="";
    $("adminMsg").textContent="تم تنفيذ تحديث بيانات الدخول. راجع بريدك إذا طُلب التأكيد.";
  } catch(error) {
    $("adminMsg").textContent="تعذر تحديث البيانات. قد تحتاج لتسجيل الدخول من جديد.";
  }
};

$("year").textContent=new Date().getFullYear();
render();
