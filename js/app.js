const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwb-ElH7qCR5djYf4_OJ4ZBW6tTCaFuUaIUCv0yLKd_rSJ-diKR4wgqHuR22ybheQLL8Q/exec";

document.addEventListener("DOMContentLoaded", () => {
  const submitBtn = document.getElementById("submitBtn");
  const addBtn = document.getElementById("addBtn");
  const resultBox = document.getElementById("result");
  const infoBox = document.getElementById("infoBox");
  const counterBox = document.getElementById("counter");
  const langToggleBtn = document.getElementById("langToggle");
  const entriesWrap = document.getElementById("entries");

  function getIdFromUrl() {
    return new URLSearchParams(window.location.search).get("id") || "";
  }

  function getLangFromUrl() {
    return new URLSearchParams(window.location.search).get("lang") === "en"
      ? "en"
      : "ar";
  }

  const LANG = {
    ar: {
      pageTitle: "تسجيل المدعوين",
      title: "تسجيل المدعوين",
      loading: "جارٍ تحميل البيانات...",
      subtitle: "أدخل الاسم ورقم الهاتف ثم اضغط +",
      add: "إضافة شخص",
      namePh: "الاسم الكامل",
      phonePh: "رقم الهاتف (+اختياري)",
      submit: "إرسال",
      remaining: r => `المتبقي: ${r}`,
      counter: (c, r) => `عدد المدخلين: ${c} / ${r}`,
      exceeded: r => `⚠️ تجاوزت الحد (${r})`,
      invalid: "الرابط غير صالح",
      noMore: "تم استكمال العدد المسموح",
      sending: "جارٍ الإرسال...",
      removing: "×",
      pleaseFill: "يرجى تعبئة الاسم ورقم الهاتف لكل سطر",
      invalidPhone: "يرجى إدخال رقم هاتف صحيح"
    },
    en: {
      pageTitle: "Guest Registration",
      title: "Guest Registration",
      loading: "Loading data...",
      subtitle: "Enter name and phone, then press +",
      add: "Add guest",
      namePh: "Full name",
      phonePh: "Phone number (+ optional)",
      submit: "Submit",
      remaining: r => `Remaining: ${r}`,
      counter: (c, r) => `Entered: ${c} / ${r}`,
      exceeded: r => `⚠️ Limit exceeded (${r})`,
      invalid: "Invalid link",
      noMore: "No remaining slots",
      sending: "Submitting...",
      removing: "×",
      pleaseFill: "Please fill name and phone for each row",
      invalidPhone: "Please enter a valid phone number"
    }
  };

  const lang = getLangFromUrl();
  const T = LANG[lang];

  // dir/lang
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.title = T.pageTitle;

  // translate static nodes
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (T[key] != null) el.textContent = T[key];
  });

  langToggleBtn.textContent = lang === "ar" ? "English" : "العربية";
  langToggleBtn.onclick = () => {
    const params = new URLSearchParams(window.location.search);
    params.set("lang", lang === "ar" ? "en" : "ar");
    window.location.search = params.toString();
  };

  const id = getIdFromUrl();
  let remaining = 0;

  function setResult(type, msg) {
    resultBox.className = "message " + type;
    resultBox.textContent = msg;
  }

  function clearResult() {
    resultBox.className = "message";
    resultBox.textContent = "";
  }

  function cleanPhone(phoneRaw) {
    return String(phoneRaw || "").trim().replace(/[^\d+]/g, "");
  }

  function isValidPhone(phoneRaw) {
    const phone = cleanPhone(phoneRaw);
    return /^\+?\d{7,15}$/.test(phone);
  }

  function getCurrentRowsCount() {
    return entriesWrap.querySelectorAll(".entry-row").length;
  }

  // Count filled rows (name+phone)
  function getFilledEntries() {
    const rows = Array.from(entriesWrap.querySelectorAll(".entry-row"));
    const out = [];

    for (const row of rows) {
      const name = row.querySelector(".name").value.trim();
      const phone = row.querySelector(".phone").value.trim();
      if (name === "" && phone === "") continue; // ignore empty row
      out.push({ name, phone });
    }
    return out;
  }

  function updateUIState() {
    infoBox.textContent = remaining > 0 ? T.remaining(remaining) : T.noMore;

    const filled = getFilledEntries().length;
    counterBox.textContent =
      filled > remaining ? T.exceeded(remaining) : T.counter(filled, remaining);

    // allow adding rows only if current row count < remaining
    addBtn.disabled = remaining <= 0 || getCurrentRowsCount() >= remaining;

    // submit disabled if nothing filled or remaining = 0
    submitBtn.disabled = remaining <= 0;
  }

  function createRow(prefill = { name: "", phone: "" }) {
    const row = document.createElement("div");
    row.className = "entry-row";

    const nameInput = document.createElement("input");
    nameInput.className = "name";
    nameInput.type = "text";
    nameInput.placeholder = T.namePh;
    nameInput.value = prefill.name || "";

    const phoneInput = document.createElement("input");
    phoneInput.className = "phone";
    phoneInput.type = "text";
    phoneInput.placeholder = T.phonePh;
    phoneInput.value = prefill.phone || "";

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.type = "button";
    removeBtn.textContent = T.removing;

    removeBtn.onclick = () => {
      row.remove();

      // لا تخلي الصفحة بدون أي سطر
      if (getCurrentRowsCount() === 0 && remaining > 0) {
        entriesWrap.appendChild(createRow());
      }

      clearResult();
      updateUIState();
    };

    nameInput.addEventListener("input", () => {
      clearResult();
      updateUIState();
    });
    phoneInput.addEventListener("input", () => {
      clearResult();
      updateUIState();
    });

    row.appendChild(nameInput);
    row.appendChild(phoneInput);
    row.appendChild(removeBtn);

    return row;
  }

  async function loadRemaining() {
    if (!id) {
      infoBox.textContent = T.invalid;
      addBtn.style.display = "none";
      submitBtn.style.display = "none";
      entriesWrap.style.display = "none";
      return;
    }

    infoBox.textContent = T.loading;

    try {
      const res = await fetch(`${WEB_APP_URL}?id=${encodeURIComponent(id)}`);
      const d = await res.json();

      if (!d.success || typeof d.message !== "object") {
        infoBox.textContent = T.invalid;
        addBtn.style.display = "none";
        submitBtn.style.display = "none";
        entriesWrap.style.display = "none";
        return;
      }

      remaining = Number(d.message.remaining) || 0;

      // reset rows
      entriesWrap.innerHTML = "";
      clearResult();

      if (remaining <= 0) {
        infoBox.textContent = T.noMore;
        addBtn.disabled = true;
        submitBtn.disabled = true;
        counterBox.textContent = "";
        return;
      }

      // start with 1 row
      entriesWrap.appendChild(createRow());
      updateUIState();
    } catch (e) {
      infoBox.textContent = "Error loading data";
    }
  }

  addBtn.onclick = () => {
    if (getCurrentRowsCount() >= remaining) {
      updateUIState();
      return;
    }
    entriesWrap.appendChild(createRow());
    updateUIState();
  };

  submitBtn.onclick = async () => {
    clearResult();

    const entries = getFilledEntries();

    if (entries.length === 0) {
      setResult("error", T.pleaseFill);
      return;
    }

    if (entries.length > remaining) {
      setResult("error", lang === "ar" ? `مسموح لك فقط ${remaining}` : `You can only add ${remaining}`);
      return;
    }

    // validate
    for (const item of entries) {
      if (!item.name.trim() || !item.phone.trim()) {
        setResult("error", T.pleaseFill);
        return;
      }
      if (!isValidPhone(item.phone)) {
        setResult("error", T.invalidPhone);
        return;
      }
    }

    submitBtn.disabled = true;
    addBtn.disabled = true;
    const oldLabel = submitBtn.textContent;
    submitBtn.textContent = T.sending;

    try {
      const res = await fetch(WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, entries })
      });

      const d = await res.json();

      if (d.success) {
        // backend returns {message, remainingAfter}
        const msgObj = d.message;
        const okMessage = typeof msgObj === "object" ? msgObj.message : String(d.message);

        setResult("success", okMessage);

        // تحديث remaining من الرد إن وجد
        if (typeof msgObj === "object" && msgObj.remainingAfter != null) {
          remaining = Number(msgObj.remainingAfter) || 0;
        } else {
          // fallback: reload
          await loadRemaining();
          return;
        }

        // reset rows
        entriesWrap.innerHTML = "";
        if (remaining > 0) {
          entriesWrap.appendChild(createRow());
        }
        updateUIState();
      } else {
        setResult("error", String(d.message || "Error"));
      }
    } catch (e) {
      setResult("error", "Network error");
    } finally {
      submitBtn.textContent = oldLabel;
      submitBtn.disabled = remaining <= 0;
      addBtn.disabled = remaining <= 0 || getCurrentRowsCount() >= remaining;
      updateUIState();
    }
  };

  // init
  loadRemaining();
});
