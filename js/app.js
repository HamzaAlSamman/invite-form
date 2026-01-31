/* =========================================================
   invite-form/js/app.js  (GitHub Pages version)
   - Supports AR/EN toggle via ?lang=en
   - Shows remaining via GET (if blocked, page still works)
   - Add guests as rows: name + phone + remove
   - Submit as application/x-www-form-urlencoded (NO preflight)
   - Server (Apps Script) must accept: id + names (multiline "name - phone")
========================================================= */

/* ====== PUT YOUR WEB APP URL HERE (must end with /exec) ====== */
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxw9IFAtE9PU8I_PpOXZroOgiHel7VHrYeQdJVFKM3TaX1h2vBQ3XgUyDYnJbG7TH1C/exec";

/* =========================
   Elements
========================= */
const langToggleBtn = document.getElementById("langToggle");
const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");
const infoBox = document.getElementById("infoBox");
const entriesWrap = document.getElementById("entries");
const addBtn = document.getElementById("addBtn");
const addText = document.getElementById("addText");
const counterBox = document.getElementById("counter");
const submitBtn = document.getElementById("submitBtn");
const resultBox = document.getElementById("result");

/* =========================
   Helpers
========================= */
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name) || "";
}

function currentLang() {
  return getParam("lang") === "en" ? "en" : "ar";
}

function setMessage(type, text) {
  resultBox.className = "message " + type;
  resultBox.textContent = text;
}

function clearMessage() {
  resultBox.className = "message";
  resultBox.textContent = "";
}

function cleanPhone(raw) {
  return String(raw || "").trim().replace(/[^\d+]/g, "");
}

function isValidPhone(raw) {
  // + optional then 7..15 digits
  return /^\+?\d{7,15}$/.test(cleanPhone(raw));
}

function getRows() {
  return Array.from(entriesWrap.querySelectorAll(".entry-row"));
}

function getFilledRows() {
  const rows = getRows();
  const out = [];
  for (const row of rows) {
    const name = row.querySelector(".name").value.trim();
    const phone = row.querySelector(".phone").value.trim();
    if (!name && !phone) continue;
    out.push({ name, phone });
  }
  return out;
}

function buildNamesMultiline(entries) {
  // server expects lines like: "Name - +123..."
  return entries.map(x => `${x.name} - ${cleanPhone(x.phone)}`).join("\n");
}

/* =========================
   i18n
========================= */
const I18N = {
  ar: {
    pageTitle: "تسجيل المدعوين",
    title: "تسجيل المدعوين",
    loading: "جارٍ تحميل البيانات...",
    subtitle: "أدخل الاسم ورقم الهاتف ثم اضغط +",
    addGuest: "إضافة شخص",
    submit: "إرسال",
    remaining: r => `المتبقي: ${r}`,
    counter: (c, r) => `عدد المدخلين: ${c} / ${r}`,
    counterNoLimit: c => `عدد المدخلين: ${c}`,
    exceeded: r => `⚠️ تجاوزت الحد (${r})`,
    invalidLink: "الرابط غير صالح",
    noMore: "تم استكمال العدد المسموح",
    sending: "جارٍ الإرسال...",
    pleaseAdd: "يرجى إضافة شخص واحد على الأقل",
    fillBoth: "يرجى إدخال الاسم ورقم الهاتف لكل شخص",
    badPhone: "يرجى إدخال رقم هاتف صحيح",
    networkError: "خطأ بالشبكة"
  },
  en: {
    pageTitle: "Guest Registration",
    title: "Guest Registration",
    loading: "Loading data...",
    subtitle: "Enter name and phone, then press +",
    addGuest: "Add guest",
    submit: "Submit",
    remaining: r => `Remaining: ${r}`,
    counter: (c, r) => `Entered: ${c} / ${r}`,
    counterNoLimit: c => `Entered: ${c}`,
    exceeded: r => `⚠️ Limit exceeded (${r})`,
    invalidLink: "Invalid link",
    noMore: "No remaining slots",
    sending: "Submitting...",
    pleaseAdd: "Please add at least one guest",
    fillBoth: "Please enter name and phone for each guest",
    badPhone: "Please enter a valid phone number",
    networkError: "Network error"
  }
};

const lang = currentLang();
const T = I18N[lang];

/* Apply language to doc */
document.documentElement.lang = lang;
document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
document.title = T.pageTitle;

if (titleEl) titleEl.textContent = T.title;
if (subtitleEl) subtitleEl.textContent = T.subtitle;
if (addText) addText.textContent = T.addGuest;
if (submitBtn) submitBtn.textContent = T.submit;

langToggleBtn.textContent = lang === "ar" ? "English" : "العربية";
langToggleBtn.onclick = () => {
  const params = new URLSearchParams(window.location.search);
  params.set("lang", lang === "ar" ? "en" : "ar");
  window.location.search = params.toString();
};

/* =========================
   State
========================= */
const id = getParam("id");
let remaining = 0;
// If GET is blocked by CORS, we set "unknownRemaining" and let server enforce on submit
let remainingUnknown = false;

/* =========================
   UI Row builder
========================= */
function createRow() {
  const row = document.createElement("div");
  row.className = "entry-row";

  const nameInput = document.createElement("input");
  nameInput.className = "name";
  nameInput.type = "text";
  nameInput.placeholder = lang === "en" ? "Full name" : "الاسم الكامل";
  nameInput.autocomplete = "name";

  const phoneInput = document.createElement("input");
  phoneInput.className = "phone";
  phoneInput.type = "tel";
  phoneInput.placeholder = lang === "en" ? "Phone number (+ optional)" : "رقم الهاتف (+اختياري)";
  phoneInput.autocomplete = "tel";

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn";
  removeBtn.type = "button";
  removeBtn.textContent = "×";

  removeBtn.onclick = () => {
    row.remove();
    if (getRows().length === 0) {
      entriesWrap.appendChild(createRow());
    }
    clearMessage();
    updateCounter();
    updateButtons();
  };

  const onChange = () => {
    clearMessage();
    updateCounter();
  };

  nameInput.addEventListener("input", onChange);
  phoneInput.addEventListener("input", onChange);

  row.appendChild(nameInput);
  row.appendChild(phoneInput);
  row.appendChild(removeBtn);

  return row;
}

/* =========================
   Counter + Buttons
========================= */
function updateCounter() {
  const filled = getFilledRows().length;

  if (remainingUnknown) {
    // ما منعرف المتبقي، فخليها فاضية أو اعرض عدد المدخلين فقط
    counterBox.textContent = "";
    return;
  }

  const left = remaining - filled;

  if (left <= 0) {
    counterBox.textContent = T.leftNowNone;
  } else {
    counterBox.textContent = T.leftNow(left);
  }
}


function updateButtons() {
  // No link id => disable everything
  if (!id) {
    addBtn.disabled = true;
    submitBtn.disabled = true;
    return;
  }

  // If remaining is known and no slots left => disable everything
  if (!remainingUnknown && remaining <= 0) {
    addBtn.disabled = true;
    submitBtn.disabled = true;
    return;
  }

  // Enable submit by default (server will still enforce limits)
  submitBtn.disabled = false;

  // Add button: limit based on how many entries are actually filled
  if (!remainingUnknown) {
    const filledCount = getFilledRows().length;
    addBtn.disabled = filledCount >= remaining;
  } else {
    // Remaining unknown => allow adding
    addBtn.disabled = false;
  }
}


/* =========================
   Load Remaining (GET)
========================= */
async function loadRemaining() {
  if (!id) {
    infoBox.textContent = T.invalidLink;
    entriesWrap.style.display = "none";
    addBtn.style.display = "none";
    submitBtn.style.display = "none";
    counterBox.style.display = "none";
    return;
  }

  infoBox.textContent = T.loading;

  try {
    const res = await fetch(`${WEB_APP_URL}?id=${encodeURIComponent(id)}`);
    const d = await res.json();

    if (!d.success || typeof d.message !== "object") {
      throw new Error("invalid");
    }

    remaining = Number(d.message.remaining) || 0;
    remainingUnknown = false;

    infoBox.textContent = T.remaining(remaining);

    if (remaining <= 0) {
      infoBox.textContent = T.noMore;
      entriesWrap.innerHTML = "";
      addBtn.disabled = true;
      submitBtn.disabled = true;
      counterBox.textContent = "";
      return;
    }

    // Initialize rows: one row only
    if (getRows().length === 0) {
      entriesWrap.appendChild(createRow());
    }

    updateCounter();
    updateButtons();
  } catch (e) {
    // If blocked by CORS, don't kill UI. Server will enforce on submit.
    remainingUnknown = true;
    infoBox.textContent = ""; // keep UI clean
    if (getRows().length === 0) {
      entriesWrap.appendChild(createRow());
    }
    updateCounter();
    updateButtons();
  }
}

/* =========================
   Add row
========================= */
addBtn.onclick = () => {
  if (!remainingUnknown) {
    if (getRows().length >= remaining) {
      updateButtons();
      return;
    }
  }
  entriesWrap.appendChild(createRow());
  updateButtons();
  updateCounter();
};

/* =========================
   Submit (POST form-urlencoded)
========================= */
submitBtn.onclick = async () => {
  clearMessage();

  const entries = getFilledRows();

  if (entries.length === 0) {
    setMessage("error", T.pleaseAdd);
    return;
  }

  // Validate each entry
  for (const item of entries) {
    if (!item.name.trim() || !item.phone.trim()) {
      setMessage("error", T.fillBoth);
      return;
    }
    if (!isValidPhone(item.phone)) {
      setMessage("error", T.badPhone);
      return;
    }
  }

  // If remaining known, client-side check (server still checks)
  if (!remainingUnknown && entries.length > remaining) {
    setMessage("error", T.exceeded(remaining));
    return;
  }

  submitBtn.disabled = true;
  addBtn.disabled = true;
  const oldText = submitBtn.textContent;
  submitBtn.textContent = T.sending;

  const namesText = buildNamesMultiline(entries);
  const body = `id=${encodeURIComponent(id)}&names=${encodeURIComponent(namesText)}`;

  try {
    const res = await fetch(WEB_APP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body
    });

    const d = await res.json();

    if (d.success) {
      // Success message can be object or string depending on your backend
      let okMsg = "";
      let remainingAfter = null;

      if (typeof d.message === "object") {
        okMsg = d.message.ok || (lang === "en" ? "Submitted successfully" : "تم الإرسال بنجاح");
        if (d.message.remainingAfter != null) remainingAfter = Number(d.message.remainingAfter);
      } else {
        okMsg = String(d.message || (lang === "en" ? "Submitted" : "تم الإرسال"));
      }

      setMessage("success", okMsg);

      // Reset UI
      entriesWrap.innerHTML = "";
      entriesWrap.appendChild(createRow());
      counterBox.textContent = "";

      // Update remaining if provided
      if (remainingAfter != null && !Number.isNaN(remainingAfter)) {
        remainingUnknown = false;
        remaining = remainingAfter;
        infoBox.textContent = remaining > 0 ? T.remaining(remaining) : T.noMore;

        if (remaining <= 0) {
          entriesWrap.innerHTML = "";
          addBtn.disabled = true;
          submitBtn.disabled = true;
          return;
        }
      } else {
        // Try reload remaining (optional)
        await loadRemaining();
      }

      updateButtons();
      updateCounter();
    } else {
      setMessage("error", String(d.message || "Error"));
      updateButtons();
      updateCounter();
    }
  } catch (e) {
    setMessage("error", T.networkError);
    updateButtons();
    updateCounter();
  } finally {
    submitBtn.textContent = oldText;
    submitBtn.disabled = false;
    updateButtons();
  }
};

/* =========================
   Init
========================= */
loadRemaining();


