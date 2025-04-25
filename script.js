const formWrapper = document.querySelector(".form__fields");

const supabaseUrl = "https://eqznnarpanrfzwzjgksq.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxem5uYXJwYW5yZnp3empna3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1NjU3NDMsImV4cCI6MjA2MTE0MTc0M30.cqB9D02UwuZ7pNpsr-NwtkmLV9W2VJ78X7Fw8QIstbU";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let choosedDay = null;
const employeeId = 0;
let employeeBusyDates = [];
let employeeRecords = []; // для хранения existing records_array

/**
 * Унифицированный «ключ» для даты — YYYY-MM-DD, без UTC-сдвигов
 */
function getDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Создаёт поле ввода (или контейнер календаря).
 */
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
      // вместо <input> рендерим календарь
      item = document.createElement("div");
      createCalendar({
        container: item,
        initialDate: new Date(),
        // изначально отмечаем сегодня + busy dates
        selectedDates: [
          new Date(),
          ...employeeBusyDates.map((s) => {
            const [y, m, d] = s.split("-");
            return new Date(+y, m - 1, +d);
          }),
        ],
        onDateSelect({ render, date }) {
          // выбрали рабочий день — date всегда объект Date
          const key = getDateKey(date);
          // игнорируем выходные
          if ([0, 6].includes(date.getDay())) return;
          choosedDay = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
          );
          // создаём массив дат объектов busy + choosed
          const busyDates = employeeBusyDates.map((s) => {
            const [y, m, d] = s.split("-");
            return new Date(+y, m - 1, +d);
          });
          render([...busyDates, choosedDay]);
        },
        width: "300px",
        height: "400px",
        tdPadding: "12px",
      });
      break;
    // можно добавить другие типы
  }
  item.dataset.fieldId = id;

  itemWrapper.append(item);
  inputWrapper.append(inputTitle, itemWrapper);

  return inputWrapper;
}

(async () => {
  // --- Загрузка полей формы ---
  const { data: fields } = await supabase
    .from("Fields")
    .select("*")
    .order("id", { ascending: true });

  const register = document.querySelector(".form__button");

  // --- Получаем занятые даты и записи сотрудника ---
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

  /* --- Обработчик клика "Записаться" --- */
  register.addEventListener("click", async () => {
    try {
      // 1) Собираем данные из полей (text, tel, time)
      const inputs = [...document.querySelectorAll(".item__wrapper input")];
      // Проверяем, что дата выбрана
      if (!choosedDay) {
        alert("Пожалуйста, выберите дату."); // или иной UI-метод
        return;
      }
      // Проверяем дату не раньше сегодня
      const today = new Date();
      const selKey = getDateKey(choosedDay);
      const todayKey = getDateKey(today);
      if (selKey < todayKey) {
        alert("Дата не может быть раньше сегодняшней.");
        return;
      }
      // Если сегодня, проверяем время
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
      // Проверяем остальные поля на заполненность и валидность
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

      // Собираем record_info
      const recordInfo = {};
      for (let input of inputs) {
        recordInfo[input.dataset.fieldId] = input.value;
      }

      // 2) Получаем текущий максимальный id заявки
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

      // 3) Вставляем новую запись с новым id
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

      // 4) Обновляем массивы в таблице Employees
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
      // Здесь можно добавить сброс формы или сообщение об успехе
    } catch (e) {
      console.error(e);
      // UI-уведомление об ошибке
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
})();
