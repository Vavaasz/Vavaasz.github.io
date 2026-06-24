const blankRecord = () => ({
  id: '',
  client: {
    name: '',
    servicePort: '',
    webPort: '',
    username: '',
    password: '',
    activeCameras: '',
    totalCameras: '',
    dvrModel: ''
  },
  access: {
    primaryIpEnabled: true,
    primaryIp: '',
    automaticRegistrationEnabled: false,
    automaticRegistrationId: '',
    ddnsEnabled: false,
    ddnsDomain: '',
    alternativeIpEnabled: false,
    alternativeIp: '',
    cloudIdEnabled: false,
    cloudId: ''
  },
  updatedAt: null
});
const THEME_KEY = 'tka_theme';
const PORTAL_PERSIST_DATA_KEY = 'portal_gate_user_persist';
const PORTAL_MONITORING_EMAIL = 'monitoramento@grupotka.com.br';
const SENSITIVE_CLIENT_FIELDS = new Set(['username', 'password']);
const REDACTED_SENSITIVE_VALUE = '[redacted]';

const state = {
  portalUser: null,
  operator: { name: '', email: '' },
  records: [],
  currentId: '',
  logs: []
};
const PORTAL_SESSION_DATA_KEY = 'portal_gate_user';

const el = {
  identityModal: document.getElementById('identityModal'),
  identityForm: document.getElementById('identityForm'),
  homeLink: document.getElementById('homeLink'),
  operatorName: document.getElementById('operatorName'),
  operatorEmail: document.getElementById('operatorEmail'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  operatorChip: document.getElementById('operatorChip'),
  saveStatus: document.getElementById('saveStatus'),
  newRecordBtn: document.getElementById('newRecordBtn'),
  deleteRecordBtn: document.getElementById('deleteRecordBtn'),
  archiveRecordBtn: document.getElementById('archiveRecordBtn'),
  undoRecordBtn: document.getElementById('undoRecordBtn'),
  savePdfBtn: document.getElementById('savePdfBtn'),
  recordList: document.getElementById('recordList'),
  archivedRecordList: document.getElementById('archivedRecordList'),
  logList: document.getElementById('logList')
};
let sidebarTab = 'ativos';

const app = firebase.initializeApp(window.RH_FIREBASE_CONFIG);
const db = firebase.firestore(app);
const params = new URLSearchParams(window.location.search);
const shouldStartNewRecord = params.get('new') === '1';
let saveTimer = null;
let logsUnsubscribe = null;
let lastSavedFingerprint = '';
const clientInputDefaults = new Map();

function applyTheme(theme) {
  document.body.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  el.themeToggleBtn.textContent = theme === 'dark' ? 'Tema claro' : 'Tema escuro';
  localStorage.setItem(THEME_KEY, document.body.dataset.theme);
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function snapshotRecord(record) {
  return {
    client: cloneValue(record?.client || blankRecord().client),
    access: cloneValue(record?.access || blankRecord().access)
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function redactSensitiveClientFields(client) {
  const redacted = cloneValue(client || blankRecord().client);
  SENSITIVE_CLIENT_FIELDS.forEach((key) => {
    if (redacted[key]) redacted[key] = REDACTED_SENSITIVE_VALUE;
  });
  return redacted;
}

function auditSnapshotRecord(record) {
  const snapshot = snapshotRecord(record);
  snapshot.client = redactSensitiveClientFields(snapshot.client);
  return snapshot;
}

function restoreClientFromAuditSnapshot(snapshotClient, currentClient) {
  const restored = cloneValue(snapshotClient || blankRecord().client);
  SENSITIVE_CLIENT_FIELDS.forEach((key) => {
    if (restored[key] === REDACTED_SENSITIVE_VALUE) {
      restored[key] = currentClient?.[key] || '';
    }
  });
  return restored;
}

function isMonitoringOperator() {
  return state.portalUser?.email === PORTAL_MONITORING_EMAIL;
}

function hasAdminAccess() {
  return Boolean(state.portalUser?.permissions?.admin);
}

function canDeleteRecords() {
  return hasAdminAccess() || Boolean(state.portalUser?.permissions?.testingMode);
}

function canUndoRecentChanges() {
  return hasAdminAccess() || Boolean(state.portalUser?.permissions?.canUndo || state.portalUser?.permissions?.testingMode);
}

function canViewSensitiveCredentials() {
  return hasAdminAccess();
}

function canCreateSensitiveCredentials() {
  return canViewSensitiveCredentials() || isMonitoringOperator();
}

function shouldHideRecordLogs() {
  return Boolean(state.portalUser?.permissions?.skipAuditLogs);
}

function isStoredSensitiveFieldLocked(record, key) {
  return !canViewSensitiveCredentials() && Boolean(record?.id && record?.client?.[key]);
}

function defaultClientPlaceholder(key) {
  return clientInputDefaults.get(key) || '';
}

function updateSensitiveFieldState(input, record) {
  const key = input.dataset.client;
  if (!SENSITIVE_CLIENT_FIELDS.has(key)) return;

  const locked = isStoredSensitiveFieldLocked(record, key);
  const denied = !locked && !canCreateSensitiveCredentials();

  input.classList.toggle('masked-field', locked);
  input.readOnly = locked;
  input.disabled = denied;

  if (locked) {
    input.value = '';
    input.placeholder = 'Oculto para este usuario';
    input.title = 'Somente gerenciamento e adminteste podem visualizar ou editar este campo.';
    return;
  }

  input.placeholder = defaultClientPlaceholder(key);
  input.title = denied ? 'Somente monitoramento, gerenciamento e adminteste podem preencher este campo.' : '';
}

function currentRecord() {
  return state.records.find((item) => item.id === state.currentId) || null;
}

function currentOrBlank() {
  return currentRecord() || blankRecord();
}

function renderRecordList() {
  el.recordList.innerHTML = '';
  el.archivedRecordList.innerHTML = '';

  const active = state.records.filter(r => !r.archived);
  const archived = state.records.filter(r => !!r.archived);

  if (!active.length) {
    el.recordList.innerHTML = '<div class="record-item">Nenhum cadastro ativo.</div>';
  } else {
    [...active]
      .sort((a, b) => (a.client.name || '').localeCompare(b.client.name || '', 'pt-BR'))
      .forEach((item) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = `record-item${item.id === state.currentId ? ' active' : ''}`;
        row.innerHTML = `<strong>${escapeHtml(item.client.name || 'Sem nome')}</strong><div class="muted">${escapeHtml(item.client.dvrModel || 'Sem modelo DVR')}</div>`;
        row.onclick = () => {
          state.currentId = item.id;
          renderAll();
          watchLogs();
        };
        el.recordList.appendChild(row);
      });
  }

  if (!archived.length) {
    el.archivedRecordList.innerHTML = '<div class="record-item">Nenhum cadastro arquivado.</div>';
  } else {
    [...archived]
      .sort((a, b) => (a.client.name || '').localeCompare(b.client.name || '', 'pt-BR'))
      .forEach((item) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = `record-item archived-item${item.id === state.currentId ? ' active' : ''}`;
        row.innerHTML = `<strong>${escapeHtml(item.client.name || 'Sem nome')}</strong><div class="muted">${escapeHtml(item.client.dvrModel || 'Arquivado')}</div>`;
        row.onclick = () => {
          state.currentId = item.id;
          renderAll();
          watchLogs();
        };
        el.archivedRecordList.appendChild(row);
      });
  }
}

function fillForm() {
  const record = currentOrBlank();
  document.querySelectorAll('[data-client]').forEach((input) => {
    const key = input.dataset.client;
    if (SENSITIVE_CLIENT_FIELDS.has(key)) {
      updateSensitiveFieldState(input, record);
      if (!isStoredSensitiveFieldLocked(record, key)) {
        input.value = record.client[key] || '';
      }
      return;
    }
    input.value = record.client[key] || '';
  });
  document.querySelectorAll('[data-access]').forEach((input) => {
    input.value = record.access[input.dataset.access] || '';
  });
  document.querySelectorAll('[data-toggle]').forEach((input) => {
    input.checked = !!record.access[input.dataset.toggle];
  });
  applyToggleState();
}

function readForm() {
  const record = currentOrBlank();
  const next = cloneValue(record);
  document.querySelectorAll('[data-client]').forEach((input) => {
    if (SENSITIVE_CLIENT_FIELDS.has(input.dataset.client) && (input.readOnly || input.disabled)) {
      return;
    }
    next.client[input.dataset.client] = input.value.trim();
  });
  document.querySelectorAll('[data-toggle]').forEach((input) => {
    next.access[input.dataset.toggle] = input.checked;
  });
  document.querySelectorAll('[data-access]').forEach((input) => {
    const enabled = next.access[input.dataset.toggleTarget];
    next.access[input.dataset.access] = enabled ? input.value.trim() : '';
  });
  return next;
}

function applyToggleState() {
  document.querySelectorAll('[data-access]').forEach((input) => {
    const toggle = document.querySelector(`[data-toggle="${input.dataset.toggleTarget}"]`);
    const enabled = Boolean(toggle?.checked);
    input.disabled = !enabled;
    input.closest('.toggle-card').classList.toggle('disabled', !enabled);
  });
}

function renderLogs() {
  const visibleLogs = state.logs.filter((item) => !item.hidden);
  el.logList.innerHTML = '';
  if (!visibleLogs.length) {
    el.logList.innerHTML = '<div class="log-item">Nenhum log para este cadastro.</div>';
    return;
  }
  visibleLogs.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'log-item';
    row.innerHTML = `<strong>${escapeHtml(item.operatorName || 'Sem nome')}</strong><div class="muted">${escapeHtml(item.operatorEmail || '')}</div><div>${escapeHtml(item.summary || '')}</div>`;
    el.logList.appendChild(row);
  });
}

function updateActionButtons() {
  const hasSavedRecord = Boolean(state.currentId);
  const currentRec = currentRecord();
  const isArchived = !!currentRec?.archived;
  el.deleteRecordBtn.hidden = !canDeleteRecords();
  el.undoRecordBtn.hidden = !canUndoRecentChanges();
  el.archiveRecordBtn.hidden = !canDeleteRecords();
  el.deleteRecordBtn.disabled = !hasSavedRecord;
  el.undoRecordBtn.disabled = !hasSavedRecord;
  el.archiveRecordBtn.disabled = !hasSavedRecord;
  el.archiveRecordBtn.textContent = isArchived ? 'Reativar' : 'Arquivar';
}

function renderAll() {
  fillForm();
  renderRecordList();
  renderLogs();
  el.operatorChip.textContent = state.operator.name ? `${state.operator.name} (${state.operator.email})` : '';
  updateActionButtons();
}

function fingerprintRecord(record) {
  return JSON.stringify({
    client: record.client,
    access: record.access
  });
}

async function saveRecord() {
  if (!state.operator.name || !state.operator.email) return;
  const record = readForm();
  if (!record.client.name) {
    el.saveStatus.textContent = 'Informe o nome do cliente.';
    return;
  }
  const nextFingerprint = fingerprintRecord(record);
  if (nextFingerprint === lastSavedFingerprint) {
    el.saveStatus.textContent = 'Sem alteracoes pendentes.';
    return;
  }
  const docRef = record.id
    ? db.collection('image_clients').doc(record.id)
    : db.collection('image_clients').doc();
  record.id = docRef.id;
  record.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  const previous = state.records.find((item) => item.id === record.id);
  const changedFields = [];
  ['name', 'servicePort', 'webPort', 'username', 'password', 'activeCameras', 'totalCameras', 'dvrModel'].forEach((key) => {
    if ((previous?.client?.[key] || '') !== (record.client[key] || '')) changedFields.push(key);
  });
  ['primaryIp', 'automaticRegistrationId', 'ddnsDomain', 'alternativeIp', 'cloudId'].forEach((key) => {
    if ((previous?.access?.[key] || '') !== (record.access[key] || '')) changedFields.push(key);
  });
  if (!changedFields.length && previous) {
    lastSavedFingerprint = nextFingerprint;
    el.saveStatus.textContent = 'Sem alteracoes pendentes.';
    return;
  }
  const batch = db.batch();
  batch.set(docRef, record, { merge: true });
  batch.set(db.collection('image_client_logs').doc(), {
    recordId: record.id,
    operatorName: state.operator.name,
    operatorEmail: state.operator.email,
    summary: changedFields.length ? `Atualizou: ${changedFields.join(', ')}` : 'Salvou cadastro',
    action: 'save',
    hidden: shouldHideRecordLogs(),
    previousSnapshot: previous ? auditSnapshotRecord(previous) : null,
    nextSnapshot: auditSnapshotRecord(record),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await batch.commit();
  state.currentId = record.id;
  lastSavedFingerprint = nextFingerprint;
  el.saveStatus.textContent = `Salvo em ${new Date().toLocaleTimeString('pt-BR')}`;
}

function queueSave() {
  clearTimeout(saveTimer);
  el.saveStatus.textContent = 'Salvando...';
  saveTimer = setTimeout(() => { saveRecord().catch(() => { el.saveStatus.textContent = 'Falha ao salvar'; }); }, 900);
}

function watchRecords() {
  db.collection('image_clients').onSnapshot((snapshot) => {
    state.records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (!state.currentId && state.records.length && !shouldStartNewRecord) state.currentId = state.records[0].id;
    if (state.currentId && !state.records.some((item) => item.id === state.currentId)) {
      state.currentId = state.records[0]?.id || '';
    }
    lastSavedFingerprint = fingerprintRecord(currentOrBlank());
    renderAll();
    watchLogs();
  });
}

function watchLogs() {
  if (logsUnsubscribe) logsUnsubscribe();
  if (!state.currentId) {
    state.logs = [];
    renderLogs();
    return;
  }
  logsUnsubscribe = db.collection('image_client_logs')
    .where('recordId', '==', state.currentId)
    .onSnapshot((snapshot) => {
      state.logs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const av = a.createdAt?.seconds || 0;
          const bv = b.createdAt?.seconds || 0;
          return bv - av;
        })
        .slice(0, 50);
      renderLogs();
    });
}

async function deleteCurrentRecord() {
  const record = currentRecord();
  if (!record?.id || !canDeleteRecords()) return;
  const confirmed = window.confirm(`Excluir o cadastro de "${record.client.name || 'Sem nome'}"?`);
  if (!confirmed) return;

  const batch = db.batch();
  batch.delete(db.collection('image_clients').doc(record.id));
  batch.set(db.collection('image_client_logs').doc(), {
    recordId: record.id,
    operatorName: state.operator.name,
    operatorEmail: state.operator.email,
    summary: 'Excluiu o cadastro',
    action: 'delete',
    hidden: shouldHideRecordLogs(),
    previousSnapshot: auditSnapshotRecord(record),
    nextSnapshot: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await batch.commit();
  state.currentId = '';
  state.logs = [];
  updateActionButtons();
  el.saveStatus.textContent = 'Cadastro excluido.';
}

async function archiveCurrentRecord() {
  const record = currentRecord();
  if (!record?.id || !canDeleteRecords()) return;
  const isArchived = !!record.archived;
  const label = isArchived ? 'Reativar' : 'arquivar';
  const confirmed = window.confirm(`${isArchived ? 'Reativar' : 'Arquivar'} o cadastro de "${record.client.name || 'Sem nome'}"?`);
  if (!confirmed) return;

  const batch = db.batch();
  batch.set(db.collection('image_clients').doc(record.id), {
    archived: !isArchived,
    archivedAt: !isArchived ? new Date().toISOString() : null,
    archivedBy: !isArchived ? (state.operator.email || '') : null
  }, { merge: true });
  batch.set(db.collection('image_client_logs').doc(), {
    recordId: record.id,
    operatorName: state.operator.name,
    operatorEmail: state.operator.email,
    summary: isArchived ? 'Reativou o cadastro' : 'Arquivou o cadastro',
    action: isArchived ? 'restore' : 'archive',
    hidden: shouldHideRecordLogs(),
    previousSnapshot: auditSnapshotRecord(record),
    nextSnapshot: auditSnapshotRecord(record),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await batch.commit();
  el.saveStatus.textContent = isArchived ? 'Cadastro reativado.' : 'Cadastro arquivado.';
}

async function undoRecentChange() {
  const record = currentRecord();
  if (!record?.id || !canUndoRecentChanges()) return;

  const currentFingerprint = fingerprintRecord(record);
  const currentAuditFingerprint = JSON.stringify(auditSnapshotRecord(record));
  const snapshot = await db.collection('image_client_logs')
    .where('recordId', '==', record.id)
    .get();

  const history = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const target = history.find((item) => {
    if (item.action === 'delete') return false;
    if (!item.previousSnapshot || !item.nextSnapshot) return false;
    const nextFingerprint = JSON.stringify(item.nextSnapshot);
    return nextFingerprint === currentFingerprint || nextFingerprint === currentAuditFingerprint;
  });

  if (!target) {
    el.saveStatus.textContent = 'Nenhuma alteracao recente disponivel para desfazer.';
    return;
  }

  const restored = {
    ...record,
    ...snapshotRecord(record),
    client: restoreClientFromAuditSnapshot(target.previousSnapshot.client, record.client),
    access: cloneValue(target.previousSnapshot.access || blankRecord().access),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const batch = db.batch();
  batch.set(db.collection('image_clients').doc(record.id), restored, { merge: true });
  batch.set(db.collection('image_client_logs').doc(), {
    recordId: record.id,
    operatorName: state.operator.name,
    operatorEmail: state.operator.email,
    summary: `Desfez a alteracao: ${target.summary || 'alteracao recente'}`,
    action: 'undo',
    hidden: shouldHideRecordLogs(),
    previousSnapshot: auditSnapshotRecord(record),
    nextSnapshot: auditSnapshotRecord(restored),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await batch.commit();
  el.saveStatus.textContent = 'Alteracao desfeita.';
}

function newRecord() {
  state.currentId = '';
  document.querySelectorAll('[data-client], [data-access]').forEach((input) => { input.value = ''; });
  document.querySelectorAll('[data-toggle]').forEach((input) => {
    input.checked = input.dataset.toggle === 'primaryIpEnabled';
  });
  document.querySelectorAll('[data-client]').forEach((input) => {
    if (SENSITIVE_CLIENT_FIELDS.has(input.dataset.client)) {
      updateSensitiveFieldState(input, blankRecord());
    }
  });
  applyToggleState();
  lastSavedFingerprint = fingerprintRecord(blankRecord());
  state.logs = [];
  renderLogs();
  updateActionButtons();
  el.saveStatus.textContent = 'Novo cadastro pronto.';
}

function exportPdf() {
  const record = readForm();
  if (!record.client.name) {
    el.saveStatus.textContent = 'Informe o nome do cliente.';
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 16;
  doc.setFontSize(16);
  doc.text('Cadastro de Cameras e DVRs', 14, y);
  y += 10;
  doc.setFontSize(10);
  [
    ['Nome', record.client.name],
    ['Modelo DVR', record.client.dvrModel],
    ['Porta de Servico', record.client.servicePort],
    ['Porta Web', record.client.webPort],
    ['Usuario', 'Oculto'],
    ['Senha', 'Oculto'],
    ['Cameras Ativas', String(record.client.activeCameras || '')],
    ['Cameras Totais', String(record.client.totalCameras || '')],
    ['IP Principal', record.access.primaryIpEnabled ? record.access.primaryIp : 'Nao informado'],
    ['ID Registro Automatico', record.access.automaticRegistrationEnabled ? record.access.automaticRegistrationId : 'Nao informado'],
    ['Dominio DDNS', record.access.ddnsEnabled ? record.access.ddnsDomain : 'Nao informado'],
    ['IP Alternativo', record.access.alternativeIpEnabled ? record.access.alternativeIp : 'Nao informado'],
    ['ID Cloud', record.access.cloudIdEnabled ? record.access.cloudId : 'Nao informado']
  ].forEach(([label, value]) => {
    doc.text(`${label}: ${value || ''}`, 14, y);
    y += 8;
  });
  y += 6;
  doc.text('Logs recentes:', 14, y);
  y += 8;
  state.logs.slice(0, 8).forEach((item) => {
    doc.text(`- ${item.operatorName || ''} | ${item.summary || ''}`, 14, y);
    y += 8;
  });
  doc.save(`cadastro-imagens-${record.client.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

function readPortalUser() {
  try {
    const raw = sessionStorage.getItem(PORTAL_SESSION_DATA_KEY) || localStorage.getItem(PORTAL_PERSIST_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function formatPortalName(email) {
  return (email || '')
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

el.identityForm.onsubmit = (event) => {
  event.preventDefault();
  state.operator.name = el.operatorName.value.trim();
  state.operator.email = el.operatorEmail.value.trim().toLowerCase();
  sessionStorage.setItem('img_operator_name', state.operator.name);
  sessionStorage.setItem('img_operator_email', state.operator.email);
  el.identityModal.classList.add('hidden');
  renderAll();
};

el.newRecordBtn.onclick = newRecord;
el.deleteRecordBtn.onclick = () => {
  deleteCurrentRecord().catch(() => {
    el.saveStatus.textContent = 'Falha ao excluir';
  });
};
el.archiveRecordBtn.onclick = () => {
  archiveCurrentRecord().catch(() => {
    el.saveStatus.textContent = 'Falha ao arquivar';
  });
};
el.undoRecordBtn.onclick = () => {
  undoRecentChange().catch(() => {
    el.saveStatus.textContent = 'Falha ao desfazer';
  });
};
el.savePdfBtn.onclick = exportPdf;

document.querySelectorAll('[data-sidebar-tab]').forEach((btn) => {
  btn.onclick = () => {
    sidebarTab = btn.dataset.sidebarTab;
    document.querySelectorAll('[data-sidebar-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.sidebarTab === sidebarTab);
    });
    el.recordList.hidden = sidebarTab !== 'ativos';
    el.archivedRecordList.hidden = sidebarTab !== 'arquivados';
  };
});

document.querySelectorAll('[data-client]').forEach((input) => {
  clientInputDefaults.set(input.dataset.client, input.getAttribute('placeholder') || '');
});

document.querySelectorAll('[data-client], [data-access]').forEach((input) => {
  input.oninput = queueSave;
  input.onchange = queueSave;
});
document.querySelectorAll('[data-toggle]').forEach((input) => {
  input.onchange = () => {
    applyToggleState();
    queueSave();
  };
});

const savedName = sessionStorage.getItem('img_operator_name') || '';
const savedEmail = sessionStorage.getItem('img_operator_email') || '';
applyTheme(localStorage.getItem(THEME_KEY) || 'light');
el.themeToggleBtn.onclick = () => {
  applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark');
};
el.homeLink.onclick = event => {
  event.preventDefault();
  window.location.assign(`${window.location.origin}/?tab=systems`);
};
const portalUser = readPortalUser();
state.portalUser = portalUser;
if (portalUser && (portalUser.permissions?.monitoramento || portalUser.permissions?.admin)) {
  state.operator.name = savedName || formatPortalName(portalUser.email);
  state.operator.email = savedEmail || portalUser.email;
  sessionStorage.setItem('img_operator_name', state.operator.name);
  sessionStorage.setItem('img_operator_email', state.operator.email);
  el.identityModal.classList.add('hidden');
} else if (savedName && savedEmail) {
  state.operator.name = savedName;
  state.operator.email = savedEmail;
  el.identityModal.classList.add('hidden');
}

watchRecords();
watchLogs();
