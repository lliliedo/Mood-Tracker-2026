// Simple Mood Tracker (Year Grid) - 2026
// Desktop:
//   - Click cell: select + cycle moods
//   - Shift+Click: erase day
//   - Right click: select only (no change)
// Mobile:
//   - Tap: select + cycle moods
//   - Long-press: erase day
// Notes saved per selected key (MM-DD). All saved in localStorage.

const YEAR = 2026;
const STORAGE_KEY = "mood-tracker-2026:cute:v1";

const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

// Feel free to edit moods/colors
const MOODS = [
  { key: "happy",      label: "Happy",      color: "#b7d957" },
  { key: "sad",        label: "Sad",        color: "#5aa6d6" },
  { key: "angry",      label: "Angry",      color: "#f08b3e" },
  { key: "productive", label: "Productive", color: "#5bbf7a" },
  { key: "nervous",    label: "Nervous",    color: "#d36aa7" },
  { key: "average",    label: "Average",    color: "#f2d066" },
  { key: "sick",       label: "Sick",       color: "#c06a3e" },
  { key: "stressed",   label: "Stressed",   color: "#6b5a3d" },
];

const el = (id) => document.getElementById(id);

const legend = el("legend");
const moodTable = el("moodTable");
const selectedLabel = el("selectedLabel");
const noteInput = el("noteInput");
const eraseCellBtn = el("eraseCell");
const clearAllBtn = el("clearAll");
const exportBtn = el("exportBtn");
const importBtn = el("importBtn");
const importFile = el("importFile");

let data = loadData();        // { "MM-DD": { moodKey, note, updatedAt } }
let selectedKey = null;       // "MM-DD"

init();

function init(){
  renderLegend();
  buildTable();
  bindActions();
  updateSelectedUI();
}

function renderLegend(){
  legend.innerHTML = "";
  MOODS.forEach(m => {
    const row = document.createElement("div");
    row.className = "legendItem";

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = m.color;

    const label = document.createElement("span");
    label.className = "legendLabel";
    label.textContent = m.label;

    row.appendChild(dot);
    row.appendChild(label);
    legend.appendChild(row);
  });
}

function buildTable(){
  moodTable.innerHTML = "";

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");

  const corner = document.createElement("th");
  corner.className = "dayHeader";
  corner.textContent = "";
  hr.appendChild(corner);

  MONTHS.forEach((m) => {
    const th = document.createElement("th");
    th.textContent = m;
    hr.appendChild(th);
  });

  thead.appendChild(hr);
  moodTable.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (let day = 1; day <= 31; day++){
    const tr = document.createElement("tr");

    const dayTd = document.createElement("td");
    dayTd.className = "dayNum";
    dayTd.textContent = String(day);
    tr.appendChild(dayTd);

    for (let monthIndex = 0; monthIndex < 12; monthIndex++){
      const key = toKey(monthIndex + 1, day); // "MM-DD"

      const td = document.createElement("td");
      td.className = "cell";
      td.dataset.key = key;

      paintCell(td, data[key]?.moodKey);

      // ✅ Desktop + general click
      td.addEventListener("click", (e) => {
        // Shift+Click to erase (desktop)
        if (e.shiftKey){
          eraseKey(key);
          selectKey(key);
          refreshCell(key);
          updateSelectedUI();
          return;
        }

        selectKey(key);
        cycleMood(key);
        paintCell(td, data[key]?.moodKey);
        refreshTableSelection();
        updateSelectedUI();
      });

      // ✅ Right click: select only (desktop)
      td.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        selectKey(key);
        refreshTableSelection();
        updateSelectedUI();
      });

      // ✅ Mobile: Long press to erase
      addLongPressToErase(td, key);

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  moodTable.appendChild(tbody);
}

function bindActions(){
  noteInput.addEventListener("input", () => {
    if (!selectedKey) return;
    upsert(selectedKey, { note: noteInput.value });
    updateSelectedUI();
  });

  eraseCellBtn.addEventListener("click", () => {
    if (!selectedKey) return;
    eraseKey(selectedKey);
    refreshCell(selectedKey);
    updateSelectedUI();
  });

  clearAllBtn.addEventListener("click", () => {
    const ok = confirm("Clear ALL moods & notes? This cannot be undone.");
    if (!ok) return;
    data = {};
    persist();
    selectedKey = null;
    buildTable();
    updateSelectedUI();
  });

  exportBtn.addEventListener("click", exportJSON);

  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", importJSON);
}

/* -------------------- Interaction helpers -------------------- */

function addLongPressToErase(td, key){
  let pressTimer = null;
  let longPressed = false;

  const start = (e) => {
    // Only for touch/pointer; avoid desktop mouse long press conflicts
    if (e.pointerType && e.pointerType !== "touch") return;

    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      // erase
      eraseKey(key);
      selectKey(key);
      refreshCell(key);
      updateSelectedUI();

      // tiny haptic feel (if supported)
      if (navigator.vibrate) navigator.vibrate(20);
    }, 550);
  };

  const end = () => {
    clearTimeout(pressTimer);
  };

  // Use Pointer Events if available
  td.addEventListener("pointerdown", start);
  td.addEventListener("pointerup", end);
  td.addEventListener("pointercancel", end);
  td.addEventListener("pointerleave", end);

  // Prevent long press from triggering context menu on mobile browsers
  td.addEventListener("touchstart", (e) => {
    // allow scrolling, but reduce accidental selection highlight
    // do not preventDefault here (keeps scroll natural)
  }, { passive: true });

  // If longPressed happened, prevent the subsequent click from cycling mood again
  td.addEventListener("click", (e) => {
    // We can’t directly know here if long press fired unless we track it,
    // so we keep it simple: pointer long press usually doesn't trigger click
    // on most browsers. If it does, you can uncomment next line:
    // if (longPressed) e.stopImmediatePropagation();
  }, true);
}

function cycleMood(key){
  const current = data[key]?.moodKey || null;
  const idx = MOODS.findIndex(m => m.key === current);
  const nextMood = (idx === -1) ? MOODS[0].key : MOODS[(idx + 1) % MOODS.length].key;
  upsert(key, { moodKey: nextMood });
}

function selectKey(key){
  selectedKey = key;
}

function eraseKey(key){
  if (!data[key]) return;
  delete data[key];
  persist();
}

function upsert(key, patch){
  const prev = data[key] || { moodKey: null, note: "" };
  data[key] = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  persist();
}

/* -------------------- UI updates -------------------- */

function paintCell(td, moodKey){
  td.style.background = "rgba(255,255,255,0.35)";
  td.title = "";

  if (!moodKey) return;

  const mood = MOODS.find(m => m.key === moodKey);
  if (!mood) return;

  td.style.background = mood.color;
  td.title = mood.label;
}

function refreshCell(key){
  const td = moodTable.querySelector(`td.cell[data-key="${key}"]`);
  if (!td) return;
  paintCell(td, data[key]?.moodKey);
  refreshTableSelection();
}

function refreshTableSelection(){
  moodTable.querySelectorAll("td.cell.selected").forEach(x => x.classList.remove("selected"));
  if (!selectedKey) return;
  const td = moodTable.querySelector(`td.cell[data-key="${selectedKey}"]`);
  if (td) td.classList.add("selected");
}

function updateSelectedUI(){
  refreshTableSelection();

  if (!selectedKey){
    selectedLabel.textContent = "—";
    noteInput.value = "";
    noteInput.disabled = true;
    eraseCellBtn.disabled = true;
    return;
  }

  selectedLabel.textContent = prettyKey(selectedKey);

  noteInput.disabled = false;
  eraseCellBtn.disabled = !data[selectedKey];

  noteInput.value = data[selectedKey]?.note || "";
}

/* -------------------- Storage + utils -------------------- */

function toKey(month, day){
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${mm}-${dd}`;
}

function prettyKey(key){
  const [mm, dd] = key.split("-").map(Number);
  const d = new Date(YEAR, mm - 1, dd);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const clean = {};
    for (const [k, v] of Object.entries(parsed)){
      if (!/^\d{2}-\d{2}$/.test(k)) continue;
      if (!v || typeof v !== "object") continue;
      clean[k] = {
        moodKey: v.moodKey ? String(v.moodKey) : null,
        note: v.note ? String(v.note) : "",
        updatedAt: v.updatedAt ? String(v.updatedAt) : null
      };
    }
    return clean;
  } catch {
    return {};
  }
}

function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* -------------------- Export / Import -------------------- */

function exportJSON(){
  const payload = {
    year: YEAR,
    exportedAt: new Date().toISOString(),
    data
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "mood-tracker-2026.json";
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 800);
}

async function importJSON(){
  const file = importFile.files?.[0];
  importFile.value = "";
  if (!file) return;

  try{
    const text = await file.text();
    const payload = JSON.parse(text);
    const incoming = payload.data || payload;

    if (!incoming || typeof incoming !== "object"){
      alert("Invalid JSON.");
      return;
    }

    for (const [k, v] of Object.entries(incoming)){
      if (!/^\d{2}-\d{2}$/.test(k)) continue;
      if (!v || typeof v !== "object") continue;
      data[k] = {
        moodKey: v.moodKey ? String(v.moodKey) : null,
        note: v.note ? String(v.note) : "",
        updatedAt: v.updatedAt ? String(v.updatedAt) : new Date().toISOString()
      };
    }

    persist();
    buildTable();
    updateSelectedUI();
  } catch {
    alert("Could not import file. Make sure it's valid JSON.");
  }
}
