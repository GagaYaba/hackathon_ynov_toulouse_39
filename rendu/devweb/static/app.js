const CONVERSATIONS_KEY = "techcorp_conversations";
const ACTIVE_CONVERSATION_KEY = "techcorp_active_conversation_id";
const FOLDERS_KEY = "techcorp_folders";
const SIDEBAR_STATE_KEY = "techcorp_sidebar_state";
const DEFAULT_TITLE = "Nouvelle conversation";
const MAX_TITLE_LENGTH = 35;

const chatMessages = document.querySelector("#chatMessages");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const clearButton = document.querySelector("#clearButton");
const newChatButton = document.querySelector("#newChatButton");
const foldersToggle = document.querySelector("#foldersToggle");
const recentsToggle = document.querySelector("#recentsToggle");
const addFolderButton = document.querySelector("#addFolderButton");
const folderList = document.querySelector("#folderList");
const recentConversationList = document.querySelector("#recentConversationList");
const statusBadge = document.querySelector("#statusBadge");
const modelName = document.querySelector("#modelName");
const welcomePanel = document.querySelector("#welcomePanel");
const suggestionButtons = document.querySelectorAll(".suggestion-card");
const modalOverlay = document.querySelector("#modalOverlay");
const modalTitle = document.querySelector("#modalTitle");
const modalDescription = document.querySelector("#modalDescription");
const modalForm = document.querySelector("#modalForm");
const modalField = document.querySelector("#modalField");
const modalInputLabel = document.querySelector("#modalInputLabel");
const modalInput = document.querySelector("#modalInput");
const modalCancelButton = document.querySelector("#modalCancelButton");
const modalCloseButton = document.querySelector("#modalCloseButton");
const modalConfirmButton = document.querySelector("#modalConfirmButton");

let conversations = [];
let folders = [];
let sidebarState = {
  foldersCollapsed: false,
  recentsCollapsed: false,
};
let activeConversationId = null;
let draggedConversationId = null;
let activeModal = null;

const ICON_FALLBACKS = {
  "arrow-up": "^",
  "chevron-down": "v",
  "chevron-right": ">",
  ellipsis: "...",
  folder: "[]",
  "message-square": "-",
  "move-right": ">",
  plus: "+",
  "trash-2": "x",
  x: "x",
};

function createIcon(name) {
  const icon = document.createElement("i");
  icon.setAttribute("data-lucide", name);
  icon.setAttribute("data-fallback", ICON_FALLBACKS[name] || "");
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function refreshIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

function createConversation(folderId = null) {
  const now = new Date().toISOString();

  return {
    id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: DEFAULT_TITLE,
    createdAt: now,
    updatedAt: now,
    folderId,
    messages: [],
  };
}

function createFolder(name) {
  return {
    id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: new Date().toISOString(),
    collapsed: false,
  };
}

function truncateTitle(title) {
  const normalized = title.replace(/\s+/g, " ").trim();
  const chars = Array.from(normalized);

  if (chars.length <= MAX_TITLE_LENGTH) {
    return normalized || DEFAULT_TITLE;
  }

  return `${chars.slice(0, MAX_TITLE_LENGTH - 3).join("").trimEnd()}...`;
}

function getChevronIcon(collapsed) {
  return collapsed ? "chevron-right" : "chevron-down";
}

function getActiveConversation() {
  return conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0];
}

function setSectionChevron(button, collapsed) {
  const oldChevron = button.querySelector(".section-chevron");
  const newChevron = createIcon(getChevronIcon(collapsed));
  newChevron.classList.add("section-chevron");
  oldChevron?.replaceWith(newChevron);
}

function folderExists(folderId) {
  return folders.some((folder) => folder.id === folderId);
}

function normalizeFolder(rawFolder) {
  const fallback = createFolder("Nouveau dossier");
  const name = typeof rawFolder?.name === "string" ? rawFolder.name.trim() : "";

  return {
    id: typeof rawFolder?.id === "string" ? rawFolder.id : fallback.id,
    name: name || fallback.name,
    createdAt: typeof rawFolder?.createdAt === "string" ? rawFolder.createdAt : fallback.createdAt,
    collapsed: Boolean(rawFolder?.collapsed),
  };
}

function normalizeConversation(rawConversation) {
  const fallback = createConversation();
  const messages = Array.isArray(rawConversation?.messages)
    ? rawConversation.messages
        .filter((message) => message && ["user", "assistant"].includes(message.role) && typeof message.content === "string")
        .map((message) => ({ role: message.role, content: message.content }))
    : [];

  return {
    id: typeof rawConversation?.id === "string" ? rawConversation.id : fallback.id,
    title: typeof rawConversation?.title === "string" && rawConversation.title.trim()
      ? truncateTitle(rawConversation.title)
      : DEFAULT_TITLE,
    createdAt: typeof rawConversation?.createdAt === "string" ? rawConversation.createdAt : fallback.createdAt,
    updatedAt: typeof rawConversation?.updatedAt === "string" ? rawConversation.updatedAt : fallback.updatedAt,
    folderId: typeof rawConversation?.folderId === "string" ? rawConversation.folderId : null,
    messages,
  };
}

function loadFolders() {
  try {
    const storedFolders = JSON.parse(localStorage.getItem(FOLDERS_KEY) || "[]");
    folders = Array.isArray(storedFolders) ? storedFolders.map(normalizeFolder) : [];
  } catch (error) {
    folders = [];
  }
}

function loadSidebarState() {
  try {
    const storedState = JSON.parse(localStorage.getItem(SIDEBAR_STATE_KEY) || "{}");
    sidebarState = {
      foldersCollapsed: Boolean(storedState.foldersCollapsed),
      recentsCollapsed: Boolean(storedState.recentsCollapsed),
    };
  } catch (error) {
    sidebarState = {
      foldersCollapsed: false,
      recentsCollapsed: false,
    };
  }
}

function loadConversations() {
  try {
    const storedConversations = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) || "[]");
    conversations = Array.isArray(storedConversations)
      ? storedConversations.map(normalizeConversation)
      : [];
  } catch (error) {
    conversations = [];
  }

  conversations.forEach((conversation) => {
    if (conversation.folderId && !folderExists(conversation.folderId)) {
      conversation.folderId = null;
    }
  });

  if (conversations.length === 0) {
    conversations = [createConversation()];
  }

  activeConversationId = localStorage.getItem(ACTIVE_CONVERSATION_KEY);
  if (!conversations.some((conversation) => conversation.id === activeConversationId)) {
    activeConversationId = conversations[0].id;
  }
}

function saveState() {
  conversations.sort((first, second) => new Date(second.updatedAt) - new Date(first.updatedAt));
  folders.sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt));
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeConversationId);
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(sidebarState));
}

function formatConversationDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function setModalError(message) {
  modalDescription.textContent = message || activeModal.description || "";
}

function openModal(config) {
  activeModal = config;
  modalTitle.textContent = config.title;
  modalDescription.textContent = config.description || "";
  modalConfirmButton.textContent = config.confirmText || "Valider";
  modalConfirmButton.classList.toggle("is-danger", Boolean(config.danger));
  modalField.classList.toggle("is-hidden", !config.input);

  if (config.input) {
    modalInputLabel.textContent = config.label || "";
    modalInput.placeholder = config.placeholder || "";
    modalInput.value = config.value || "";
    modalConfirmButton.disabled = Boolean(config.requireInput && !modalInput.value.trim());
  } else {
    modalConfirmButton.disabled = false;
  }

  modalOverlay.hidden = false;
  refreshIcons();

  if (config.input) {
    requestAnimationFrame(() => {
      modalInput.focus();
      modalInput.select();
    });
  } else {
    modalConfirmButton.focus();
  }
}

function closeModal() {
  activeModal = null;
  modalOverlay.hidden = true;
  modalForm.reset();
  modalInput.value = "";
}

function submitModal() {
  if (!activeModal) {
    return;
  }

  const value = modalInput.value.trim();
  if (activeModal.requireInput && !value) {
    modalConfirmButton.disabled = true;
    return;
  }

  const result = activeModal.onConfirm?.(value);
  if (result && result.ok === false) {
    setModalError(result.error);
    return;
  }

  closeModal();
}

function setStatus({ connected, provider, model }) {
  statusBadge.classList.remove("status-connected", "status-disconnected", "status-error", "status-checking");

  if (connected) {
    statusBadge.textContent = "Connect\u00e9";
    statusBadge.classList.add("status-connected");
  } else if (provider === "mock") {
    statusBadge.textContent = "Mode test";
    statusBadge.classList.add("status-disconnected");
  } else {
    statusBadge.textContent = "D\u00e9connect\u00e9";
    statusBadge.classList.add("status-disconnected");
  }

  if (model) {
    modelName.textContent = model;
  }
}

function updateWelcomeState() {
  const activeConversation = getActiveConversation();
  welcomePanel.classList.toggle("is-hidden", Boolean(activeConversation?.messages.length));
}

function scrollToLatestMessage() {
  chatMessages.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
}

function addMessageToDom(role, content) {
  const message = document.createElement("article");
  message.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "message-content";
  bubble.textContent = content;

  message.appendChild(bubble);
  chatMessages.appendChild(message);
  scrollToLatestMessage();

  return message;
}

function renderMessages() {
  const activeConversation = getActiveConversation();
  chatMessages.innerHTML = "";

  activeConversation?.messages.forEach((message) => {
    addMessageToDom(message.role, message.content);
  });

  updateWelcomeState();
}

function createConversationRow(conversation) {
  const row = document.createElement("div");
  row.className = `conversation-row${conversation.id === activeConversationId ? " is-active" : ""}`;
  row.draggable = true;
  row.dataset.draggableConversationId = conversation.id;

  const button = document.createElement("button");
  button.className = "conversation-button";
  button.type = "button";
  button.dataset.conversationId = conversation.id;
  button.title = conversation.title;
  button.setAttribute("aria-current", conversation.id === activeConversationId ? "true" : "false");

  const title = document.createElement("span");
  title.className = "conversation-title";
  const titleLabel = document.createElement("span");
  titleLabel.className = "sidebar-item-label";
  titleLabel.textContent = conversation.title || DEFAULT_TITLE;
  title.append(createIcon("message-square"), titleLabel);

  const date = document.createElement("span");
  date.className = "conversation-date";
  date.textContent = formatConversationDate(conversation.updatedAt);

  const moveButton = document.createElement("button");
  moveButton.className = "move-conversation-button";
  moveButton.type = "button";
  moveButton.dataset.moveConversationId = conversation.id;
  moveButton.setAttribute("aria-label", `Ranger ${conversation.title || DEFAULT_TITLE}`);
  moveButton.title = "Ranger dans un dossier";
  moveButton.appendChild(createIcon("move-right"));

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-conversation-button";
  deleteButton.type = "button";
  deleteButton.dataset.deleteConversationId = conversation.id;
  deleteButton.setAttribute("aria-label", `Supprimer ${conversation.title || DEFAULT_TITLE}`);
  deleteButton.appendChild(createIcon("trash-2"));

  button.append(title, date);
  row.append(button, moveButton, deleteButton);
  return row;
}

function renderFolder(folder) {
  const block = document.createElement("div");
  block.className = "folder-block";
  block.dataset.dropFolderId = folder.id;

  const row = document.createElement("div");
  row.className = "folder-row";

  const toggleButton = document.createElement("button");
  toggleButton.className = "folder-toggle";
  toggleButton.type = "button";
  toggleButton.dataset.folderToggleId = folder.id;
  toggleButton.title = "Replier ou d\u00e9plier";

  const name = document.createElement("span");
  name.className = "folder-name";
  const nameLabel = document.createElement("span");
  nameLabel.className = "sidebar-item-label";
  nameLabel.textContent = folder.name;
  name.append(createIcon("folder"), nameLabel);

  const newConversationButton = document.createElement("button");
  newConversationButton.className = "new-folder-conversation-button";
  newConversationButton.type = "button";
  newConversationButton.dataset.newConversationFolderId = folder.id;
  newConversationButton.setAttribute("aria-label", `Nouvelle conversation dans ${folder.name}`);
  newConversationButton.title = "Nouvelle conversation";
  newConversationButton.appendChild(createIcon("plus"));

  const renameButton = document.createElement("button");
  renameButton.className = "rename-folder-button";
  renameButton.type = "button";
  renameButton.dataset.renameFolderId = folder.id;
  renameButton.setAttribute("aria-label", `Renommer ${folder.name}`);
  renameButton.title = "Renommer";
  renameButton.appendChild(createIcon("ellipsis"));

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-folder-button";
  deleteButton.type = "button";
  deleteButton.dataset.deleteFolderId = folder.id;
  deleteButton.setAttribute("aria-label", `Supprimer ${folder.name}`);
  deleteButton.appendChild(createIcon("x"));

  toggleButton.append(createIcon(getChevronIcon(folder.collapsed)), name);
  row.append(toggleButton, newConversationButton, renameButton, deleteButton);
  block.appendChild(row);

  if (!folder.collapsed) {
    const nestedList = document.createElement("div");
    nestedList.className = "folder-conversations";
    const folderConversations = conversations.filter((conversation) => conversation.folderId === folder.id);

    if (folderConversations.length === 0) {
      const empty = document.createElement("div");
      empty.className = "section-empty";
      empty.textContent = "Aucune conversation";
      nestedList.appendChild(empty);
    } else {
      folderConversations.forEach((conversation) => {
        nestedList.appendChild(createConversationRow(conversation));
      });
    }

    block.appendChild(nestedList);
  }

  return block;
}

function renderSidebar() {
  foldersToggle.setAttribute("aria-expanded", String(!sidebarState.foldersCollapsed));
  recentsToggle.setAttribute("aria-expanded", String(!sidebarState.recentsCollapsed));
  setSectionChevron(foldersToggle, sidebarState.foldersCollapsed);
  setSectionChevron(recentsToggle, sidebarState.recentsCollapsed);

  folderList.innerHTML = "";
  recentConversationList.innerHTML = "";

  if (!sidebarState.foldersCollapsed) {
    if (folders.length === 0) {
      const empty = document.createElement("div");
      empty.className = "section-empty";
      empty.textContent = "Aucun dossier";
      folderList.appendChild(empty);
    } else {
      folders.forEach((folder) => {
        folderList.appendChild(renderFolder(folder));
      });
    }
  }

  if (!sidebarState.recentsCollapsed) {
    const recentConversations = conversations.filter((conversation) => !conversation.folderId);

    if (recentConversations.length === 0) {
      const empty = document.createElement("div");
      empty.className = "section-empty";
      empty.textContent = "Aucune conversation";
      recentConversationList.appendChild(empty);
    } else {
      recentConversations.forEach((conversation) => {
        recentConversationList.appendChild(createConversationRow(conversation));
      });
    }
  }

  refreshIcons();
}

function renderApp() {
  renderSidebar();
  renderMessages();
}

function setSending(isSending) {
  sendButton.disabled = isSending;
  clearButton.disabled = isSending;
  newChatButton.disabled = isSending;
  addFolderButton.disabled = isSending;
  foldersToggle.disabled = isSending;
  recentsToggle.disabled = isSending;
  folderList.querySelectorAll("button").forEach((button) => {
    button.disabled = isSending;
  });
  recentConversationList.querySelectorAll("button").forEach((button) => {
    button.disabled = isSending;
  });
  suggestionButtons.forEach((button) => {
    button.disabled = isSending;
  });
  messageInput.disabled = isSending;
  sendButton.setAttribute("aria-label", isSending ? "Envoi en cours" : "Envoyer");
}

function startNewConversation(folderId = null) {
  const conversation = createConversation(folderId);
  conversations.unshift(conversation);
  activeConversationId = conversation.id;

  if (folderId) {
    const folder = folders.find((item) => item.id === folderId);
    if (folder) {
      folder.collapsed = false;
      sidebarState.foldersCollapsed = false;
    }
  }

  saveState();
  renderApp();
  messageInput.focus();
}

function clearActiveConversation() {
  const activeConversation = getActiveConversation();
  if (!activeConversation) {
    startNewConversation();
    return;
  }

  activeConversation.title = DEFAULT_TITLE;
  activeConversation.updatedAt = new Date().toISOString();
  activeConversation.messages = [];
  saveState();
  renderApp();
  messageInput.value = "";
  messageInput.focus();
}

function requestDeleteConversation(conversationId) {
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) {
    return;
  }

  openModal({
    title: "Supprimer la conversation",
    description: `La conversation \"${conversation.title || DEFAULT_TITLE}\" sera supprim\u00e9e de ce navigateur.`,
    confirmText: "Supprimer",
    danger: true,
    onConfirm: () => {
      deleteConversation(conversationId);
    },
  });
}

function deleteConversation(conversationId) {
  const index = conversations.findIndex((conversation) => conversation.id === conversationId);
  if (index === -1) {
    return;
  }

  conversations.splice(index, 1);

  if (conversations.length === 0) {
    conversations.push(createConversation());
  }

  if (!conversations.some((conversation) => conversation.id === activeConversationId)) {
    activeConversationId = conversations[0].id;
  }

  saveState();
  renderApp();
  messageInput.focus();
}

function addFolder() {
  openModal({
    title: "Cr\u00e9er un dossier",
    label: "Nom du dossier",
    placeholder: "Ex : Questions finance",
    confirmText: "Cr\u00e9er",
    input: true,
    requireInput: true,
    onConfirm: (folderName) => {
      folders.push(createFolder(folderName));
      sidebarState.foldersCollapsed = false;
      saveState();
      renderSidebar();
    },
  });
}

function renameFolder(folderId) {
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) {
    return;
  }

  openModal({
    title: "Renommer le dossier",
    label: "Nom du dossier",
    placeholder: "Ex : Questions finance",
    value: folder.name,
    confirmText: "Renommer",
    input: true,
    requireInput: true,
    onConfirm: (folderName) => {
      folder.name = folderName;
      saveState();
      renderSidebar();
    },
  });
}

function requestDeleteFolder(folderId) {
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) {
    return;
  }

  openModal({
    title: "Supprimer le dossier",
    description: "Les conversations de ce dossier ne seront pas supprim\u00e9es. Elles seront d\u00e9plac\u00e9es dans R\u00e9cents.",
    confirmText: "Supprimer",
    danger: true,
    onConfirm: () => {
      deleteFolder(folderId);
    },
  });
}

function deleteFolder(folderId) {
  conversations.forEach((conversation) => {
    if (conversation.folderId === folderId) {
      conversation.folderId = null;
    }
  });

  folders = folders.filter((item) => item.id !== folderId);
  sidebarState.recentsCollapsed = false;
  saveState();
  renderApp();
}

function toggleFolder(folderId) {
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) {
    return;
  }

  folder.collapsed = !folder.collapsed;
  saveState();
  renderSidebar();
}

function normalizeFolderName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function requestMoveConversation(conversationId) {
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) {
    return;
  }

  const folderNames = folders.map((folder) => folder.name).join(", ");
  const description = folderNames
    ? `Dossiers disponibles : ${folderNames}. Laisser vide pour remettre dans R\u00e9cents.`
    : "Aucun dossier disponible. Laisser vide pour remettre dans R\u00e9cents.";

  openModal({
    title: "Ranger la conversation",
    description,
    label: "Dossier de destination",
    placeholder: "Ex : Questions finance",
    confirmText: "Ranger",
    input: true,
    onConfirm: (destination) => moveConversationByName(conversationId, destination),
  });
}

function moveConversationByName(conversationId, destination) {
  const cleanDestination = destination.trim();
  const normalizedDestination = normalizeFolderName(cleanDestination);

  if (!cleanDestination || normalizedDestination === "recents") {
    moveConversationToFolder(conversationId, null);
    return { ok: true };
  }

  const folder = folders.find((item) => normalizeFolderName(item.name) === normalizedDestination);
  if (!folder) {
    return { ok: false, error: "Dossier introuvable. V\u00e9rifiez le nom ou laissez vide pour R\u00e9cents." };
  }

  moveConversationToFolder(conversationId, folder.id);
  return { ok: true };
}

function moveConversationToFolder(conversationId, folderId) {
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) {
    return;
  }

  conversation.folderId = folderId;
  conversation.updatedAt = new Date().toISOString();

  if (folderId) {
    const folder = folders.find((item) => item.id === folderId);
    if (folder) {
      folder.collapsed = false;
      sidebarState.foldersCollapsed = false;
    }
  } else {
    sidebarState.recentsCollapsed = false;
  }

  saveState();
  renderSidebar();
}

function clearDropTargets() {
  document.querySelectorAll(".is-drop-target").forEach((target) => {
    target.classList.remove("is-drop-target");
  });
}

function handleDragStart(event) {
  const row = event.target.closest("[data-draggable-conversation-id]");
  if (!row) {
    return;
  }

  draggedConversationId = row.dataset.draggableConversationId;
  row.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedConversationId);
}

function handleDragEnd(event) {
  event.target.closest("[data-draggable-conversation-id]")?.classList.remove("is-dragging");
  draggedConversationId = null;
  clearDropTargets();
}

function handleDropTargetDragOver(event, target = event.currentTarget) {
  if (!draggedConversationId) {
    return;
  }

  event.preventDefault();
  target.classList.add("is-drop-target");
  event.dataTransfer.dropEffect = "move";
}

function handleDropTargetDragLeave(event, target = event.currentTarget) {
  if (!target.contains(event.relatedTarget)) {
    target.classList.remove("is-drop-target");
  }
}

function handleFolderDrop(event, target = event.currentTarget) {
  event.preventDefault();
  const folderId = target.dataset.dropFolderId;
  const conversationId = event.dataTransfer.getData("text/plain") || draggedConversationId;
  moveConversationToFolder(conversationId, folderId);
  clearDropTargets();
}

function handleRecentsDrop(event) {
  event.preventDefault();
  const conversationId = event.dataTransfer.getData("text/plain") || draggedConversationId;
  moveConversationToFolder(conversationId, null);
  clearDropTargets();
}

async function refreshStatus() {
  statusBadge.textContent = "V\u00e9rification...";
  statusBadge.classList.remove("status-connected", "status-disconnected", "status-error");
  statusBadge.classList.add("status-checking");

  try {
    const response = await fetch("/api/status");
    const payload = await response.json();
    setStatus(payload);
  } catch (error) {
    statusBadge.textContent = "Statut indisponible";
    statusBadge.classList.remove("status-checking");
    statusBadge.classList.add("status-error");
  }
}

async function sendMessage(rawMessage) {
  const message = rawMessage.trim();
  const activeConversation = getActiveConversation();

  if (!message || !activeConversation) {
    return;
  }

  const previousMessages = activeConversation.messages.slice();
  const isFirstUserMessage = !activeConversation.messages.some((item) => item.role === "user");
  const now = new Date().toISOString();

  if (isFirstUserMessage) {
    activeConversation.title = truncateTitle(message);
  }

  activeConversation.messages.push({ role: "user", content: message });
  activeConversation.updatedAt = now;
  messageInput.value = "";
  saveState();
  renderSidebar();
  updateWelcomeState();

  addMessageToDom("user", message);
  const thinkingMessage = addMessageToDom("assistant", "L'assistant r\u00e9fl\u00e9chit...");
  setSending(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: previousMessages }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "La requ\u00eate n'a pas pu aboutir.");
    }

    thinkingMessage.querySelector(".message-content").textContent = payload.answer;
    activeConversation.messages.push({ role: "assistant", content: payload.answer });
    activeConversation.updatedAt = new Date().toISOString();
    saveState();
    renderSidebar();
    setStatus(payload);
  } catch (error) {
    const errorMessage = "Erreur : impossible d'obtenir une r\u00e9ponse claire pour le moment.";
    thinkingMessage.querySelector(".message-content").textContent = errorMessage;
    activeConversation.messages.push({ role: "assistant", content: errorMessage });
    activeConversation.updatedAt = new Date().toISOString();
    saveState();
    renderSidebar();
  } finally {
    setSending(false);
    updateWelcomeState();
    messageInput.focus();
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(messageInput.value);
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    sendMessage(button.dataset.suggestion || button.textContent);
  });
});

foldersToggle.addEventListener("click", () => {
  sidebarState.foldersCollapsed = !sidebarState.foldersCollapsed;
  saveState();
  renderSidebar();
});

recentsToggle.addEventListener("click", () => {
  sidebarState.recentsCollapsed = !sidebarState.recentsCollapsed;
  saveState();
  renderSidebar();
});

addFolderButton.addEventListener("click", addFolder);
clearButton.addEventListener("click", clearActiveConversation);
newChatButton.addEventListener("click", () => startNewConversation());

modalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitModal();
});

modalInput.addEventListener("input", () => {
  if (!activeModal) {
    return;
  }

  if (activeModal?.requireInput) {
    modalConfirmButton.disabled = !modalInput.value.trim();
  }
  setModalError("");
});

modalCancelButton.addEventListener("click", closeModal);
modalCloseButton.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modalOverlay.hidden) {
    closeModal();
  }
});

document.addEventListener("dragstart", handleDragStart);
document.addEventListener("dragend", handleDragEnd);

folderList.addEventListener("dragover", (event) => {
  const target = event.target.closest("[data-drop-folder-id]");
  if (target) {
    handleDropTargetDragOver(event, target);
  }
});

folderList.addEventListener("dragleave", (event) => {
  const target = event.target.closest("[data-drop-folder-id]");
  if (target) {
    handleDropTargetDragLeave(event, target);
  }
});

folderList.addEventListener("drop", (event) => {
  const target = event.target.closest("[data-drop-folder-id]");
  if (!target) {
    return;
  }

  handleFolderDrop(event, target);
});

recentConversationList.addEventListener("dragover", handleDropTargetDragOver);
recentConversationList.addEventListener("dragleave", handleDropTargetDragLeave);
recentConversationList.addEventListener("drop", handleRecentsDrop);

folderList.addEventListener("click", (event) => {
  const newConversationButton = event.target.closest("[data-new-conversation-folder-id]");
  if (newConversationButton) {
    startNewConversation(newConversationButton.dataset.newConversationFolderId);
    return;
  }

  const renameButton = event.target.closest("[data-rename-folder-id]");
  if (renameButton) {
    renameFolder(renameButton.dataset.renameFolderId);
    return;
  }

  const deleteFolderButton = event.target.closest("[data-delete-folder-id]");
  if (deleteFolderButton) {
    requestDeleteFolder(deleteFolderButton.dataset.deleteFolderId);
    return;
  }

  const moveButton = event.target.closest("[data-move-conversation-id]");
  if (moveButton) {
    requestMoveConversation(moveButton.dataset.moveConversationId);
    return;
  }

  const deleteConversationButton = event.target.closest("[data-delete-conversation-id]");
  if (deleteConversationButton) {
    requestDeleteConversation(deleteConversationButton.dataset.deleteConversationId);
    return;
  }

  const conversationButton = event.target.closest("[data-conversation-id]");
  if (conversationButton) {
    activeConversationId = conversationButton.dataset.conversationId;
    saveState();
    renderApp();
    messageInput.focus();
    return;
  }

  const folderToggleButton = event.target.closest("[data-folder-toggle-id]");
  if (folderToggleButton) {
    toggleFolder(folderToggleButton.dataset.folderToggleId);
  }
});

recentConversationList.addEventListener("click", (event) => {
  const moveButton = event.target.closest("[data-move-conversation-id]");
  if (moveButton) {
    requestMoveConversation(moveButton.dataset.moveConversationId);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-conversation-id]");
  if (deleteButton) {
    requestDeleteConversation(deleteButton.dataset.deleteConversationId);
    return;
  }

  const conversationButton = event.target.closest("[data-conversation-id]");
  if (!conversationButton) {
    return;
  }

  activeConversationId = conversationButton.dataset.conversationId;
  saveState();
  renderApp();
  messageInput.focus();
});

loadSidebarState();
loadFolders();
loadConversations();
saveState();
renderApp();
refreshStatus();
refreshIcons();
