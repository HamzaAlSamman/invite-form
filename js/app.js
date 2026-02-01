/* =========================
   الإعدادات
========================= */
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxUdbDbMtqzOxvjJi1FcvCM4EgjtieIZatDA1kdEPtbU-OqEYjGTX5_0Vrd-_CXqOoK/exec";

/* =========================
   العناصر
========================= */
const infoBox = document.getElementById("infoBox");
const entriesDiv = document.getElementById("entries");
const addBtn = document.getElementById("addBtn");
const submitBtn = document.getElementById("submitBtn");
const resultBox = document.getElementById("result");

/* =========================
   أدوات مساعدة
========================= */
function getIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function showMessage(type, text) {
  resultBox.className = "message " + type;
  resultBox.textContent = text;
}

function clearMessage() {
  resultBox.className = "message";
  resultBox.textContent = "";
}

/* =========================
   إنشاء سطر إدخال
========================= */
function createRow() {
  const row = document.createElement("div");
  row.className = "entry-row";

  const nameInput = document.createElement("input");
  nameInput.placeholder = "الاسم الكامل";

  const phoneInput = document.createElement("input");
  phoneInput.placeholder = "رقم الهاتف";

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "×";
  removeBtn.className = "remove-btn";
  removeBtn.onclick = () => row.remove();

  row.appendChild(nameInput);
  row.appendChild(phoneInput);
  row.appendChild(removeBtn);

  return row;
}

/* =========================
   تحميل العدد المتبقي
========================= */
async function loadRemaining() {
  const id = getIdFromUrl();
  if (!id) {
    infoBox.textContent = "الرابط غير صالح";
    return;
  }

  try {
    const res = await fetch(WEB_APP_URL + "?id=" + id);
    const data = await res.json();

    if (!data.success) {
      infoBox.textContent = "كود غير صالح";
      return;
    }

    infoBox.textContent = "المتبقي: " + data.data.remaining;

    if (entriesDiv.children.length === 0 && data.data.remaining > 0) {
      entriesDiv.appendChild(createRow());
    }
  } catch (e) {
    infoBox.textContent = "خطأ في تحميل البيانات";
  }
}

/* =========================
   إضافة شخص
========================= */
addBtn.onclick = () => {
  clearMessage();
  entriesDiv.appendChild(createRow());
};

/* =========================
   الإرسال
========================= */
submitBtn.onclick = () => {
  clearMessage();

  const rows = entriesDiv.querySelectorAll(".entry-row");
  let text = "";

  rows.forEach(row => {
    const inputs = row.querySelectorAll("input");
    const name = inputs[0].value.trim();
    const phone = inputs[1].value.trim();

    if (name && phone) {
      text += name + " - " + phone + "\n";
    }
  });

  if (!text) {
    showMessage("error", "يرجى إدخال الاسم ورقم الهاتف");
    return;
  }

  const id = new URLSearchParams(window.location.search).get("id");

  const form = document.createElement("form");
  form.method = "POST";
  form.action = WEB_APP_URL;

  const inputId = document.createElement("input");
  inputId.type = "hidden";
  inputId.name = "id";
  inputId.value = id;

  const inputNames = document.createElement("input");
  inputNames.type = "hidden";
  inputNames.name = "names";
  inputNames.value = text;

  form.appendChild(inputId);
  form.appendChild(inputNames);

  document.body.appendChild(form);
  form.submit();
};


/* =========================
   بدء التشغيل
========================= */
loadRemaining();
