const formWrapper = document.querySelector(".form__fields");
const masterIdPromptButton = document.querySelector(".masterIdPrompt__button");
masterIdPromptButton.addEventListener("click", async () => {
  employeeId = Number(document.querySelector(".masterIdPrompt__input").value);
  document.querySelector(".masterIdPrompt").style.display = "none";
  document.querySelector(".formWrapper").style.display = "flex";
  await main();
});

const supabaseUrl = "https://eqznnarpanrfzwzjgksq.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxem5uYXJwYW5yZnp3empna3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1NjU3NDMsImV4cCI6MjA2MTE0MTc0M30.cqB9D02UwuZ7pNpsr-NwtkmLV9W2VJ78X7Fw8QIstbU";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let choosedDay = null;
var employeeId;
let employeeBusyDates = [];
let employeeRecords = [];

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
    case "time":
      item.type = "time";
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
        onDateSelect({ render, date }) {
          const key = getDateKey(date);

          if ([0, 6].includes(date.getDay())) return;
          choosedDay = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
          );

          const busyDates = employeeBusyDates.map((s) => {
            const [y, m, d] = s.split("-");
            return new Date(+y, m - 1, +d);
          });
          render([...busyDates, choosedDay]);
        },
        width: "300px",
        tdPadding: "12px",
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
    .select("busy_dates_array, records_array")
    .eq("id", employeeId)
    .single();
  if (errEmp) {
    console.error("Ошибка загрузки данных сотрудника:", errEmp);
    return;
  }
  employeeBusyDates = emp.busy_dates_array || [];
  employeeRecords = emp.records_array || [];

  register.addEventListener("click", async () => {
    try {
      const inputs = [...document.querySelectorAll(".item__wrapper input")];

      if (!choosedDay) {
        alert("Пожалуйста, выберите дату.");
        return;
      }

      const today = new Date();
      const selKey = getDateKey(choosedDay);
      const todayKey = getDateKey(today);
      if (selKey < todayKey) {
        alert("Дата не может быть раньше сегодняшней.");
        return;
      }

      const timeInput = inputs.find((i) => i.type === "time");
      if (selKey === todayKey && timeInput) {
        const [h, m] = timeInput.value.split(":").map(Number);
        if (
          h < today.getHours() ||
          (h === today.getHours() && m < today.getMinutes())
        ) {
          alert("Время не может быть раньше текущего.");
          return;
        }
      }

      for (let input of inputs) {
        if (input.type !== "time" && input.value.trim() === "") {
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
        recordInfo[input.dataset.fieldId] = input.value;
      }

      const { data: lastRecord } = await supabase
        .from("records")
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .single();
      const newId = lastRecord && lastRecord.id ? lastRecord.id + 1 : 1;

      if (employeeBusyDates.includes(selKey)) {
        alert("Эта дата уже занята, выберите другую дату");
        return;
      }

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

      const updatedBusy = [...employeeBusyDates, selKey];
      const updatedRecords = [...employeeRecords, newId];
      const { error: errUpdate } = await supabase
        .from("Employees")
        .update({
          busy_dates_array: updatedBusy,
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
    if (!field.status) continue;
    const inputField = createInputField(
      field.type,
      field.name,
      field.status,
      field.id
    );
    formWrapper.append(inputField);
  }
}
