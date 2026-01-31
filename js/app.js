const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbw5zA4d7aR3R86RfmMmeogSCRxwg02BQGFL9gELckbhcR7xWE0tqmLKqf70FUvgg90dgg/exec";

/* =========================
   عناصر الصفحة
========================= */
const submitBtn = document.getElementById("submitBtn");
const resultBox = document.getElementById("result");
const textarea = document.getElementById("names");
const infoBox = document.getElementById("infoBox");
const counterBox = document.getElementById("counter");
const langToggleBtn = document.getElementById("langToggle");

/* =========================
   أدوات
========================= */
function getIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id") || "";
}

function getLangFromUrl() {
  return new URLSearchParams(window.location.search).get("lang") === "en"
    ? "en"
    : "ar";
}

function countEntries(text) {
  return text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l !== "")
    .length;
}

/* =========================
   الترجمة
========================= */
const LANG = {
  ar: {
    pageTitle: "تسجيل المدعوين",
    title: "تسجيل المدعوين",
    loading: "جارٍ تحميل البيانات...",
    subtitle: "يرجى إدخال الاسم مع رقم الهاتف (كل شخص بسطر)",
    placeholder:
      "مثال:\nحمزة السمان - 0944123456\nسلمى الجبان - +97455123456",
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
    placeholder:
      "Example:\nHamza AlSamman - +963944123456\nSalma AlJabban - +97455123456",
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

/* =========================
   تطبيق الترجمة على الصفحة
========================= */
document.querySelectorAll("[data-i18n]").forEach(el => {
  el.innerText = T[el.dataset.i18n];
});

document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
  el.placeholder = T[el.dataset.i18nPlaceholder];
});

document.title = T.pageTitle;

/* زر اللغة */
langToggleBtn.innerText = lang === "ar" ? "English" : "العربية";

langToggleBtn.onclick = () => {
  const params = new URLSearchParams(window.location.search);
  params.set("lang", lang === "ar" ? "en" : "ar");
  window.location.search = params.toString();
};

/* =========================
   تحميل البيانات
========================= */
const id = getIdFromUrl();
let remaining = 0;

if (!id) {
  infoBox.innerText = T.invalid;
  textarea.style.display = submitBtn.style.display = "none";
} else {
  fetch(`${WEB_APP_URL}?id=${id}`)
    .then(r => r.json())
    .then(d => {
      remaining = d.message.remaining;
      infoBox.innerText = T.remaining(remaining);

      if (remaining <= 0) {
        textarea.style.display = submitBtn.style.display = "none";
        infoBox.innerText = T.noMore;
      }
    });
}

/* =========================
   العدّ
========================= */
textarea.addEventListener("input", () => {
  const c = countEntries(textarea.value);
  counterBox.innerText =
    c > remaining ? T.exceeded(remaining) : T.counter(c, remaining);
});

/* =========================
   الإرسال
========================= */
submitBtn.onclick = () => {
  submitBtn.innerText = T.sending;
};
