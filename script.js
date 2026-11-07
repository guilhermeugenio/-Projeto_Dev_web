// Controla o quadro, a movimentação dos cartões e o salvamento local.
(() => {
  const STORAGE_KEY = "quadro-kanban-atividades";
  const COLUMNS_KEY = "quadro-kanban-colunas";
  const THEME_KEY = "quadro-kanban-tema";
  const COLORS = ["blue", "amber", "green", "violet", "rose"];
  const DEFAULT_COLUMNS = [
    { id: "todo", title: "A Fazer", color: "blue", icon: "◷" },
    { id: "progress", title: "Em Andamento", color: "amber", icon: "◒" },
    { id: "done", title: "Concluído", color: "green", icon: "✓" }
  ];
  const notice = document.querySelector("#aviso");
  const board = document.querySelector("#board");
  const taskDialog = document.querySelector("#task-dialog");
  const taskForm = document.querySelector("#task-form");
  const taskTitle = document.querySelector("#task-title");
  const taskPriority = document.querySelector("#task-priority");
  const dialogTitle = document.querySelector("#dialog-title");
  const formError = document.querySelector("#form-error");
  const columnDialog = document.querySelector("#column-dialog");
  const columnForm = document.querySelector("#column-form");
  const columnTitle = document.querySelector("#column-title");
  const columnError = document.querySelector("#column-error");
  let columns = loadColumns();
  let cards = loadCards();
  let editingCardId = null;
  let newCardColumnId = null;
  let touchDrag = null;

  // Mantém as três colunas iniciais ao abrir quadros criados em versões anteriores.
  function loadColumns() {
    try {
      const saved = localStorage.getItem(COLUMNS_KEY);
      if (!saved) return DEFAULT_COLUMNS.map((column) => ({ ...column }));

      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error("As colunas salvas não são uma lista.");

      const validColumns = parsed.filter((column) =>
        column &&
        typeof column.id === "string" &&
        typeof column.title === "string" &&
        column.title.trim() !== "" &&
        COLORS.includes(column.color)
      );
      return validColumns.length ? validColumns : DEFAULT_COLUMNS.map((column) => ({ ...column }));
    } catch (error) {
      notice.textContent = "Não foi possível carregar as colunas salvas. As colunas padrão serão usadas.";
      console.error("Erro ao carregar as colunas do Kanban:", error);
      return DEFAULT_COLUMNS.map((column) => ({ ...column }));
    }
  }

  // Recupera somente atividades válidas e dá prioridade média aos cartões antigos.
  function loadCards() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];

      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error("Os dados salvos não são uma lista.");

      return parsed
        .filter((card) =>
          card &&
          typeof card.id === "string" &&
          typeof card.title === "string" &&
          card.title.trim() !== "" &&
          columns.some((column) => column.id === card.status)
        )
        .map((card) => ({
          ...card,
          priority: ["low", "medium", "high"].includes(card.priority) ? card.priority : "medium"
        }));
    } catch (error) {
      notice.textContent = "Não foi possível carregar as atividades salvas. O quadro começará vazio.";
      console.error("Erro ao carregar o quadro Kanban:", error);
      return [];
    }
  }

  // Exibe erros de armazenamento em vez de indicar que o salvamento deu certo.
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
      localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
      notice.textContent = "";
    } catch (error) {
      notice.textContent = "Não foi possível salvar as alterações neste navegador.";
      console.error("Erro ao salvar o quadro Kanban:", error);
    }
  }

  function loadTheme() {
    try {
      return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
    } catch (error) {
      notice.textContent = "Não foi possível carregar a preferência de tema.";
      console.error("Erro ao carregar o tema:", error);
      return "light";
    }
  }

  function setTheme(theme, persist = true) {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    const toggle = document.querySelector("#theme-toggle");
    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.setAttribute("aria-label", isDark ? "Ativar modo claro" : "Ativar modo escuro");
    toggle.querySelector("[aria-hidden]").textContent = isDark ? "☀" : "☾";
    toggle.querySelector(".theme-label").textContent = isDark ? "Modo claro" : "Modo escuro";
    document.querySelector('meta[name="theme-color"]').content = isDark ? "#171a24" : "#f5f7fb";

    if (!persist) return;
    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch (error) {
      notice.textContent = "Não foi possível salvar a preferência de tema.";
      console.error("Erro ao salvar o tema:", error);
    }
  }

  function render() {
    board.replaceChildren(...columns.map(createColumnElement));
  }

  function createColumnElement(column) {
    const section = document.createElement("section");
    section.className = "column";
    section.dataset.status = column.id;
    section.dataset.color = column.color;

    const headingId = `heading-${column.id}`;
    section.setAttribute("aria-labelledby", headingId);

    const header = document.createElement("header");
    header.className = "column-header";

    const titleGroup = document.createElement("div");
    titleGroup.className = "column-title";

    const icon = document.createElement("span");
    icon.className = "column-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = column.icon || "◆";

    const heading = document.createElement("h2");
    heading.id = headingId;
    heading.textContent = column.title;

    const count = document.createElement("span");
    count.className = "count";
    count.textContent = String(cards.filter((card) => card.status === column.id).length);
    count.setAttribute(
      "aria-label",
      `${count.textContent} ${count.textContent === "1" ? "cartão" : "cartões"}`
    );

    titleGroup.append(icon, heading, count);

    const addButton = document.createElement("button");
    addButton.className = "add-button";
    addButton.type = "button";
    addButton.dataset.add = column.id;
    addButton.setAttribute("aria-label", `Adicionar atividade em ${column.title}`);
    addButton.textContent = "+";
    header.append(titleGroup, addButton);

    const list = document.createElement("div");
    list.className = "cards";
    list.dataset.list = column.id;
    list.setAttribute("aria-label", `Atividades: ${column.title}`);
    list.append(...cards.filter((card) => card.status === column.id).map(createCardElement));

    const addLink = document.createElement("button");
    addLink.className = "add-link";
    addLink.type = "button";
    addLink.dataset.add = column.id;
    addLink.textContent = "+ Adicionar atividade";
    section.append(header, list, addLink);
    return section;
  }

  function createCardElement(card) {
    const article = document.createElement("article");
    article.className = "card";
    article.dataset.priority = card.priority;
    article.draggable = true;
    article.tabIndex = 0;
    article.dataset.cardId = card.id;
    article.setAttribute("aria-label", `${card.title}. Prioridade ${priorityLabel(card.priority)}.`);

    const title = document.createElement("p");
    title.className = "card-title";
    title.textContent = card.title;

    const priority = document.createElement("span");
    priority.className = "priority-badge";
    priority.textContent = `Prioridade ${priorityLabel(card.priority).toLowerCase()}`;

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const editButton = document.createElement("button");
    editButton.className = "card-action";
    editButton.type = "button";
    editButton.dataset.action = "edit";
    editButton.textContent = "Editar";
    editButton.setAttribute("aria-label", `Editar atividade: ${card.title}`);

    const deleteButton = document.createElement("button");
    deleteButton.className = "card-action delete";
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.textContent = "Excluir";
    deleteButton.setAttribute("aria-label", `Excluir atividade: ${card.title}`);

    actions.append(editButton, deleteButton);
    article.append(title, priority, actions);
    return article;
  }

  function priorityLabel(priority) {
    return { low: "Baixa", medium: "Média", high: "Alta" }[priority] || "Média";
  }

  function addCard(columnId) {
    editingCardId = null;
    newCardColumnId = columnId;
    dialogTitle.textContent = "Nova atividade";
    taskTitle.value = "";
    taskPriority.value = "medium";
    formError.textContent = "";
    taskDialog.showModal();
    taskTitle.focus();
  }

  function editCard(card) {
    editingCardId = card.id;
    newCardColumnId = null;
    dialogTitle.textContent = "Editar atividade";
    taskTitle.value = card.title;
    taskPriority.value = card.priority;
    formError.textContent = "";
    taskDialog.showModal();
    taskTitle.focus();
  }

  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = taskTitle.value.trim();
    if (!title) {
      formError.textContent = "O título da atividade é obrigatório.";
      taskTitle.focus();
      return;
    }

    if (editingCardId) {
      const card = cards.find((item) => item.id === editingCardId);
      if (!card) return;
      card.title = title;
      card.priority = taskPriority.value;
    } else if (newCardColumnId) {
      cards.push({
        id: createId(),
        title,
        status: newCardColumnId,
        priority: taskPriority.value
      });
    } else {
      return;
    }

    taskDialog.close();
    saveState();
    render();
  });

  document.querySelector("#cancel-dialog").addEventListener("click", () => taskDialog.close());

  document.querySelector("#add-column").addEventListener("click", () => {
    columnTitle.value = "";
    columnError.textContent = "";
    columnDialog.showModal();
    columnTitle.focus();
  });

  columnForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = columnTitle.value.trim();
    if (!title) {
      columnError.textContent = "O nome da coluna é obrigatório.";
      columnTitle.focus();
      return;
    }

    if (columns.some((column) => column.title.toLocaleLowerCase() === title.toLocaleLowerCase())) {
      columnError.textContent = "Já existe uma coluna com esse nome.";
      columnTitle.focus();
      return;
    }

    columns.push({
      id: createId(),
      title,
      color: COLORS[columns.length % COLORS.length],
      icon: "◆"
    });
    columnDialog.close();
    saveState();
    render();
  });

  document.querySelector("#cancel-column").addEventListener("click", () => columnDialog.close());

  // Usa UUID quando disponível e mantém compatibilidade com navegadores antigos.
  function createId() {
    return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  board.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add]");
    if (addButton) {
      addCard(addButton.dataset.add);
      return;
    }

    const button = event.target.closest("[data-action]");
    if (!button) return;

    const cardElement = button.closest("[data-card-id]");
    const card = cards.find((item) => item.id === cardElement.dataset.cardId);
    if (!card) return;

    if (button.dataset.action === "edit") {
      editCard(card);
    } else if (button.dataset.action === "delete") {
      cards = cards.filter((item) => item.id !== card.id);
      saveState();
      render();
    }
  });

  // Eventos nativos permitem arrastar os cartões com mouse ou caneta.
  board.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".card");
    if (!card) return;

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.dataset.cardId);
    card.classList.add("is-dragging");
  });

  board.addEventListener("dragend", (event) => {
    const card = event.target.closest(".card");
    if (card) card.classList.remove("is-dragging");
    document.querySelectorAll(".column").forEach((column) => column.classList.remove("is-over"));
  });

  board.addEventListener("dragover", (event) => {
    const column = event.target.closest(".column");
    if (!column) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    column.classList.add("is-over");
  });

  board.addEventListener("dragleave", (event) => {
    const column = event.target.closest(".column");
    if (column && !column.contains(event.relatedTarget)) column.classList.remove("is-over");
  });

  board.addEventListener("drop", (event) => {
    const column = event.target.closest(".column");
    if (!column) return;
    event.preventDefault();
    column.classList.remove("is-over");
    moveCard(event.dataTransfer.getData("text/plain"), column.dataset.status);
  });

  // No toque, arraste o cartão pela coluna; os espaços ao redor continuam roláveis.
  board.addEventListener("pointerdown", (event) => {
    const card = event.target.closest(".card");
    if (event.pointerType !== "touch" || !card || event.target.closest("button")) return;
    touchDrag = {
      cardId: card.dataset.cardId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
  });

  board.addEventListener("pointermove", (event) => {
    if (!touchDrag || touchDrag.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - touchDrag.startX, event.clientY - touchDrag.startY);
    if (distance < 8) return;

    touchDrag.moved = true;
    event.preventDefault();
    board.classList.add("is-touch-dragging");
    const card = board.querySelector(`[data-card-id="${CSS.escape(touchDrag.cardId)}"]`);
    if (card) card.classList.add("is-dragging");

    const boardBounds = board.getBoundingClientRect();
    if (event.clientX > boardBounds.right - 42) board.scrollBy({ left: 18, behavior: "instant" });
    if (event.clientX < boardBounds.left + 42) board.scrollBy({ left: -18, behavior: "instant" });

    document.querySelectorAll(".column").forEach((column) => column.classList.remove("is-over"));
    const target = document.elementFromPoint(event.clientX, event.clientY);
    target?.closest(".column")?.classList.add("is-over");
  });

  function finishTouchDrag(event) {
    if (!touchDrag || touchDrag.pointerId !== event.pointerId) return;
    const drag = touchDrag;
    touchDrag = null;

    board.classList.remove("is-touch-dragging");
    document.querySelectorAll(".column").forEach((column) => column.classList.remove("is-over"));
    board.querySelectorAll(".card.is-dragging").forEach((card) => card.classList.remove("is-dragging"));
    if (!drag.moved) return;

    const targetColumn = document.elementFromPoint(event.clientX, event.clientY)?.closest(".column");
    if (targetColumn) moveCard(drag.cardId, targetColumn.dataset.status);
  }

  board.addEventListener("pointerup", finishTouchDrag);
  board.addEventListener("pointercancel", finishTouchDrag);

  function moveCard(cardId, columnId) {
    const card = cards.find((item) => item.id === cardId);
    if (!card || !columns.some((column) => column.id === columnId) || card.status === columnId) return;
    card.status = columnId;
    saveState();
    render();
  }

  document.querySelector("#theme-toggle").addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  setTheme(loadTheme(), false);
  render();
})();
