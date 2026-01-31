/* =========================
   إعدادات أساسية
========================= */
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbx4Y1NzQ2k1sjCj1gZzXaWrhySJkvYu5__RzPyhyaMGsCPIzAaHYStuBf7n6u90IM6s/exec";

const submitBtn = document.getElementById("submitBtn");
const resultBox = document.getElementById("result");
const textarea = document.getElementById("names");
const infoBox = document.getElementById("infoBox");
const counterBox = document.getElementById("counter");
const langToggleBtn = document.getElementById("langToggle");


let remainingAllowed = 0;

/* =========================
   أدوات مساعدة
========================= */

// جلب ID من الرابط
function getIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || "";
}

// جلب اللغة من الرابط
function getLangFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("lang") === "en" ? "en" : "ar";
}

// عدّ الأسماء (سطر جديد أو |)
function countNames(text) {
  return text
    .split(/\n|\|/)
    .map(n => n.trim())
    .filter(n => n !== "")
    .length;
}

// قاموس اللغات
const LANG = {
  ar: {
    loading: "جارٍ تحميل البيانات...",
    invalidLink: "الرابط غير صالح",
    remaining: r => `المتبقي: ${r} اسم`,
    noMore: "تم استكمال العدد المسموح. شكرًا لتعاونك.",
    counter: (c, r) => `عدد الأسماء المدخلة: ${c} / ${r}`,
    exceeded: r => `⚠️ تجاوزت الحد المسموح (${r})`,
    empty: "يرجى إدخال اسم واحد على الأقل",
    sending: "جارٍ الإرسال...",
    connectionError: "خطأ في الاتصال، حاول مرة أخرى"
  },
  en: {
    loading: "Loading data...",
    invalidLink: "Invalid link",
    remaining: r => `Remaining: ${r}`,
    noMore: "The allowed number has been completed. Thank you.",
    counter: (c, r) => `Entered names: ${c} / ${r}`,
    exceeded: r => `⚠️ Limit exceeded (${r})`,
    empty: "Please enter at least one name",
    sending: "Submitting...",
    connectionError: "Connection error, please try again"
  }
};

const lang = getLangFromUrl();
const T = LANG[lang];
if (lang === "ar") {
  langToggleBtn.innerText = "English";
} else {
  langToggleBtn.innerText = "العربية";
}


/* =========================
   تحميل البيانات عند الفتح
========================= */

const id = getIdFromUrl();

if (!id) {
  resultBox.className = "message error";
  resultBox.innerText = T.invalidLink;
  submitBtn.disabled = true;
} else {
  infoBox.innerText = T.loading;

  fetch(`${WEB_APP_URL}?id=${id}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        resultBox.className = "message error";
        resultBox.innerText = data.message;
        submitBtn.disabled = true;
        return;
      }

      remainingAllowed = data.message.remaining;
      infoBox.innerText = T.remaining(remainingAllowed);

      if (remainingAllowed <= 0) {
        textarea.style.display = "none";
        submitBtn.style.display = "none";
        counterBox.style.display = "none";
        infoBox.innerText = T.noMore;
      }
    })
    .catch(() => {
      resultBox.className = "message error";
      resultBox.innerText = T.connectionError;
      submitBtn.disabled = true;
    });
}

/* =========================
   العدّ الفوري أثناء الكتابة
========================= */

textarea.addEventListener("input", () => {
  const count = countNames(textarea.value);

  if (count > remainingAllowed) {
    counterBox.innerText = T.exceeded(remainingAllowed);
    textarea.style.borderColor = "#C4161C";
  } else {
    counterBox.innerText = T.counter(count, remainingAllowed);
    textarea.style.borderColor = "#F36A10";
  }
});

/* =========================
   الإرسال
========================= */

submitBtn.addEventListener("click", () => {
  const names = textarea.value.trim();
  const count = countNames(names);

  resultBox.className = "message";
  resultBox.innerText = "";

  if (!names) {
    resultBox.classList.add("error");
    resultBox.innerText = T.empty;
    return;
  }

  if (count > remainingAllowed) {
    resultBox.classList.add("error");
    resultBox.innerText = T.exceeded(remainingAllowed);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerText = T.sending;

  fetch(WEB_APP_URL, {
    method: "POST",
    body: JSON.stringify({ id, names })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        resultBox.className = "message success";
        resultBox.innerText = data.message;

        textarea.value = "";
        remainingAllowed -= count;
        infoBox.innerText = T.remaining(remainingAllowed);
        counterBox.innerText = T.counter(0, remainingAllowed);

        if (remainingAllowed <= 0) {
          textarea.style.display = "none";
          submitBtn.style.display = "none";
          counterBox.style.display = "none";
          infoBox.innerText = T.noMore;
        }
      } else {
        resultBox.className = "message error";
        resultBox.innerText = data.message;
      }
    })
    .catch(() => {
      resultBox.className = "message error";
      resultBox.innerText = T.connectionError;
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.innerText = "إرسال";
    });
});

langToggleBtn.addEventListener("click", () => {
  const params = new URLSearchParams(window.location.search);
  const newLang = lang === "ar" ? "en" : "ar";

  params.set("lang", newLang);

  // نحافظ على id
  if (!params.get("id")) {
    params.set("id", getIdFromUrl());
  }

  window.location.search = params.toString();
});

