const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzqecdqJYmb-qENwEXnpUF6MhT5BdOngqwCl9h3w8M93YHZFI8LOm7IFVNOM1_MC3_X/exec";

/* Elements */
const submitBtn = document.getElementById("submitBtn");
const resultBox = document.getElementById("result");
const textarea = document.getElementById("names");
const infoBox = document.getElementById("infoBox");
const counterBox = document.getElementById("counter");
const langToggleBtn = document.getElementById("langToggle");

/* Helpers */
function getIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id") || "";
}

function getLangFromUrl() {
  return new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "ar";
}

function countEntries(text) {
  return text.split("\n").map(l => l.trim()).filter(l => l !== "").length;
}

/* i18n */
const LANG = {
  ar: {
    pageTitle: "تسجيل المدعوين",
    title: "تسجيل المدعوين",
    loading: "جارٍ تحميل البيانات...",
    subtitle: "يرجى إدخال الاسم مع رقم الهاتف (كل شخص بسطر)",
    placeholder: "مثال:\nحمزة السمان - 0944123456\nسلمى الجبان - +97455123456",
    submit: "إرسال",
    remaining: r => `المتبقي: ${r}`,
    counter: (c, r) => `عدد المدخلين: ${c} / ${r}`,
    exceeded: r => `⚠️ تجاوزت الحد (${r})`,
    invalid: "الرابط غير صالح",
    noMore: "تم استكمال العدد المسموح",
    sending: "جارٍ الإرسال..."
  },
  en: {
    pageTitle: "Guest Registration",
    title: "Guest Registration",
    loading: "Loading data...",
    subtitle: "Please enter name and phone number (one per line)",
    placeholder: "Example:\nHamza AlSamman - +963944123456\nSalma AlJabban - +97455123456",
    submit: "Submit",
    remaining: r => `Remaining: ${r}`,
    counter: (c, r) => `Entered: ${c} / ${r}`,
    exceeded: r => `⚠️ Limit exceeded (${r})`,
    invalid: "Invalid link",
    noMore: "No remaining slots",
    sending: "Submitting..."
  }
};

const lang = getLangFromUrl();
const T = LANG[lang];

/* Apply translations */
document.querySelectorAll("[data-i18n]").forEach(el => {
  el.innerText = T[el.dataset.i18n];
});
document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
  el.placeholder = T[el.dataset.i18nPlaceholder];
});
document.title = T.pageTitle;

/* Lang toggle */
langToggleBtn.innerText = lang === "ar" ? "English" : "العربية";
langToggleBtn.onclick = () => {
  const params = new URLSearchParams(window.location.search);
  params.set("lang", lang === "ar" ? "en" : "ar");
  window.location.search = params.toString();
};

/* Remaining */
const id = getIdFromUrl();
let remaining = 0;

function setMessage(type, text) {
  resultBox.className = "message " + type;
  resultBox.innerText = text;
}

function clearMessage() {
  resultBox.className = "message";
  resultBox.innerText = "";
}

/* GET remaining (might be blocked in some cases; if blocked, we still allow submit) */
async function loadRemaining() {
  if (!id) {
    infoBox.innerText = T.invalid;
    textarea.style.display = submitBtn.style.display = "none";
    return;
  }

  infoBox.innerText = T.loading;

  try {
    const res = await fetch(`${WEB_APP_URL}?id=${encodeURIComponent(id)}`);
    const d = await res.json();
    if (!d.success) throw new Error("bad");
    remaining = Number(d.message.remaining) || 0;
    infoBox.innerText = T.remaining(remaining);

    if (remaining <= 0) {
      textarea.style.display = submitBtn.style.display = "none";
      infoBox.innerText = T.noMore;
    }
  } catch (e) {
    // If GET fails due to CORS, don't break the whole page
    infoBox.innerText = " ";
    remaining = 999999; // allow typing; server will enforce real limit
  }
}

loadRemaining();

/* Counter */
textarea.addEventListener("input", () => {
  const c = countEntries(textarea.value);
  if (remaining !== 999999) {
    counterBox.innerText = c > remaining ? T.exceeded(remaining) : T.counter(c, remaining);
  } else {
    counterBox.innerText = (lang === "en") ? `Entered: ${c}` : `عدد المدخلين: ${c}`;
  }
});

/* POST (form-urlencoded: no preflight) */
async function submitForm() {
  submitBtn.disabled = true;
  submitBtn.innerText = T.sending;
  clearMessage();

  const rawText = textarea.value.trim();
  if (!rawText) {
    submitBtn.disabled = false;
    submitBtn.innerText = T.submit;
    setMessage("error", lang === "en" ? "Please enter at least one guest" : "يرجى إدخال شخص واحد على الأقل");
    return;
  }

  const body = `id=${encodeURIComponent(id)}&names=${encodeURIComponent(rawText)}`;

  try {
    const res = await fetch(WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body
    });

    const d = await res.json();

    if (d.success) {
      const msg = (typeof d.message === "object" && d.message.ok) ? d.message.ok : (lang === "en" ? "Submitted" : "تم الإرسال");
      setMessage("success", msg);

      // update remaining if provided
      if (typeof d.message === "object" && d.message.remainingAfter != null) {
        remaining = Number(d.message.remainingAfter) || 0;
        infoBox.innerText = T.remaining(remaining);
        if (remaining <= 0) {
          textarea.style.display = submitBtn.style.display = "none";
          infoBox.innerText = T.noMore;
        }
      }

      textarea.value = "";
      counterBox.innerText = "";
    } else {
      setMessage("error", String(d.message || "Error"));
    }
  } catch (e) {
    setMessage("error", "Network error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = T.submit;
  }
}

submitBtn.onclick = submitForm;
