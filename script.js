const formWrapper = document.querySelector(".form__fields");
const masterIdPromptButton = document.querySelector(".masterIdPrompt__button");
(async () => {
  await new Promise((r) => setTimeout(r, 500));
  const url = new URL(window.location.href);
  employeeId = Number(url.searchParams.get("masterId"));
  await main();
})();

const supabaseUrl = "https://eqznnarpanrfzwzjgksq.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxem5uYXJwYW5yZnp3empna3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1NjU3NDMsImV4cCI6MjA2MTE0MTc0M30.cqB9D02UwuZ7pNpsr-NwtkmLV9W2VJ78X7Fw8QIstbU";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let choosedDay = null;
let choosedSlot = null;
var employeeId;
let employeeBusyDates = [];
let employeeRecords = [];
var employeeNotWeekends;
let employeeSlots = {};

function getDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function createInputField(type, name, status, id) {
  const inputWrapper = document.createElement("div");
  inputWrapper.classList.add("input__wrapper");

  const inputTitle = document.createElement("div");
  inputTitle.classList.add("input__title");
  inputTitle.textContent = type === "date" ? "" : name;

  const itemWrapper = document.createElement("div");
  itemWrapper.classList.add("item__wrapper");

  let item = document.createElement("input");
  switch (type) {
    case "text":
      item.type = "text";
      break;

    case "tel":
      item.type = "tel";
      item.setAttribute("pattern", "\\+7\\d{10}");
      item.setAttribute("placeholder", "+71234567890");
      break;
    case "date":
      item = document.createElement("div");
      createCalendar({
        container: item,
        initialDate: new Date(),
        selectedDates: [
          new Date(),
          ...employeeBusyDates.map((s) => {
            const [y, m, d] = s.split("-");
            return new Date(+y, m - 1, +d);
          }),
        ],
        onDateSelect({ render, date, slot }) {
          choosedDay = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
          );
          choosedSlot = slot;
        },
        width: "300px",
        tdPadding: "12px",
        allowedWeekends: employeeNotWeekends || [],
        slots: employeeSlots,
      });
      break;
  }
  item.dataset.fieldId = id;

  itemWrapper.append(item);
  inputWrapper.append(inputTitle, itemWrapper);

  return inputWrapper;
}

async function main() {
  const { data: fields } = await supabase
    .from("Fields")
    .select("*")
    .order("id", { ascending: true });

  const register = document.querySelector(".form__button");

  const { data: emp, error: errEmp } = await supabase
    .from("Employees")
    .select("busy_dates_array, records_array, not_weekends, slots")
    .eq("id", employeeId)
    .single();
  if (errEmp) {
    console.error("Ошибка загрузки данных сотрудника:", errEmp);
    return;
  }
  employeeBusyDates = emp.busy_dates_array || [];
  employeeRecords = emp.records_array || [];
  employeeNotWeekends = emp.not_weekends || [];
  employeeSlots = emp.slots || {};

  register.addEventListener("click", async () => {
    try {
      const inputs = [...document.querySelectorAll(".item__wrapper input")];

      if (!choosedDay || !choosedSlot) {
        alert("Пожалуйста, выберите дату и слот.");
        return;
      }

      const today = new Date();
      const selKey = getDateKey(choosedDay);
      const todayKey = getDateKey(today);
      if (selKey < todayKey) {
        alert("Дата не может быть раньше сегодняшней.");
        return;
      }

      for (let input of inputs) {
        if (input.value.trim() === "") {
          alert("Пожалуйста, заполните все поля.");
          return;
        }
        if (!input.checkValidity()) {
          input.reportValidity();
          return;
        }
      }

      const recordInfo = {};
      for (let input of inputs) {
        if (input.dataset.fieldId) {
          recordInfo[input.dataset.fieldId] = input.value;
        }
      }

      recordInfo["4"] = choosedSlot[0];

      const { data: lastRecord } = await supabase
        .from("records")
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .single();
      const newId = lastRecord && lastRecord.id ? lastRecord.id + 1 : 1;

      const { error: errInsert } = await supabase.from("records").insert([
        {
          id: newId,
          date: selKey,
          record_info: recordInfo,
          employees_id: employeeId,
        },
      ]);
      if (errInsert) {
        console.error("Ошибка при вставке записи:", errInsert);
        throw errInsert;
      }

      const slotsForDay = employeeSlots[selKey] || [];
      const slotIndex = slotsForDay.findIndex(
        (slot) => slot[0] === choosedSlot[0] && slot[1] === choosedSlot[1]
      );
      if (slotIndex !== -1) {
        slotsForDay[slotIndex][2] = true;
        slotsForDay[slotIndex][3] = newId;
      }
      const updatedSlots = { ...employeeSlots, [selKey]: slotsForDay };

      const updatedRecords = [...employeeRecords, newId];
      const { error: errUpdate } = await supabase
        .from("Employees")
        .update({
          slots: updatedSlots,
          records_array: updatedRecords,
        })
        .eq("id", employeeId);
      if (errUpdate) {
        console.error("Ошибка при обновлении сотрудника:", errUpdate);
        throw errUpdate;
      }

      console.log(`Успешно создана заявка ID=${newId}`);
      register.textContent = "Успешно!";
    } catch (e) {
      console.error(e);
    }
  });

  /*----- Основной поток: рендерим поля формы -----*/
  for (const field of fields) {
    if (!field.status || field.type === "time") continue;
    const inputField = createInputField(
      field.type,
      field.name,
      field.status,
      field.id
    );
    formWrapper.append(inputField);
  }
}
