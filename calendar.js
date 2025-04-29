function createCalendar({
  container,
  initialDate = new Date(),
  selectedDates = [],
  showHeader = true,
  showNav = true,
  onDateSelect,
  width = "600px",
  height = "auto",
  tdPadding = "12px",
  allowedWeekends = [],
  slots = {},
}) {
  function getDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const state = {
    currentDate: new Date(initialDate),
    selected: new Set(selectedDates.map(getDateKey)),
    allowedWeekends: new Set(allowedWeekends),
    slots: slots,
  };

  const STYLE_ID = "calendar-styles";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
  :root {
      --calendar-bg: #fff;
      --calendar-text: #333;
      --header-bg: #2196F3;
      --header-text: #fff;
      --day-hover: #e0e0e0;
      --selected-bg: rgb(243, 82, 33);
      --selected-text: #fff;
      --today-bg: #ffeb3b;
      --disabled-text: #ccc;
  }
  .calendar-container {
      font-family: Arial, sans-serif;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      background: var(--calendar-bg);
      color: var(--calendar-text);
      width: 100%;              
      box-sizing: border-box;   
  }
  .calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px;
      background: var(--header-bg);
      color: var(--header-text);
      border-radius: 8px 8px 0 0;
  }
  .calendar-nav button {
      background: none;
      border: none;
      color: inherit;
      font-size: 1.2em;
      cursor: pointer;
      padding: 5px 10px;
      border-radius: 4px;
  }
  .calendar-nav button:hover {
      background: rgba(255,255,255,0.1);
  }
  .calendar-table {
      width: 100%;              
      border-collapse: collapse;
  }
  .calendar-table th,
  .calendar-table td {
      text-align: center;
      max-width: ${tdPadding};
      padding: 1.5% 0;
      border: 1px solid #ddd;
  }
  .calendar-table th {
      background: #f5f5f5;
      font-weight: bold;
  }
  .calendar-day {
      cursor: pointer;
      transition: all 0.2s;
  }
  .calendar-day:hover {
      background: var(--day-hover);
  }
  .calendar-day.selected {
      background: var(--selected-bg);
      color: var(--selected-text);
  }
  .calendar-day.today {
      background: var(--today-bg);
  }
  .calendar-day.other-month {
      color: var(--disabled-text);
  }
  .slots-container {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 5px;
  }
  .slot-item {
      display: flex;
      align-items: center;
      gap: 10px;
  }
  @media (max-width: 480px) {
      .calendar-table th,
      .calendar-table td {
          padding: 8px;
      }
  }
`;
    document.head.appendChild(style);
  }

  container.style.width = width;
  container.style.height = height;

  const isWeekend = (date) =>
    false && (date.getDay() === 0 || date.getDay() === 6);
  const getMonthYearString = () =>
    state.currentDate.toLocaleString("ru-RU", {
      month: "long",
      year: "numeric",
    });

  const getWeeks = () => {
    const weeks = [];
    const first = new Date(
      state.currentDate.getFullYear(),
      state.currentDate.getMonth(),
      1
    );
    const shift = (first.getDay() + 6) % 7;
    const curr = new Date(first);
    curr.setDate(curr.getDate() - shift);
    const last = new Date(
      state.currentDate.getFullYear(),
      state.currentDate.getMonth() + 1,
      0
    );
    while (curr <= last || weeks.length < 6) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  };

  const isCurrentMonth = (date) =>
    date.getMonth() === state.currentDate.getMonth();
  const isToday = (date) => date.toDateString() === new Date().toDateString();

  const markWeekends = () => {
    getWeeks()
      .flat()
      .forEach((date) => {
        const key = getDateKey(date);
        if (isWeekend(date) && !state.allowedWeekends.has(key)) {
          state.selected.add(key);
        } else if (state.slots[key]) {
          const allSlotsBusy = state.slots[key].every(
            (slot) => slot[2] === true && slot[3] !== -1
          );
          if (allSlotsBusy) {
            state.selected.add(key);
          }
        }
      });
  };

  const render = (selectedDays = state.selected) => {
    state.selected = new Set(
      [...selectedDays].map((d) => {
        if (d instanceof Date) return getDateKey(d);
        return d;
      })
    );
    markWeekends();
    const calendar = document.createElement("div");
    calendar.className = "calendar-container";
    if (showHeader) calendar.appendChild(createHeader());
    calendar.appendChild(createTable());
    const slotsContainer = document.createElement("div");
    slotsContainer.className = "slots-container";
    calendar.appendChild(slotsContainer);
    if (container.firstChild)
      container.replaceChild(calendar, container.firstChild);
    else container.appendChild(calendar);
  };

  const createHeader = () => {
    const header = document.createElement("div");
    header.className = "calendar-header";
    const monthYear = document.createElement("div");
    monthYear.textContent = getMonthYearString();
    header.appendChild(monthYear);
    if (showNav) header.appendChild(createNavigation());
    return header;
  };

  const createNavigation = () => {
    const nav = document.createElement("div");
    nav.className = "calendar-nav";
    const prev = document.createElement("button");
    prev.innerHTML = "<";
    prev.addEventListener("click", () => navigate(-1));
    const next = document.createElement("button");
    next.innerHTML = ">";
    next.addEventListener("click", () => navigate(1));
    nav.append(prev, next);
    return nav;
  };

  const createTable = () => {
    const table = document.createElement("table");
    table.className = "calendar-table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].forEach((d) => {
      const th = document.createElement("th");
      th.textContent = d;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    getWeeks().forEach((week) => {
      const row = document.createElement("tr");
      week.forEach((day) => createDayCell(day, row));
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    return table;
  };

  const createDayCell = (date, row) => {
    const td = document.createElement("td");
    td.className = "calendar-day";
    td.textContent = date.getDate();
    td.dataset.date = getDateKey(date);
    if (!isCurrentMonth(date)) td.classList.add("other-month");
    if (isToday(date)) td.classList.add("today");
    if (state.selected.has(getDateKey(date))) td.classList.add("selected");

    const key = getDateKey(date);
    const isAllowedWeekend = isWeekend(date) && state.allowedWeekends.has(key);
    if (!isWeekend(date) || isAllowedWeekend) {
      td.addEventListener("click", () => showSlots(date));
    }

    row.appendChild(td);
  };

  const showSlots = (date) => {
    const key = getDateKey(date);
    const slotsForDay = state.slots[key] || [];
    const availableSlots = slotsForDay.filter(
      (slot) => slot[2] === false && slot[3] === -1
    );
    if (availableSlots.length === 0) {
      alert("Нет доступных слотов на этот день.");
      return;
    }
    const slotsContainer = container.querySelector(".slots-container");
    slotsContainer.innerHTML = "";
    availableSlots.forEach((slot, index) => {
      const slotItem = document.createElement("div");
      slotItem.className = "slot-item";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "slot";
      radio.value = index;
      radio.addEventListener("change", () => selectSlot(date, slot));
      const label = document.createElement("label");
      label.textContent = `${slot[0]} - ${slot[1]}`;
      slotItem.append(radio, label);
      slotsContainer.appendChild(slotItem);
    });
  };

  const selectSlot = (date, slot) => {
    if (onDateSelect) {
      onDateSelect({ render, date, slot });
    }
  };

  const navigate = (delta) => {
    state.currentDate.setMonth(state.currentDate.getMonth() + delta);
    render();
  };

  render();

  return {
    getSelectedDates: () =>
      Array.from(state.selected).map((k) => {
        const [y, m, d] = k.split("-");
        return new Date(+y, +m - 1, +d);
      }),
    setDate: (date) => {
      state.currentDate = new Date(date);
      render();
    },
  };
}
