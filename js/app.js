/* =========================================================
   js/app.js (GitHub Pages + Google Apps Script)
   - AR/EN toggle via ?lang=en
   - Shows remaining immediately on page load (GET)
   - Adds rows: name + phone + remove
   - Submits as application/x-www-form-urlencoded (no preflight)
   - If POST response can't be read (CORS/HTML), verifies by reloading remaining (GET)
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
const counterBox = document.getElementById("counter"); // will be hidden (remaining only)
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

function toLatinDigits(str) {
  // Arabic-Indic ٠١٢٣٤٥٦٧٨٩
  // Eastern Arabic/Persian ۰۱۲۳۴۵۶۷۸۹
  return String(str || "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function cleanPhone(raw) {
  // Keep digits and optional leading +
  return toLatinDigits(String(raw || "").trim()).replace(/[^\d+]/g, "");
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
  // Server expects lines like: "Name - +123..."
  return entries.map((x) => `${x.name} - ${cleanPhone(x.phone)}`).join("\n");
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

    remaining: (r) => `باقيلك: ${r} أشخاص`,
    noMore: "تم استكمال العدد المسموح",
    invalidLink: "الرابط غير صالح",
    invalidCode: "كود غير صالح",
    remainingUnavailable: "تعذّر تحميل المتبقي حالياً",

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

    remaining: (r) => `You have ${r} guests left`,
    noMore: "No remaining slots",
    invalidLink: "Invalid link",
    invalidCode: "Invalid code",
    remainingUnavailable: "Couldn't load remaining right now",

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

if (langToggleBtn) {
  langToggleBtn.textContent = lang === "ar" ? "English" : "العربية";
  langToggleBtn.onclick = () => {
    const params = new URLSearchParams(window.location.search);
    params.set("lang", lang === "ar" ? "en" : "ar");
    window.location.search = params.toString();
  };
}

/* =========================
   State
========================= */
const id = getParam("id");
let remaining = 0;
// If GET is blocked or fails, keep UI working and server enforces on submit
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
  phoneInput.placeholder = lang === "en" ? "Phone number" : "رقم الهاتف";
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
    updateButtons();
  };

  const onChange = () => {
    clearMessage();
    updateButtons();
  };

  nameInput.addEventListener("input", onChange);
  phoneInput.addEventListener("input", onChange);

  row.appendChild(nameInput);
  row.appendChild(phoneInput);
  row.appendChild(removeBtn);

  return row;
}

/* =========================
   Buttons
========================= */
function updateButtons() {
  // Hide counter (remaining only)
  if (counterBox) counterBox.style.display = "none";

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
  // Always hide counter
  if (counterBox) counterBox.style.display = "none";

  if (!id) {
    infoBox.textContent = T.invalidLink;
    entriesWrap.style.display = "none";
    addBtn.style.display = "none";
    submitBtn.style.display = "none";
    return;
  }

  infoBox.textContent = T.loading;

  try {
    const res = await fetch(
      `${WEB_APP_URL}?id=${encodeURIComponent(id)}&t=${Date.now()}`,
      { cache: "no-store" }
    );

    const d = await res.json();

    // If server says invalid code/link, stop and hide form
    if (!d || !d.success) {
      infoBox.textContent = T.invalidCode;
      entriesWrap.style.display = "none";
      addBtn.style.display = "none";
      submitBtn.style.display = "none";
      remainingUnknown = false;
      remaining = 0;
      updateButtons();
      return;
    }

    if (typeof d.message !== "object") {
      throw new Error("bad payload");
    }

    remaining = Number(d.message.remaining) || 0;
    remainingUnknown = false;

    // Show remaining immediately
    infoBox.textContent = T.remaining(remaining);

    // Show form (even if remaining=0 we will disable)
    entriesWrap.style.display = "";
    addBtn.style.display = "";
    submitBtn.style.display = "";

    if (remaining <= 0) {
      infoBox.textContent = T.noMore;
      entriesWrap.innerHTML = "";
      updateButtons();
      return;
    }

    if (getRows().length === 0) {
      entriesWrap.appendChild(createRow());
    }

    updateButtons();
  } catch (e) {
    // GET failed (CORS/HTML/Network) => keep UI usable
    remainingUnknown = true;

    infoBox.textContent = T.remainingUnavailable;

    entriesWrap.style.display = "";
    addBtn.style.display = "";
    submitBtn.style.display = "";

    if (getRows().length === 0) {
      entriesWrap.appendChild(createRow());
    }

    updateButtons();
  }
}

/* =========================
   Add row
========================= */
addBtn.onclick = () => {
  // If remaining is known, stop adding once filled reaches remaining
  if (!remainingUnknown) {
    const filled = getFilledRows().length;
    if (filled >= remaining) {
      updateButtons();
      return;
    }
  }
  entriesWrap.appendChild(createRow());
  updateButtons();
};

/* =========================
   Submit (POST form-urlencoded)
   - If response can't be read, verify by reloading remaining
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

  // Snapshot before submit (for verification fallback)
  const remainingBefore = remainingUnknown ? null : remaining;

  // Client-side limit check (server still checks)
  if (!remainingUnknown && entries.length > remaining) {
    setMessage("error", `${T.remaining(remaining)} - ${T.fillBoth}`);
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
      body,
      cache: "no-store"
    });

    // Try parse JSON (may fail if response is blocked or HTML)
    let d = null;
    try {
      d = await res.json();
    } catch (_) {
      d = null;
    }

    // If we got JSON, handle it
    if (d && typeof d === "object") {
      if (d.success) {
        let okMsg = lang === "en" ? "Submitted successfully" : "تم الإرسال بنجاح";
        let remainingAfter = null;

        if (typeof d.message === "object") {
          if (d.message.ok) okMsg = String(d.message.ok);
          if (d.message.remainingAfter != null) remainingAfter = Number(d.message.remainingAfter);
        } else if (d.message) {
          okMsg = String(d.message);
        }

        setMessage("success", okMsg);

        // Reset UI inputs
        entriesWrap.innerHTML = "";
        entriesWrap.appendChild(createRow());

        // Update remaining
        if (remainingAfter != null && !Number.isNaN(remainingAfter)) {
          remainingUnknown = false;
          remaining = remainingAfter;
          infoBox.textContent = remaining > 0 ? T.remaining(remaining) : T.noMore;
        } else {
          await loadRemaining();
        }

        updateButtons();
        return;
      } else {
        // Server explicit error
        setMessage("error", String(d.message || "Error"));
        updateButtons();
        return;
      }
    }

    // Fallback: couldn't read/parse response => verify using GET
    await loadRemaining();

    if (remainingBefore !== null && !remainingUnknown && remaining < remainingBefore) {
      setMessage("success", lang === "en" ? "Submitted successfully" : "تم الإرسال بنجاح");
      entriesWrap.innerHTML = "";
      entriesWrap.appendChild(createRow());
    } else {
      setMessage(
        "error",
        lang === "en"
          ? "Submitted, but couldn't confirm. Check remaining."
          : "تم الإرسال، لكن تعذّر تأكيد النتيجة. تحقق من المتبقي."
      );
    }
  } catch (e) {
    // Network/CORS read issue => verify using GET
    const before = remainingBefore;

    try {
      await loadRemaining();
    } catch (_) {}

    if (before !== null && !remainingUnknown && remaining < before) {
      setMessage("success", lang === "en" ? "Submitted successfully" : "تم الإرسال بنجاح");
      entriesWrap.innerHTML = "";
      entriesWrap.appendChild(createRow());
    } else {
      setMessage("error", T.networkError);
    }
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
