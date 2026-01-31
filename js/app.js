/* =========================================================
   invite-form/js/app.js (Stable)
   - AR/EN toggle via ?lang=en
   - Show remaining immediately via GET
   - Add guests as rows: name + phone + remove
   - Submit via x-www-form-urlencoded (no preflight)
   - If POST response can't be read, verify success by reloading remaining (GET)
========================================================= */

/* ====== YOUR WEB APP URL (must end with /exec) ====== */
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxJrozMpuq6JViBuNg2g7c9KNCDBXSZXFEe_l_yL36XfqpsT1EU060CfbhOe0kj0WoU/exec";

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
const counterBox = document.getElementById("counter"); // we will hide it
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
  if (!resultBox) return;
  resultBox.className = "message " + type;
  resultBox.textContent = text;
}

function clearMessage() {
  if (!resultBox) return;
  resultBox.className = "message";
  resultBox.textContent = "";
}

function toLatinDigits(str) {
  // Arabic-Indic ٠١٢٣٤٥٦٧٨٩ + Persian ۰۱۲۳۴۵۶۷۸۹
  return String(str || "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function cleanPhone(raw) {
  return toLatinDigits(String(raw || "").trim()).replace(/[^\d+]/g, "");
}

function isValidPhone(raw) {
  return /^\+?\d{7,15}$/.test(cleanPhone(raw));
}

function getRows() {
  if (!entriesWrap) return [];
  return Array.from(entriesWrap.querySelectorAll(".entry-row"));
}

function getFilledRows() {
  const rows = getRows();
  const out = [];
  for (const row of rows) {
    const name = (row.querySelector(".name")?.value || "").trim();
    const phone = (row.querySelector(".phone")?.value || "").trim();
    if (!name && !phone) continue;
    out.push({ name, phone });
  }
  return out;
}

function buildNamesMultiline(entries) {
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

    remaining: (r) => `باقيلك: ${r}`,
    invalidLink: "الرابط غير صالح",
    invalidCode: "كود غير صالح",
    noMore: "تم استكمال العدد المسموح",
    remainingUnavailable: "تعذّر تحميل المتبقي حالياً",

    exceeded: (r) => `⚠️ تجاوزت الحد (${r})`,
    sending: "جارٍ الإرسال...",
    pleaseAdd: "يرجى إضافة شخص واحد على الأقل",
    fillBoth: "يرجى إدخال الاسم ورقم الهاتف لكل شخص",
    badPhone: "يرجى إدخال رقم هاتف صحيح",
    networkError: "خطأ بالشبكة",
    confirmUnknown: "تم الإرسال لكن تعذّر تأكيد النتيجة، تحقق من المتبقي."
  },
  en: {
    pageTitle: "Guest Registration",
    title: "Guest Registration",
    loading: "Loading data...",
    subtitle: "Enter name and phone, then press +",
    addGuest: "Add guest",
    submit: "Submit",

    remaining: (r) => `Remaining: ${r}`,
    invalidLink: "Invalid link",
    invalidCode: "Invalid code",
    noMore: "No remaining slots",
    remainingUnavailable: "Couldn't load remaining right now",

    exceeded: (r) => `⚠️ Limit exceeded (${r})`,
    sending: "Submitting...",
    pleaseAdd: "Please add at least one guest",
    fillBoth: "Please enter name and phone for each guest",
    badPhone: "Please enter a valid phone number",
    networkError: "Network error",
    confirmUnknown: "Submitted but couldn't confirm. Check remaining."
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
  if (counterBox) counterBox.style.display = "none"; // show remaining only

  if (!addBtn || !submitBtn) return;

  if (!id) {
    addBtn.disabled = true;
    submitBtn.disabled = true;
    return;
  }

  if (!remainingUnknown && remaining <= 0) {
    addBtn.disabled = true;
    submitBtn.disabled = true;
    return;
  }

  // Disable add if remaining is known and we've already created enough rows
  if (!remainingUnknown) {
    addBtn.disabled = getRows().length >= remaining;
  } else {
    addBtn.disabled = false;
  }

  submitBtn.disabled = false;
}

/* =========================
   Load Remaining (GET)
========================= */
async function loadRemaining() {
  if (counterBox) counterBox.style.display = "none";

  if (!id) {
    if (infoBox) infoBox.textContent = T.invalidLink;
    if (entriesWrap) entriesWrap.style.display = "none";
    if (addBtn) addBtn.style.display = "none";
    if (submitBtn) submitBtn.style.display = "none";
    return;
  }

  if (infoBox) infoBox.textContent = T.loading;

  try {
    const res = await fetch(
      `${WEB_APP_URL}?id=${encodeURIComponent(id)}&t=${Date.now()}`,
      { cache: "no-store" }
    );

    const d = await res.json();

    if (!d || !d.success || typeof d.message !== "object") {
      // Invalid code => hide form
      if (infoBox) infoBox.textContent = T.invalidCode;
      if (entriesWrap) entriesWrap.style.display = "none";
      if (addBtn) addBtn.style.display = "none";
      if (submitBtn) submitBtn.style.display = "none";
      remainingUnknown = false;
      remaining = 0;
      updateButtons();
      return;
    }

    remaining = Number(d.message.remaining) || 0;
    remainingUnknown = false;

    // Show remaining immediately
    if (infoBox) infoBox.textContent = remaining > 0 ? T.remaining(remaining) : T.noMore;

    // Show form (even if remaining=0 we will disable)
    if (entriesWrap) entriesWrap.style.display = "";
    if (addBtn) addBtn.style.display = "";
    if (submitBtn) submitBtn.style.display = "";

    if (remaining > 0 && getRows().length === 0) {
      entriesWrap.appendChild(createRow());
    }

    updateButtons();
  } catch (e) {
    // GET failed: keep UI working, but show fallback text
    remainingUnknown = true;

    if (infoBox) infoBox.textContent = T.remainingUnavailable;

    if (entriesWrap) entriesWrap.style.display = "";
    if (addBtn) addBtn.style.display = "";
    if (submitBtn) submitBtn.style.display = "";

    if (getRows().length === 0 && entriesWrap) {
      entriesWrap.appendChild(createRow());
    }

    updateButtons();
  }
}

/* =========================
   Add row
========================= */
if (addBtn) {
  addBtn.onclick = () => {
    if (!entriesWrap) return;

    if (!remainingUnknown && getRows().length >= remaining) {
      updateButtons();
      return;
    }

    entriesWrap.appendChild(createRow());
    updateButtons();
  };
}

/* =========================
   Submit (POST form-urlencoded)
   - If response can't be read, verify by reloading remaining (GET)
========================= */
if (submitBtn) {
  submitBtn.onclick = async () => {
    clearMessage();

    const entries = getFilledRows();

    if (entries.length === 0) {
      setMessage("error", T.pleaseAdd);
      return;
    }

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

    // Client-side limit check if remaining is known
    if (!remainingUnknown && entries.length > remaining) {
      setMessage("error", T.exceeded(remaining));
      return;
    }

    const remainingBefore = remainingUnknown ? null : remaining;

    submitBtn.disabled = true;
    if (addBtn) addBtn.disabled = true;

    const oldText = submitBtn.textContent;
    submitBtn.textContent = T.sending;

    const namesText = buildNamesMultiline(entries);
    const body = `id=${encodeURIComponent(id)}&names=${encodeURIComponent(namesText)}`;

    try {
      const res = await fetch(WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body,
        cache: "no-store"
      });

      // Try parse JSON (may fail if blocked/HTML)
      let d = null;
      try {
        d = await res.json();
      } catch (_) {
        d = null;
      }

      // If server JSON is readable
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

          // Reset UI
          if (entriesWrap) {
            entriesWrap.innerHTML = "";
            entriesWrap.appendChild(createRow());
          }

          // Update remaining display
          if (remainingAfter != null && !Number.isNaN(remainingAfter)) {
            remainingUnknown = false;
            remaining = remainingAfter;
            if (infoBox) infoBox.textContent = remaining > 0 ? T.remaining(remaining) : T.noMore;
          } else {
            await loadRemaining();
          }

          updateButtons();
          return;
        } else {
          setMessage("error", String(d.message || "Error"));
          updateButtons();
          return;
        }
      }

      // Fallback: can't read response => verify via GET
      await loadRemaining();

      if (remainingBefore !== null && !remainingUnknown && remaining < remainingBefore) {
        setMessage("success", lang === "en" ? "Submitted successfully" : "تم الإرسال بنجاح");
        if (entriesWrap) {
          entriesWrap.innerHTML = "";
          entriesWrap.appendChild(createRow());
        }
      } else {
        setMessage("error", T.confirmUnknown);
      }

      updateButtons();
    } catch (e) {
      // Network/CORS read issue => verify via GET
      const before = remainingBefore;

      try {
        await loadRemaining();
      } catch (_) {}

      if (before !== null && !remainingUnknown && remaining < before) {
        setMessage("success", lang === "en" ? "Submitted successfully" : "تم الإرسال بنجاح");
        if (entriesWrap) {
          entriesWrap.innerHTML = "";
          entriesWrap.appendChild(createRow());
        }
      } else {
        setMessage("error", T.networkError);
      }

      updateButtons();
    } finally {
      submitBtn.textContent = oldText;
      submitBtn.disabled = false;
      updateButtons();
    }
  };
}

/* =========================
   Init
========================= */
loadRemaining();
