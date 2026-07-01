const CONVERSATIONS_KEY = "techcorp_conversations";
const ACTIVE_CONVERSATION_KEY = "techcorp_active_conversation_id";
const FOLDERS_KEY = "techcorp_folders";
const SIDEBAR_STATE_KEY = "techcorp_sidebar_state";
const THEME_KEY = "techcorp_theme";
const DEFAULT_TITLE = "Nouvelle conversation";
const MAX_TITLE_LENGTH = 35;
const MAX_MESSAGE_LENGTH = 2000;
const TEXTAREA_MAX_HEIGHT = 160;
const COPY_RESET_DELAY = 1400;

const chatMessages = document.querySelector("#chatMessages");
const chatStage = document.querySelector(".chat-stage");
const chatBottom = document.querySelector("#chat-bottom");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const clearButton = document.querySelector("#clearButton");
const newChatButton = document.querySelector("#newChatButton");
const searchChatsButton = document.querySelector("#searchChatsButton");
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
const themeToggle = document.querySelector("#themeToggle");
const searchOverlay = document.querySelector("#searchOverlay");
const searchInput = document.querySelector("#searchInput");
const searchResults = document.querySelector("#searchResults");
const searchCloseButton = document.querySelector("#searchCloseButton");

let conversations = [];
let folders = [];
let sidebarState = {
  foldersCollapsed: false,
  recentsCollapsed: false,
};
let activeConversationId = null;
let draggedConversationId = null;
let activeModal = null;
let isSending = false;

const ICON_FALLBACKS = {
  "arrow-up": "^",
  "chevron-down": "v",
  "chevron-right": ">",
  check: "ok",
  copy: "C",
  ellipsis: "...",
  folder: "[]",
  "message-square": "-",
  "move-right": ">",
  moon: "o",
  pencil: "E",
  plus: "+",
  search: "?",
  "square-pen": "+",
  sun: "*",
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

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

function updateThemeToggle(theme) {
  if (!themeToggle) {
    return;
  }

  const nextTheme = theme === "light" ? "dark" : "light";
  const iconName = theme === "light" ? "moon" : "sun";
  const label = nextTheme === "light" ? "Basculer en mode clair" : "Basculer en mode sombre";

  themeToggle.innerHTML = "";
  themeToggle.appendChild(createIcon(iconName));
  themeToggle.setAttribute("aria-label", label);
  themeToggle.title = label;
  refreshIcons();
}

function applyTheme(theme, { persist = true } = {}) {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = normalizedTheme;

  if (persist) {
    localStorage.setItem(THEME_KEY, normalizedTheme);
  }

  updateThemeToggle(normalizedTheme);
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderInlineMarkdown(text) {
  const inlineCodeBlocks = [];
  let html = escapeHtml(text);

  html = html.replace(/`([^`]+)`/g, (match, code) => {
    const token = `@@INLINE_CODE_${inlineCodeBlocks.length}@@`;
    inlineCodeBlocks.push(`<code>${code}</code>`);
    return token;
  });

  html = html
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  inlineCodeBlocks.forEach((codeBlock, index) => {
    html = html.replace(`@@INLINE_CODE_${index}@@`, codeBlock);
  });

  return html;
}

function renderMarkdown(content) {
  const codeBlocks = [];
  const tokenizedContent = String(content).replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, (match, code) => {
    const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
    codeBlocks.push(`<pre><code>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`);
    return `\n${token}\n`;
  });

  const parts = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    parts.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    listItems = [];
  };

  tokenizedContent.split(/\r?\n/).forEach((line) => {
    const codeBlockMatch = line.match(/^@@CODE_BLOCK_(\d+)@@$/);
    const bulletMatch = line.match(/^\s*-\s+(.+)/);

    if (codeBlockMatch) {
      flushList();
      parts.push(codeBlocks[Number(codeBlockMatch[1])] || "");
      return;
    }

    if (bulletMatch) {
      listItems.push(renderInlineMarkdown(bulletMatch[1]));
      return;
    }

    flushList();

    if (!line.trim()) {
      parts.push("<br>");
      return;
    }

    parts.push(`${renderInlineMarkdown(line)}<br>`);
  });

  flushList();

  return parts.join("").replace(/(<br>)+$/, "");
}

function resizeMessageInput() {
  messageInput.style.height = "auto";
  const nextHeight = Math.min(messageInput.scrollHeight, TEXTAREA_MAX_HEIGHT);
  messageInput.style.height = `${nextHeight}px`;
  messageInput.style.overflowY = messageInput.scrollHeight > TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
}

function resetMessageInput() {
  messageInput.value = "";
  resizeMessageInput();
}

function resizeEditTextarea(textarea) {
  textarea.style.height = "auto";
  const nextHeight = Math.min(textarea.scrollHeight, TEXTAREA_MAX_HEIGHT);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
}

function scrollToBottom({ smooth = true } = {}) {
  const behavior = smooth ? "smooth" : "auto";

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (chatBottom) {
        chatBottom.scrollIntoView({
          behavior,
          block: "end",
        });
      }

      if (chatStage) {
        chatStage.scrollTo({
          top: chatStage.scrollHeight,
          behavior,
        });
      } else {
        chatMessages.lastElementChild?.scrollIntoView({
          behavior,
          block: "end",
        });
      }

      if (smooth && chatStage) {
        window.setTimeout(() => {
          chatStage.scrollTop = chatStage.scrollHeight;
        }, 260);
      }
    });
  });
}

async function copyPlainText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.top = "-9999px";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();

  const copied = document.execCommand("copy");
  helper.remove();

  if (!copied) {
    throw new Error("La copie a \u00e9chou\u00e9.");
  }
}

function addCopyButton(message, content) {
  const copyButton = document.createElement("button");
  copyButton.className = "copy-message-button";
  copyButton.type = "button";
  copyButton.setAttribute("aria-label", "Copier la r\u00e9ponse de l'assistant");

  const setCopyButtonContent = (iconName, label) => {
    copyButton.innerHTML = "";
    copyButton.appendChild(createIcon(iconName));

    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    copyButton.appendChild(labelElement);
    refreshIcons();
  };

  setCopyButtonContent("copy", "Copier");

  copyButton.addEventListener("click", async () => {
    try {
      await copyPlainText(content);
      copyButton.classList.add("is-copied");
      copyButton.setAttribute("aria-label", "R\u00e9ponse copi\u00e9e");
      setCopyButtonContent("check", "Copi\u00e9");
      window.setTimeout(() => {
        copyButton.classList.remove("is-copied");
        copyButton.setAttribute("aria-label", "Copier la r\u00e9ponse de l'assistant");
        setCopyButtonContent("copy", "Copier");
      }, COPY_RESET_DELAY);
    } catch (error) {
      copyButton.classList.add("is-copied");
      copyButton.setAttribute("aria-label", "Copie indisponible");
      setCopyButtonContent("x", "Erreur");
      window.setTimeout(() => {
        copyButton.classList.remove("is-copied");
        copyButton.setAttribute("aria-label", "Copier la r\u00e9ponse de l'assistant");
        setCopyButtonContent("copy", "Copier");
      }, COPY_RESET_DELAY);
    }
  });

  message.appendChild(copyButton);
  refreshIcons();
}

function addEditButton(message, messageIndex) {
  if (!Number.isInteger(messageIndex)) {
    return;
  }

  const editButton = document.createElement("button");
  editButton.className = "edit-message-button";
  editButton.type = "button";
  editButton.dataset.editMessageIndex = String(messageIndex);
  editButton.setAttribute("aria-label", "Modifier ce message");
  editButton.title = "Modifier";
  editButton.appendChild(createIcon("pencil"));
  message.appendChild(editButton);
  refreshIcons();
}

function cancelMessageEdit() {
  renderMessages();
  messageInput.focus();
}

function showEditError(errorElement, message) {
  errorElement.textContent = message;
  errorElement.hidden = !message;
}

function renderMessageEditor(messageElement, bubble, messageIndex, content) {
  messageElement.classList.add("is-editing");
  messageElement.querySelector(".edit-message-button")?.remove();
  bubble.textContent = "";

  const form = document.createElement("form");
  form.className = "edit-message-form";

  const textarea = document.createElement("textarea");
  textarea.className = "edit-message-input";
  textarea.rows = 1;
  textarea.maxLength = MAX_MESSAGE_LENGTH;
  textarea.value = content;

  const error = document.createElement("p");
  error.className = "edit-message-error";
  error.hidden = true;

  const actions = document.createElement("div");
  actions.className = "edit-message-actions";

  const cancelButton = document.createElement("button");
  cancelButton.className = "edit-message-cancel";
  cancelButton.type = "button";
  cancelButton.textContent = "Annuler";

  const submitButton = document.createElement("button");
  submitButton.className = "edit-message-submit";
  submitButton.type = "submit";
  submitButton.textContent = "Valider";

  actions.append(cancelButton, submitButton);
  form.append(textarea, error, actions);
  bubble.appendChild(form);

  textarea.addEventListener("input", () => {
    resizeEditTextarea(textarea);
    showEditError(error, "");
  });

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelMessageEdit();
    }
  });

  cancelButton.addEventListener("click", cancelMessageEdit);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextMessage = textarea.value.trim();

    if (!nextMessage) {
      showEditError(error, "Le message ne peut pas etre vide.");
      textarea.focus();
      return;
    }

    if (nextMessage.length > MAX_MESSAGE_LENGTH) {
      showEditError(error, `Le message ne doit pas depasser ${MAX_MESSAGE_LENGTH} caracteres.`);
      textarea.focus();
      return;
    }

    submitButton.disabled = true;
    cancelButton.disabled = true;
    editUserMessage(messageIndex, nextMessage);
  });

  requestAnimationFrame(() => {
    textarea.focus();
    textarea.select();
    resizeEditTextarea(textarea);
  });
}

function startEditingMessage(messageIndex) {
  if (isSending) {
    return;
  }

  const activeConversation = getActiveConversation();
  const targetMessage = activeConversation?.messages[messageIndex];

  if (!targetMessage || targetMessage.role !== "user") {
    return;
  }

  const messageElement = chatMessages.querySelector(`[data-message-index="${messageIndex}"]`);
  const bubble = messageElement?.querySelector(".message-content");

  if (!messageElement || !bubble) {
    return;
  }

  const currentEditor = chatMessages.querySelector(".message.is-editing");
  if (currentEditor && currentEditor !== messageElement) {
    renderMessages();
    startEditingMessage(messageIndex);
    return;
  }

  renderMessageEditor(messageElement, bubble, messageIndex, targetMessage.content);
}

function renderThinkingContent(message, bubble) {
  message.classList.add("is-thinking");
  bubble.textContent = "";

  const thinking = document.createElement("span");
  thinking.className = "thinking-content";

  const label = document.createElement("span");
  label.textContent = "L'assistant r\u00e9fl\u00e9chit";

  const dots = document.createElement("span");
  dots.className = "typing-dots";
  dots.setAttribute("aria-hidden", "true");

  for (let index = 0; index < 3; index += 1) {
    dots.appendChild(document.createElement("span"));
  }

  thinking.append(label, dots);
  bubble.appendChild(thinking);
}

function updateAssistantMessage(message, content) {
  const bubble = message.querySelector(".message-content");

  message.classList.remove("is-thinking", "is-streaming");
  message.querySelector(".copy-message-button")?.remove();
  bubble.innerHTML = renderMarkdown(content);
  addCopyButton(message, content);
  scrollToBottom();
}

function updateAssistantStreamingMessage(message, content) {
  const bubble = message.querySelector(".message-content");

  message.classList.remove("is-thinking");
  message.classList.add("is-streaming");
  message.querySelector(".copy-message-button")?.remove();
  bubble.textContent = content;
  scrollToBottom();
}

function addMessageToDom(role, content, options = {}) {
  const message = document.createElement("article");
  message.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "message-content";

  if (Number.isInteger(options.messageIndex)) {
    message.dataset.messageIndex = String(options.messageIndex);
  }

  message.appendChild(bubble);

  if (role === "assistant" && options.thinking) {
    renderThinkingContent(message, bubble);
  } else if (role === "assistant") {
    bubble.innerHTML = renderMarkdown(content);
    addCopyButton(message, content);
  } else {
    bubble.textContent = content;
    addEditButton(message, options.messageIndex);
  }

  chatMessages.appendChild(message);
  if (options.scroll !== false) {
    scrollToBottom({ smooth: options.smooth !== false });
  }

  return message;
}

function renderMessages() {
  const activeConversation = getActiveConversation();
  chatMessages.innerHTML = "";

  activeConversation?.messages.forEach((message, index) => {
    addMessageToDom(message.role, message.content, { messageIndex: index, scroll: false });
  });

  updateWelcomeState();
  scrollToBottom({ smooth: false });
}

function openConversation(conversationId, { focusComposer = true } = {}) {
  if (!conversations.some((conversation) => conversation.id === conversationId)) {
    return;
  }

  activeConversationId = conversationId;
  saveState();
  renderApp();

  if (focusComposer) {
    messageInput.focus();
  }
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function createSearchExcerpt(content, query) {
  const text = String(content || "").replace(/\s+/g, " ").trim();

  if (!text) {
    return "";
  }

  const normalizedText = normalizeSearchText(text);
  const normalizedQuery = normalizeSearchText(query);
  const matchIndex = normalizedText.indexOf(normalizedQuery);
  const start = matchIndex > 28 ? matchIndex - 28 : 0;
  const end = Math.min(text.length, start + 118);
  const prefix = start > 0 ? "... " : "";
  const suffix = end < text.length ? " ..." : "";

  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function findSearchResults(query) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const results = [];

  conversations.forEach((conversation) => {
    const title = conversation.title || DEFAULT_TITLE;

    if (normalizeSearchText(title).includes(normalizedQuery)) {
      results.push({
        conversationId: conversation.id,
        title,
        excerpt: "Titre de conversation",
      });
    }

    conversation.messages.some((message) => {
      if (!normalizeSearchText(message.content).includes(normalizedQuery)) {
        return false;
      }

      results.push({
        conversationId: conversation.id,
        title,
        excerpt: createSearchExcerpt(message.content, query),
      });

      return results.length >= 30;
    });
  });

  return results.slice(0, 30);
}

function renderSearchResults() {
  const query = searchInput.value.trim();
  searchResults.innerHTML = "";

  if (!query) {
    const empty = document.createElement("div");
    empty.className = "search-empty";
    empty.textContent = "Recherchez une conversation ou un message...";
    searchResults.appendChild(empty);
    return;
  }

  const results = findSearchResults(query);

  if (results.length === 0) {
    const empty = document.createElement("div");
    empty.className = "search-empty";
    empty.textContent = "Aucun r\u00e9sultat";
    searchResults.appendChild(empty);
    return;
  }

  results.forEach((result, index) => {
    const button = document.createElement("button");
    button.className = "search-result";
    button.type = "button";
    button.dataset.searchConversationId = result.conversationId;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", index === 0 ? "true" : "false");

    const body = document.createElement("span");
    body.className = "search-result-body";

    const title = document.createElement("span");
    title.className = "search-result-title";
    title.textContent = result.title || DEFAULT_TITLE;

    const excerpt = document.createElement("span");
    excerpt.className = "search-result-excerpt";
    excerpt.textContent = result.excerpt || "Conversation";

    body.append(title, excerpt);
    button.append(createIcon("message-square"), body);
    searchResults.appendChild(button);
  });

  refreshIcons();
}

function openSearchModal() {
  searchOverlay.hidden = false;
  searchInput.value = "";
  renderSearchResults();
  refreshIcons();

  requestAnimationFrame(() => {
    searchInput.focus();
  });
}

function closeSearchModal() {
  searchOverlay.hidden = true;
  searchInput.value = "";
  searchResults.innerHTML = "";
}

function openSearchResult(conversationId) {
  closeSearchModal();
  openConversation(conversationId);
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

function setSending(sending) {
  isSending = sending;
  sendButton.disabled = sending;
  clearButton.disabled = sending;
  newChatButton.disabled = sending;
  searchChatsButton.disabled = sending;
  addFolderButton.disabled = sending;
  foldersToggle.disabled = sending;
  recentsToggle.disabled = sending;
  folderList.querySelectorAll("button").forEach((button) => {
    button.disabled = sending;
  });
  recentConversationList.querySelectorAll("button").forEach((button) => {
    button.disabled = sending;
  });
  chatMessages.querySelectorAll(".edit-message-button").forEach((button) => {
    button.disabled = sending;
  });
  suggestionButtons.forEach((button) => {
    button.disabled = sending;
  });
  messageInput.disabled = sending;
  sendButton.classList.toggle("is-sending", sending);
  sendButton.setAttribute("aria-label", sending ? "Envoi en cours" : "Envoyer");
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
  resetMessageInput();
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
  resetMessageInput();
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

async function requestAssistantStream(message, previousMessages, thinkingMessage) {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: previousMessages }),
  });

  if (!response.ok) {
    throw new Error("Le stream n'a pas pu aboutir.");
  }

  if (!response.body?.getReader) {
    throw new Error("Le streaming n'est pas supporte par ce navigateur.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const provider = response.headers.get("X-TechCorp-Provider") || "mock";
  let answer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      answer += decoder.decode();
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    if (chunk) {
      answer += chunk;
      updateAssistantStreamingMessage(thinkingMessage, answer);
    }
  }

  if (!answer.trim()) {
    throw new Error("Le stream est vide.");
  }

  return {
    answer,
    provider,
    connected: provider !== "mock",
  };
}

async function requestAssistantClassic(message, previousMessages) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: previousMessages }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "La requ\u00eate n'a pas pu aboutir.");
  }

  return payload;
}

async function requestAssistantResponse(activeConversation, message, previousMessages) {
  const thinkingMessage = addMessageToDom("assistant", "L'assistant r\u00e9fl\u00e9chit...", { thinking: true });
  setSending(true);

  try {
    let payload;
    try {
      payload = await requestAssistantStream(message, previousMessages, thinkingMessage);
    } catch (streamError) {
      payload = await requestAssistantClassic(message, previousMessages);
    }

    updateAssistantMessage(thinkingMessage, payload.answer);
    activeConversation.messages.push({ role: "assistant", content: payload.answer });
    activeConversation.updatedAt = new Date().toISOString();
    saveState();
    renderSidebar();
    setStatus(payload);
  } catch (error) {
    const errorMessage = "Erreur : impossible d'obtenir une r\u00e9ponse claire pour le moment. V\u00e9rifiez le serveur Ollama ou relancez en mode test.";
    updateAssistantMessage(thinkingMessage, errorMessage);
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

async function sendMessage(rawMessage) {
  const message = rawMessage.trim();
  const activeConversation = getActiveConversation();

  if (!message || !activeConversation || isSending) {
    return;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
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
  resetMessageInput();
  saveState();
  renderSidebar();
  updateWelcomeState();

  addMessageToDom("user", message, { messageIndex: activeConversation.messages.length - 1 });
  await requestAssistantResponse(activeConversation, message, previousMessages);
}

async function editUserMessage(messageIndex, nextMessage) {
  const activeConversation = getActiveConversation();
  const targetMessage = activeConversation?.messages[messageIndex];

  if (!activeConversation || !targetMessage || targetMessage.role !== "user" || isSending) {
    return;
  }

  const message = nextMessage.trim();

  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return;
  }

  if (message === targetMessage.content) {
    renderMessages();
    messageInput.focus();
    return;
  }

  const previousMessages = activeConversation.messages.slice(0, messageIndex);
  const isFirstUserMessage = activeConversation.messages.findIndex((item) => item.role === "user") === messageIndex;

  activeConversation.messages = [
    ...previousMessages,
    { role: "user", content: message },
  ];
  activeConversation.updatedAt = new Date().toISOString();

  if (isFirstUserMessage) {
    activeConversation.title = truncateTitle(message);
  }

  saveState();
  renderApp();
  await requestAssistantResponse(activeConversation, message, previousMessages);
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(messageInput.value);
});

messageInput.addEventListener("input", resizeMessageInput);

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (!isSending) {
      chatForm.requestSubmit();
    }
  }
});

chatMessages.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-message-index]");

  if (!editButton) {
    return;
  }

  startEditingMessage(Number(editButton.dataset.editMessageIndex));
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
searchChatsButton.addEventListener("click", openSearchModal);
themeToggle?.addEventListener("click", () => {
  const currentTheme = document.body.dataset.theme === "light" ? "light" : "dark";
  applyTheme(currentTheme === "light" ? "dark" : "light");
});

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

searchCloseButton.addEventListener("click", closeSearchModal);
searchOverlay.addEventListener("click", (event) => {
  if (event.target === searchOverlay) {
    closeSearchModal();
  }
});
searchInput.addEventListener("input", renderSearchResults);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const firstResult = searchResults.querySelector("[data-search-conversation-id]");

    if (firstResult) {
      event.preventDefault();
      openSearchResult(firstResult.dataset.searchConversationId);
    }
  }
});
searchResults.addEventListener("click", (event) => {
  const resultButton = event.target.closest("[data-search-conversation-id]");

  if (!resultButton) {
    return;
  }

  openSearchResult(resultButton.dataset.searchConversationId);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !searchOverlay.hidden) {
    closeSearchModal();
    return;
  }

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
    openConversation(conversationButton.dataset.conversationId);
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

  openConversation(conversationButton.dataset.conversationId);
});

applyTheme(getStoredTheme(), { persist: false });
loadSidebarState();
loadFolders();
loadConversations();
saveState();
renderApp();
resizeMessageInput();
refreshStatus();
refreshIcons();
