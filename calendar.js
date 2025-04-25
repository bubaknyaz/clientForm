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

  const isWeekend = (date) => date.getDay() === 0 || date.getDay() === 6;
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
        if (isWeekend(date)) state.selected.add(getDateKey(date));
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
    prev.innerHTML = "&lt;";
    prev.addEventListener("click", () => navigate(-1));
    const next = document.createElement("button");
    next.innerHTML = "&gt;";
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
    if (!isWeekend(date))
      td.addEventListener("click", () => handleDateClick(date));
    row.appendChild(td);
  };

  const handleDateClick = (date) => {
    const key = getDateKey(date);
    if (state.selected.has(key)) state.selected.delete(key);
    else state.selected.add(key);
    if (onDateSelect) onDateSelect({ render, date, selected: state.selected });
    render();
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
