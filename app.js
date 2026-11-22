// ضع بيانات مشروع Supabase بعد إنشائه. لا تضع service_role key هنا أبداً.
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
const db = (SUPABASE_URL && SUPABASE_ANON_KEY) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const sampleProducts = [
 {id:"s1",name:"جبنة بيضاء",price:85,category:"أجبان",image:"",emoji:"🧀"},
 {id:"s2",name:"لبن كامل الدسم",price:32,category:"ألبان",image:"",emoji:"🥛"},
 {id:"s3",name:"زيتون أخضر",price:65,category:"مخللات",image:"",emoji:"🫒"},
 {id:"s4",name:"عسل أسود",price:45,category:"بقالة",image:"",emoji:"🍯"}
];
let products = [...sampleProducts], cart = {}, settings = {name:"زهرة حماة",whatsapp:"",messenger:"",facebook:""};
let activeCategory = "الكل", pressTimer;
const $ = id => document.getElementById(id);
const money = n => Number(n).toLocaleString("ar-EG",{maximumFractionDigits:2});
function render(){
 $("storeTitle").textContent=settings.name; $("footerName").textContent=settings.name;
 const cats=["الكل",...new Set(products.map(p=>p.category).filter(Boolean))];
 $("categories").innerHTML=cats.map(c=>`<button class="chip ${activeCategory===c?"active":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
 const q=$("search").value.trim().toLowerCase();
 const shown=products.filter(p=>(activeCategory==="الكل"||p.category===activeCategory)&&p.name.toLowerCase().includes(q));
 $("products").innerHTML=shown.length?shown.map(p=>`<article class="product">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}">`:`<div class="placeholder">${p.emoji||"🛍️"}</div>`}<h3>${esc(p.name)}</h3><div class="price">${money(p.price)} جنيه</div><button class="primary" data-add="${p.id}">أضف للسلة</button></article>`).join(""):`<p class="muted">مفيش منتجات مطابقة.</p>`;
 renderCart();
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderCart(){
 const entries=Object.entries(cart).filter(([id,n])=>n>0), total=entries.reduce((sum,[id,n])=>sum+(products.find(p=>String(p.id)===id)?.price||0)*n,0);
 $("cartCount").textContent=entries.reduce((s,[,n])=>s+n,0);$("total").textContent=money(total);
 $("cartItems").innerHTML=entries.length?entries.map(([id,n])=>{const p=products.find(x=>String(x.id)===id);return p?`<div class="cart-row"><span>${esc(p.name)} — ${money(p.price)} جنيه</span><span class="qty"><button data-minus="${id}">−</button>${n}<button data-plus="${id}">+</button></span></div>`:""}).join(""):`<p class="muted">السلة لسه فاضية.</p>`;
}
$("products").addEventListener("click",e=>{const b=e.target.closest("[data-add]");if(b){const id=b.dataset.add;cart[id]=(cart[id]||0)+1;renderCart();}});
$("categories").addEventListener("click",e=>{const b=e.target.closest("[data-cat]");if(b){activeCategory=b.dataset.cat;render();}});
$("cartItems").addEventListener("click",e=>{let b=e.target.closest("button");if(!b)return;let id=b.dataset.plus||b.dataset.minus;if(!id)return;cart[id]=(cart[id]||0)+(b.dataset.plus?1:-1);if(cart[id]<=0)delete cart[id];renderCart();});
$("search").addEventListener("input",render);$("clearCart").onclick=()=>{cart={};renderCart();};
$("checkout").onclick=()=>{if(!Object.keys(cart).length)return alert("ضيف منتجات للسلة الأول.");$("checkoutModal").classList.remove("hidden");};
$("sendOrder").onclick=async()=>{
 const name=$("customerName").value.trim(),phone=$("customerPhone").value.trim(),address=$("customerAddress").value.trim();
 if(!name||!phone||!address)return alert("من فضلك اكتب الاسم ورقم الموبايل والعنوان.");
 const channel=$("contactChannel").value;
 const destination=channel==="whatsapp"?settings.whatsapp:(channel==="messenger"?settings.messenger:settings.facebook);
 if(!destination)return alert("وسيلة التواصل المختارة لسه مش متضافة في إعدادات المتجر. اختار وسيلة تانية أو تواصل مع الإدارة.");
 const lines=Object.entries(cart).map(([id,n])=>{const p=products.find(x=>String(x.id)===id);return p?`• ${p.name} × ${n} = ${money(p.price*n)} جنيه`:""}).filter(Boolean);
 const total=Object.entries(cart).reduce((s,[id,n])=>s+(products.find(p=>String(p.id)===id)?.price||0)*n,0);
 const msg=`طلب جديد من ${settings.name}\nالاسم: ${name}\nالموبايل: ${phone}\nالعنوان: ${address}\n\n${lines.join("\n")}\n\nالإجمالي: ${money(total)} جنيه`;
 if(channel==="whatsapp"){
   const digits=settings.whatsapp.replace(/\D/g,"");
   window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`,"_blank");
 } else {
   // Facebook لا يتيح ملء رسالة الطلب تلقائياً بنفس طريقة WhatsApp؛ ننسخ تفاصيل الطلب ونفتح صفحة التواصل.
   try{await navigator.clipboard.writeText(msg);}catch(e){}
   window.open(destination,"_blank");
   alert("نسخنا تفاصيل الطلب. الصقها في محادثة الصفحة على فيسبوك أو ماسنجر.");
 }
};
$("brand").addEventListener("pointerdown",()=>{pressTimer=setTimeout(()=>$("adminModal").classList.remove("hidden"),900);});
["pointerup","pointerleave","pointercancel"].forEach(ev=>$("brand").addEventListener(ev,()=>clearTimeout(pressTimer)));
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$ (b.dataset.close).classList.add("hidden"));
$("adminLogin").onclick=async()=>{
 if(!db){$("loginMsg").textContent="اربط Supabase أولاً من ملف app.js ودليل الإعداد." ;return;}
 const {error}=await db.auth.signInWithPassword({email:$("adminEmail").value,password:$("adminPassword").value});
 if(error){$("loginMsg").textContent="بيانات الدخول غير صحيحة أو تعذر الاتصال.";return;}
 $("loginPane").classList.add("hidden");$("adminPane").classList.remove("hidden");await loadCloud();
};
$("logout").onclick=async()=>{await db?.auth.signOut();$("adminPane").classList.add("hidden");$("loginPane").classList.remove("hidden");};
async function loadCloud(){
 const {data:ps,error}=await db.from("products").select("*").order("created_at",{ascending:false});
 if(!error&&ps)products=ps.map(p=>({...p,emoji:"🛍️"}));
 const {data:ss}=await db.from("store_settings").select("*").eq("id",1).maybeSingle();
 if(ss)settings={name:ss.store_name||"زهرة حماة",whatsapp:ss.whatsapp_number||"",messenger:ss.messenger_url||"",facebook:ss.facebook_url||""};
 $("editStoreName").value=settings.name;$("editWhatsapp").value=settings.whatsapp;
 $("editMessenger").value=settings.messenger;$("editFacebook").value=settings.facebook;
 render();renderAdminProducts();
}
$("saveSettings").onclick=async()=>{
 const name=$("editStoreName").value.trim(),whatsapp=$("editWhatsapp").value.trim();
 const messenger=$("editMessenger").value.trim(),facebook=$("editFacebook").value.trim();
 if(!name)return alert("اكتب اسم المتجر.");
 const {error}=await db.from("store_settings").upsert({id:1,store_name:name,whatsapp_number:whatsapp,messenger_url:messenger,facebook_url:facebook});
 if(error){$("adminMsg").textContent="تعذر الحفظ: "+error.message;return;}
 settings={name,whatsapp,messenger,facebook};render();$("adminMsg").textContent="تم حفظ إعدادات المتجر ووسائل التواصل.";
};
$("addProduct").onclick=async()=>{
 const name=$("newName").value.trim(),price=Number($("newPrice").value),category=$("newCategory").value.trim(),image_url=$("newImage").value.trim();
 if(!name||!Number.isFinite(price)||price<0||!category)return alert("اكتب اسم المنتج والسعر والقسم بشكل صحيح.");
 const {error}=await db.from("products").insert({name,price,category,image_url:image_url||null});
 if(error){$("adminMsg").textContent="تعذر إضافة المنتج: "+error.message;return;}
 $("newName").value=$("newPrice").value=$("newCategory").value=$("newImage").value="";
 await loadCloud();$("adminMsg").textContent="تمت إضافة المنتج.";
};
function renderAdminProducts(){
 $("adminProducts").innerHTML="<h3>المنتجات الحالية</h3>"+products.map(p=>`<div class="admin-product"><span>${esc(p.name)} — ${money(p.price)} ج</span><button class="link" data-delete="${p.id}">حذف</button></div>`).join("");
}
$("adminProducts").addEventListener("click",async e=>{const b=e.target.closest("[data-delete]");if(!b||!confirm("متأكد من حذف المنتج؟"))return;const {error}=await db.from("products").delete().eq("id",b.dataset.delete);if(error){$("adminMsg").textContent="تعذر الحذف.";return;}await loadCloud();});
$("updateCredentials").onclick=async()=>{
 if(!db)return alert("اربط Supabase أولاً.");
 const email=$("newAdminEmail").value.trim(),password=$("newAdminPassword").value;
 if(!email&&!password)return alert("اكتب الإيميل الجديد أو كلمة السر الجديدة على الأقل.");
 if(password&&password.length<8)return alert("كلمة السر لازم تكون 8 أحرف على الأقل.");
 const changes={};if(email)changes.email=email;if(password)changes.password=password;
 const {error}=await db.auth.updateUser(changes);
 if(error){$("adminMsg").textContent="تعذر تحديث بيانات الدخول: "+error.message;return;}
 $("newAdminEmail").value="";$("newAdminPassword").value="";
 $("adminMsg").textContent=email?"تم إرسال طلب تغيير الإيميل؛ راجع بريدك للتأكيد.":"تم تحديث كلمة السر.";
};
$("year").textContent=new Date().getFullYear();render();
