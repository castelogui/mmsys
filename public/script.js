// Configurações da API
const API_BASE_URL = window.location.origin;

// Estado da aplicação
let currentUser = null;
let currentSection = 'dashboard';
let editingId = null;
let revenueChartInstance = null;
let instrumentsChartInstance = null;

// Elementos da DOM
const loginContainer = document.getElementById('loginContainer');
const mainSystem = document.getElementById('mainSystem');
const sectionTitle = document.getElementById('sectionTitle');
const contentArea = document.getElementById('contentArea');
const addButton = document.getElementById('addButton');
const searchInput = document.getElementById('searchInput');

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', async function () {
  const loader = document.getElementById('loader');
  const loginContainer = document.getElementById('loginContainer');
  const mainSystem = document.getElementById('mainSystem');

  // Mostra o loader
  loader.style.display = 'flex';
  loginContainer.style.display = 'none';
  mainSystem.style.display = 'none';

  // Verificar se há um token salvo
  const token = localStorage.getItem('authToken');
  const apiConnected = await testAPIConnection();

  // Simule um pequeno delay para UX (opcional)
  //await new Promise(resolve => setTimeout(resolve, 600));

  // Esconde o loader e mostra a tela correta
  loader.style.display = 'none';
  if (token && apiConnected) {
    mainSystem.style.display = 'flex';
    // Verificar se o token é válido
    validateToken(token);
  } else {
    loginContainer.style.display = 'flex';
    //showLogin();
  }

  // Verificar tema salvo
  verifyTheme()
  // Configurar eventos
  setupEventListeners();
  showToast(`Sistema carregado`, 'success');
});

// ==================== SISTEMA DE TOAST ====================

function initToastSystem() {
  // Criar container de toasts se não existir
  if (!document.getElementById('toast-container')) {
    const toastContainer = document.createElement('div');

    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
    document.body.appendChild(toastContainer);
  }
}

/**
 * Mostra um toast message
 * @param {string} message - Mensagem a ser exibida
 * @param {string} type - Tipo do toast (success, error, warning, info)
 * @param {number} duration - Duração em milissegundos (padrão: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
  const toastContainer = document.getElementById('toast-container');
  const toast = document.createElement('div');

  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        </div>
    `;

  // Estilos do toast
  toast.style.cssText = `
        background: ${getToastColor(type)};
        color: white;
        padding: 12px 16px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        transition: opacity 0.3s ease;
        transform: translateX(0);
        max-width: 350px;
    `;

  // Estilos do conteúdo
  toast.querySelector('.toast-content').style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;

  // Estilos da mensagem
  toast.querySelector('.toast-message').style.cssText = `
        flex: 1;
        margin-right: 10px;
    `;

  // Estilos do botão fechar
  toast.querySelector('.toast-close').style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

  // Adicionar evento para fechar
  toast.querySelector('.toast-close').addEventListener('click', () => {
    removeToast(toast);
  });

  toastContainer.appendChild(toast);

  // Remover automaticamente após a duração
  if (duration > 0) {
    setTimeout(() => {
      removeToast(toast);
    }, duration);
  }

  return toast;
}

// Função para alternar entre temas
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// Verificar tema salvo ao carregar a página
function verifyTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  // Adicionar botão de toggle de tema
  const themeToggleBtn = document.createElement('button');
  themeToggleBtn.className = 'theme-toggle';
  themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
  themeToggleBtn.addEventListener('click', toggleTheme);
  
  // Adicionar ao header
  const headerActions = document.querySelector('.header-actions');
  if (headerActions) {
    headerActions.appendChild(themeToggleBtn);
  }
  
  // Atualizar ícone conforme o tema
  function updateThemeIcon() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    themeToggleBtn.innerHTML = currentTheme === 'dark' 
      ? '<i class="fas fa-sun"></i>' 
      : '<i class="fas fa-moon"></i>';
  }
  
  // Observar mudanças no tema
  const observer = new MutationObserver(updateThemeIcon);
  observer.observe(document.documentElement, { 
    attributes: true, 
    attributeFilter: ['data-theme'] 
  });
};

function getToastColor(type) {
  const colors = {
    success: '#4caf50',
    error: '#f44336',
    warning: '#ff9800',
    info: '#2196f3'
  };
  return colors[type] || colors.info;
}

function removeToast(toast) {
  toast.style.animation = 'slideOut 0.3s ease';
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

// Adicionar animações CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ==================== FUNÇÕES GENÉRICAS DA API ====================

/**
 * Testa a conexão com a API
 */
async function testAPIConnection() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/alunos`);
    if (!response.ok) {
      throw new Error(`API não está respondendo: ${response.status}`);
    }
    console.log('Conexão com API estabelecida com sucesso');
    return true;
  } catch (error) {
    console.error('Erro ao conectar com a API:', error);
    showToast('Erro ao conectar com o servidor. Verifique se a API está rodando.', 'error');
    return false;
  }
}

/**
 * Faz uma requisição genérica para a API
 * @param {string} endpoint - Endpoint da API
 * @param {string} method - Método HTTP (GET, POST, PUT, DELETE)
 * @param {Object} data - Dados para enviar (opcional)
 * @returns {Promise} Promise com a resposta
 */
async function apiRequest(endpoint, method = 'GET', data = null) {
  // Garantir que o endpoint comece com /api/
  if (!endpoint.startsWith('/api/')) {
    endpoint = '/api' + (endpoint.startsWith('/') ? endpoint : '/' + endpoint);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      // Se for 404, tentar verificar se é um problema de rota
      if (response.status === 404) {
        throw new Error(`Rota não encontrada: ${endpoint}`);
      }

      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(error.error || `Erro ${response.status}: ${response.statusText}`);
    }

    // Para respostas vazias (como em DELETE)
    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Erro na requisição ${method} ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Carrega dados de uma entidade genérica
 * @param {string} entity - Nome da entidade (plural)
 * @param {string} tableId - ID da tabela HTML
 */
async function loadEntityData(entity, tableId) {
  try {
    // Usar o endpoint correto com /api/
    const data = await apiRequest(`/${entity}`);
    const items = data[entity] || data;

    renderTable(items, tableId, entity);
  } catch (error) {
    console.error(`Erro ao carregar ${entity}:`, error);
    showToast(`Erro ao carregar ${entity}: ${error.message}`, 'error');
  }
}

/**
 * Renderiza uma tabela com os dados
 * @param {Array} items - Itens a serem renderizados
 * @param {string} tableId - ID da tabela HTML
 * @param {string} entity - Nome da entidade
 */
function renderTable(items, tableId, entity) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center;">Nenhum ${getEntityName(entity)} encontrado</td></tr>`;
    return;
  }

  items.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = generateTableRow(item, entity);
    tbody.appendChild(row);
  });
  // Adicionar event listeners aos botões
  addActionListeners(tableId, entity);
}

/**
 * Gera o HTML de uma linha da tabela baseado na entidade
 * @param {Object} item - Item a ser renderizado
 * @param {string} entity - Nome da entidade
 * @returns {string} HTML da linha
 */
function generateTableRow(item, entity) {
  const entityName = getEntityName(entity);

  switch (entity) {
    case 'alunos':
      return `
                <td>${item.nome}</td>
                <td>${item.email}</td>
                <td>${item.telefone || '-'}</td>
                <td>${item.instrumento_principal || '-'}</td>
                <td><span class="status status-active">Ativo</span></td>
                <td>
                    <button class="action-btn edit-btn" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;

    case 'professores':
      return `
                <td>${item.nome}</td>
                <td>${item.email}</td>
                <td>${item.especialidade || '-'}</td>
                <td>${item.limite_alunos}</td>
                <td>${item.porcentagem_repassa}%</td>
                <td>
                    <button class="action-btn edit-btn" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;

    case 'aulas':
      // Converter dias da semana de números para nomes
      const diasSemanaMap = ['Segunda', 'Terça', 'Quarta', 'Quinta'];
      const diasSemana = item.dias_semana ? item.dias_semana.map(dia => diasSemanaMap[dia]).join(', ') : '';

      return `
                <td>${item.instrumento}</td>
                <td>${item.turno}</td>
                <td>${item.professor_nome}</td>
                <td>${diasSemana}</td>
                <td>${item.total_alunos || 0}</td>
                <td>
                    <button class="action-btn edit-btn" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                    <button class="action-btn view-btn" data-id="${item.id}"><i class="fas fa-eye"></i></button>
                </td>
            `;

    case 'financeiro':
      const vencimento = new Date(item.data_vencimento);
      const pagamentoDate = item.data_pagamento ? new Date(item.data_pagamento) : null;

      return `
                <td>${item.aluno_nome || 'N/A'}</td>
                <td>R$ ${item.valor?.toFixed(2) || '0,00'}</td>
                <td>${vencimento.toLocaleDateString('pt-BR')}</td>
                <td>${pagamentoDate ? pagamentoDate.toLocaleDateString('pt-BR') : '-'}</td>
                <td>${item.valor_repasse ? 'R$ ' + item.valor_repasse.toFixed(2) : '-'}</td>
                <td><span class="status status-${item.status === 'pago' ? 'active' : 'pending'}">${item.status}</span></td>
                <td>
                    ${item.status !== 'pago' ? `
                    <button class="action-btn pay-btn" data-id="${item.id}"><i class="fas fa-money-bill-wave"></i></button>
                    ` : ''}
                    <button class="action-btn delete-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;

    default:
      return `<td colspan="10">Formato de tabela não definido para ${entity}</td>`;
  }
}

/**
 * Adiciona event listeners aos botões de ação
 * @param {string} tableId - ID da tabela
 * @param {string} entity - Nome da entidade
 */
function addActionListeners(tableId, entity) {
  // Usar delegación de eventos para lidar con elementos dinámicos
  const table = document.getElementById(tableId);

  if (!table) {
    console.error(`Tabela com ID ${tableId} não encontrada`);
    return;
  }

  // Delegación de eventos para botões editar
  table.addEventListener('click', (e) => {
    if (e.target.closest('.edit-btn')) {
      const btn = e.target.closest('.edit-btn');
      editingId = btn.getAttribute('data-id');
      showModal('edit', entity);
    }
  });

  // Delegación de eventos para botões excluir
  table.addEventListener('click', (e) => {
    if (e.target.closest('.delete-btn')) {
      const btn = e.target.closest('.delete-btn');
      editingId = btn.getAttribute('data-id');
      showConfirmModal(entity);
    }
  });

  // Botões de visualizar (apenas para aulas)
  if (entity === 'aulas') {
    table.addEventListener('click', (e) => {
      if (e.target.closest('.view-btn')) {
        const btn = e.target.closest('.view-btn');
        editingId = btn.getAttribute('data-id');
        viewAulaDetails(editingId);
      }
    });
  }

  // Botões de pagamento (apenas para financeiro)
  if (entity === 'financeiro') {
    table.addEventListener('click', (e) => {
      if (e.target.closest('.pay-btn')) {
        const btn = e.target.closest('.pay-btn');
        editingId = btn.getAttribute('data-id');
        processPayment();
      }
    });
  }
}

// ==================== CONFIGURAÇÃO DE EVENTOS ====================

function setupEventListeners() {
  initToastSystem();
  setupMobileMenu();
  // Login
  document.getElementById('loginForm').addEventListener('submit', handleLogin);

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // Navegação do menu
  document.querySelectorAll('.menu li').forEach(item => {
    if (item.id !== 'logoutBtn') {
      item.addEventListener('click', () => {
        const section = item.getAttribute('data-section');
        changeSection(section);
      });
    }
  });

  // Botão adicionar
  addButton.addEventListener('click', () => {
    editingId = null;
    showModal('add', getEntityApiName(currentSection));
  });

  // Fechar modais
  document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', closeModals);
  });

  // Pesquisa
  searchInput.addEventListener('input', debounce(handleSearch, 300));

  // Geração de relatórios
  document.getElementById('generateReportBtn').addEventListener('click', generateReport);

  // Configurar evento de submit do formulário modal
  document.getElementById('modalForm').addEventListener('submit', function (e) {
    e.preventDefault();
    handleFormSubmit(currentEntity, currentAction);
  });

  // Confirmar ação modal
  document.getElementById('confirmAction').addEventListener('click', handleConfirmAction);

  // Cancelar ação modal
  document.getElementById('confirmCancel').addEventListener('click', closeModals);
}

// ==================== FUNÇÕES PRINCIPAIS ====================

async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    // Em uma implementação real, isso faria uma requisição para a API
    if (email === 'admin@music.com' && password === 'senha123') {
      // Simular resposta da API
      const userData = {
        id: 1,
        name: 'Administrador',
        email: email,
        role: 'admin',
        token: 'simulated-jwt-token-' + Date.now()
      };

      // Salvar token e dados do usuário
      localStorage.setItem('authToken', userData.token);
      localStorage.setItem('userData', JSON.stringify(userData));

      currentUser = userData;
      showMainSystem();
      showToast('Login realizado com sucesso!', 'success');
    } else {
      showToast('Credenciais inválidas. Use admin@music.com / senha123 para teste.', 'error');
    }
  } catch (error) {
    console.error('Erro no login:', error);
    showToast('Erro ao fazer login. Tente novamente.', 'error');
  }
}

function validateToken(token) {
  if (token && token.startsWith('simulated-jwt-token-')) {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    currentUser = userData;
    showMainSystem();
  } else {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    showLogin();
  }
}

function handleLogout() {
  // Destruir gráficos
  if (revenueChartInstance) {
    revenueChartInstance.destroy();
    revenueChartInstance = null;
  }
  if (instrumentsChartInstance) {
    instrumentsChartInstance.destroy();
    instrumentsChartInstance = null;
  }

  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  currentUser = null;
  showLogin();
  showToast('Logout realizado com sucesso', 'info');
}

function showLogin() {
  loginContainer.style.display = 'flex';
  mainSystem.style.display = 'none';
}

function showMainSystem() {
  loginContainer.style.display = 'none';
  mainSystem.style.display = 'flex';

  // Atualizar informações do usuário
  if (currentUser) {
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role;
  }

  // Carregar dados iniciais
  loadDashboardData();
}

function changeSection(section) {
  if (currentSection === 'dashboard') {
    if (revenueChartInstance) {
      revenueChartInstance.destroy();
      revenueChartInstance = null;
    }
    if (instrumentsChartInstance) {
      instrumentsChartInstance.destroy();
      instrumentsChartInstance = null;
    }
  }

  currentSection = section;

  // Atualizar menu ativo
  document.querySelectorAll('.menu li').forEach(item => {
    if (item.getAttribute('data-section') === section) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Atualizar título
  sectionTitle.textContent = getSectionTitle(section);

  // Mostrar/ocultar seções
  document.querySelectorAll('.content-section').forEach(sec => {
    sec.style.display = 'none';
  });

  document.getElementById(section + 'Section').style.display = 'block';

  // Mostrar/ocultar botão adicionar
  addButton.style.display = ['dashboard', 'relatorios'].includes(section) ? 'none' : 'block';

  // Carregar dados da seção
  switch (section) {
    case 'dashboard':
      loadDashboardData();
      break;
    case 'alunos':
      loadAlunos();
      break;
    case 'professores':
      loadProfessores();
      break;
    case 'aulas':
      loadAulas();
      break;
    case 'financeiro':
      loadFinanceiro();
      break;
    case 'relatorios':
      // Não precisa carregar dados inicialmente
      break;
  }
}

function getSectionTitle(section) {
  const titles = {
    'dashboard': 'Dashboard',
    'alunos': 'Alunos',
    'professores': 'Professores',
    'aulas': 'Aulas',
    'financeiro': 'Financeiro',
    'relatorios': 'Relatórios'
  };

  return titles[section] || 'Dashboard';
}

// ==================== CARREGAMENTO DE DADOS ====================

async function loadDashboardData() {
  // Usando a API real
  const data = await apiRequest('/relatorios/resumo');

  document.getElementById('totalAlunos').textContent = data.totalAlunos || '0';
  document.getElementById('totalProfessores').textContent = data.totalProfessores || '0';
  document.getElementById('totalAulasConfiguradas').textContent = data.totalAulasConfiguradas || '0';
  document.getElementById('receitaMensal').textContent = `R$ ${(data.receitaMensal || 0).toLocaleString('pt-BR')}`;

  // Gerar gráficos
  generateCharts();

}

async function loadAlunos() {
  await loadEntityData('alunos', 'alunosTable');
}

async function loadProfessores() {
  await loadEntityData('professores', 'professoresTable');
}

async function loadAulas() {
  try {
    const data = await apiRequest('/aulas/configuradas');
    const aulas = data.aulas || data;
    renderTable(aulas, 'aulasTable', 'aulas');
  } catch (error) {
    console.error('Erro ao carregar aulas:', error);
    showToast(`Erro ao carregar aulas: ${error.message}`, 'error');
  }
}

async function loadFinanceiro() {
  await loadEntityData('financeiro', 'financeiroTable');
}

// ==================== MODAL FUNCTIONS ====================

let currentEntity = '';
let currentAction = '';

async function showModal(action, entity) {
  currentEntity = entity;
  currentAction = action;

  const modal = document.getElementById('formModal');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('formFields');

  title.textContent = `${action === 'add' ? 'Adicionar' : 'Editar'} ${getEntityName(entity)}`;

  // Gerar campos do formulário baseado na entidade
  form.innerHTML = generateFormFields(entity, action);

  // Se for uma entidade que precisa carregar opções (apenas aulas e pagamentos agora)
  if (entity === 'aulas' || entity === 'pagamentos') {
    await loadSelectOptions(entity);
  }

  // Se estiver editando, carregar os dados existentes
  if (action === 'edit' && editingId) {
    await loadEntityDataForEdit(entity, editingId);
  }

  modal.style.display = 'flex';
}

/**
 * Carrega opções para selects baseado na entidade
 * @param {string} entity - Nome da entidade
 */
async function loadSelectOptions(entity) {
  try {
    if (entity === 'aulas') {
      // Carregar professores para o formulário de aulas
      const professoresData = await apiRequest('/professores');
      const professores = professoresData.professores || professoresData;

      // Preencher select de professores
      const professorSelect = document.getElementById('professor_id');
      if (professorSelect) {
        professorSelect.innerHTML = '<option value="">Selecione um professor</option>';
        professores.forEach(professor => {
          professorSelect.innerHTML += `<option value="${professor.id}">${professor.nome}</option>`;
        });
      }
    } else if (entity === 'pagamentos') {
      // Carregar alunos para o formulário de pagamentos
      const alunosData = await apiRequest('/alunos');
      const alunos = alunosData.alunos || alunosData;

      // Preencher select de alunos
      const alunoSelect = document.getElementById('aluno_id');
      if (alunoSelect) {
        alunoSelect.innerHTML = '<option value="">Selecione um aluno</option>';
        alunos.forEach(aluno => {
          alunoSelect.innerHTML += `<option value="${aluno.id}">${aluno.nome}</option>`;
        });
      }
    }
  } catch (error) {
    console.error(`Erro ao carregar opções para ${entity}:`, error);
    showToast(`Erro ao carregar opções: ${error.message}`, 'error');
  }
}

async function loadEntityDataForEdit(entity, id) {
  try {
    let endpoint;
    if (entity === 'aulas') {
      endpoint = `/aulas/configuradas/${id}`;
    } else {
      endpoint = `/${entity}/${id}`;
    }

    const data = await apiRequest(endpoint);

    // Preencher os campos do formulário com os dados
    Object.keys(data).forEach(key => {
      const field = document.getElementById(key);
      if (field) {
        field.value = data[key] || '';
      }
    });

    // Se for edição de aula, preencher os checkboxes de dias da semana
    if (entity === 'aulas') {
      // Certifique-se de que os dias da semana estão carregados
      if (data.dias_semana) {
        const checkboxes = document.querySelectorAll('input[name="dias_semana"]');
        checkboxes.forEach(checkbox => {
          checkbox.checked = data.dias_semana.includes(parseInt(checkbox.value));
        });
      }
    }

    // Se for edição de aula, garantir que os selects estejam carregados primeiro
    if (entity === 'aulas') {
      await loadSelectOptions(entity);

      // Aguardar um pouco para garantir que o DOM foi atualizado
      setTimeout(() => {
        const professorField = document.getElementById('professor_id');
        if (professorField && data.professor_id) {
          professorField.value = data.professor_id;
        }
      }, 100);
    }
  } catch (error) {
    console.error(`Erro ao carregar dados do ${entity}:`, error);
    showToast(`Erro ao carregar dados para edição: ${error.message}`, 'error');
  }
}

async function handleFormSubmit(entity, action) {
  try {
    // Coletar dados do formulário
    let formData = {};

    if (entity === 'aulas') {
      // Para aulas, precisamos processar os checkboxes de dias da semana
      const diasSemanaCheckboxes = document.querySelectorAll('input[name="dias_semana"]:checked');
      const dias_semana = Array.from(diasSemanaCheckboxes).map(cb => parseInt(cb.value));

      formData = {
        instrumento: document.getElementById('instrumento').value,
        turno: document.getElementById('turno').value,
        professor_id: document.getElementById('professor_id').value,
        data_inicio: document.getElementById('data_inicio').value,
        dias_semana: dias_semana
      };

      // Determinar URL e método para aulas
      let endpoint, method;
      if (action === 'add') {
        endpoint = '/aulas/configurar';
        method = 'POST';
      } else {
        endpoint = `/aulas/configuradas/${editingId}`;
        method = 'PUT';
      }

      await apiRequest(endpoint, method, formData);
    } else {
      // Para outras entidades, colete os dados normalmente
      const fields = document.querySelectorAll('#formFields .form-control');
      fields.forEach(field => {
        // Para campos numéricos, converter para número
        if (field.type === 'number' || field.type === 'range') {
          formData[field.id] = field.value ? parseFloat(field.value) : null;
        } else {
          formData[field.id] = field.value;
        }
      });

      // Determinar URL e método para outras entidades
      const endpoint = action === 'edit' ? `/${entity}/${editingId}` : `/${entity}`;
      const method = action === 'add' ? 'POST' : 'PUT';

      // Fazer a requisição e aguardar a resposta
      await apiRequest(endpoint, method, formData);

      // REMOVER O BLOCO DE VINCULAÇÃO DE AULA
    }

    showToast(`${getEntityName(entity)} ${action === 'add' ? 'criado' : 'atualizado'} com sucesso!`, 'success');
    closeModals();
    reloadCurrentSection();
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
    showToast(`Erro ao salvar dados: ${error.message}`, 'error');
  }
}

function showConfirmModal(entity) {
  const modal = document.getElementById('confirmModal');
  const message = document.getElementById('confirmMessage');

  message.textContent = `Tem certeza que deseja excluir este ${getEntityName(entity).toLowerCase()}?`;
  modal.style.display = 'flex';

  // Armazenar a entidade para uso no handler
  modal.dataset.entity = entity;
}

async function handleConfirmAction() {
  const modal = document.getElementById('confirmModal');
  const entity = modal.dataset.entity;

  try {
    let endpoint;
    if (entity === 'aulas') {
      endpoint = `/aulas/configuradas/${editingId}`;
    } else {
      endpoint = `/${entity}/${editingId}`;
    }

    await apiRequest(endpoint, 'DELETE');
    showToast(`${getEntityName(entity)} excluído com sucesso!`, 'success');
    closeModals();
    reloadCurrentSection();
  } catch (error) {
    console.error('Erro ao excluir:', error);
    showToast(`Erro ao excluir: ${error.message}`, 'error');
  }
}

async function processPayment() {
  try {
    await apiRequest(`/financeiro/${editingId}/pagar`, 'POST', {
      data_pagamento: new Date().toISOString()
    });

    showToast('Pagamento processado com sucesso!', 'success');
    loadFinanceiro();
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    showToast(`Erro ao processar pagamento: ${error.message}`, 'error');
  }
}

function closeModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.style.display = 'none';
  });

  editingId = null;
  currentEntity = '';
  currentAction = '';
}

// ==================== UTILITY FUNCTIONS ====================

function getEntityName(entity) {
  const names = {
    'alunos': 'Aluno',
    'professores': 'Professor',
    'aulas': 'Aula',
    'financeiro': 'Pagamento',
    'pagamentos': 'Pagamento'
  };

  return names[entity] || 'Item';
}

function getEntityApiName(section) {
  const mapping = {
    'alunos': 'alunos',
    'professores': 'professores',
    'aulas': 'aulas',
    'financeiro': 'pagamentos'
  };

  return mapping[section] || section;
}

function reloadCurrentSection() {
  switch (currentSection) {
    case 'alunos':
      loadAlunos();
      break;
    case 'professores':
      loadProfessores();
      break;
    case 'aulas':
      loadAulas();
      break;
    case 'financeiro':
      loadFinanceiro();
      break;
    case 'dashboard':
      loadDashboardData();
      break;
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function handleSearch() {
  const searchTerm = searchInput.value.toLowerCase();

  // Filtrar tabela atual
  const tableId = `${currentSection}Table`;
  const table = document.getElementById(tableId);

  if (table) {
    const rows = table.querySelectorAll('tbody tr');

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.style.display = 'none';
  });
  // Também feche os modais padrão
  closeModals();
}

// ==================== FUNÇÕES PARA O NOVO SISTEMA DE AULAS ====================

/**
 * Visualiza os detalhes de uma aula e permite vincular alunos
 * @param {number} aulaId - ID da aula
 */
async function viewAulaDetails(aulaId) {
  closeAllModals();
  try {
    // Carregar os detalhes da aula
    const aula = await apiRequest(`/aulas/configuradas/${aulaId}`);

    // Carregar a lista de alunos
    const alunosData = await apiRequest('/alunos');
    const alunos = alunosData.alunos || alunosData;

    // Criar um modal para exibir os detalhes
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <span class="close">&times;</span>
        <h2>Detalhes da Aula</h2>
        <p><strong>Instrumento:</strong> ${aula.instrumento}</p>
        <p><strong>Turno:</strong> ${aula.turno}</p>
        <p><strong>Professor:</strong> ${aula.professor_nome}</p>
        <p><strong>Data de Início:</strong> ${new Date(aula.data_inicio).toLocaleDateString('pt-BR')}</p>
        <p><strong>Dias da Semana:</strong> ${aula.dias_semana.map(dia => ['Segunda', 'Terça', 'Quarta', 'Quinta'][dia]).join(', ')}</p>
        
        <h3>Alunos Vinculados</h3>
        <ul id="alunos-vinculados" style="list-style: none; padding: 0;">
          ${aula.alunos && aula.alunos.length > 0 ? aula.alunos.map(aluno => `
            <li style="display: flex; color: #000; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 10px; background: #aaa; border-radius: 4px;">
              <span>${aluno.nome} - ${aluno.email}</span>
              <button class="action-btn delete-btn" data-aluno-id="${aluno.id}" style="margin-left: 10px;">
                <i class="fas fa-trash"></i>
              </button>
            </li>
          `).join('') : '<li>Nenhum aluno vinculado</li>'}
        </ul>
        
        <h3>Vincular Novo Aluno</h3>
        <select id="alunoParaVincular" class="form-control">
          <option value="">Selecione um aluno</option>
          ${alunos.map(aluno => `<option value="${aluno.id}">${aluno.nome} - ${aluno.email}</option>`).join('')}
        </select>
        <button id="vincularAluno" class="btn btn-primary" style="margin-top: 10px;">Vincular Aluno</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    // Fechar modal
    modal.querySelector('.close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    // Vincular aluno
    modal.querySelector('#vincularAluno').addEventListener('click', async () => {
      const alunoId = modal.querySelector('#alunoParaVincular').value;
      if (!alunoId) {
        showToast('Selecione um aluno para vincular', 'warning');
        return;
      }

      try {
        await apiRequest(`/aulas/${aulaId}/alunos/${alunoId}`, 'POST');
        showToast('Aluno vinculado com sucesso', 'success');
        // Recarregar os detalhes
        document.body.removeChild(modal);
        viewAulaDetails(aulaId);
      } catch (error) {
        showToast(`Erro ao vincular aluno: ${error.message}`, 'error');
      }
    });

    // Desvincular aluno
    modal.querySelectorAll('#alunos-vinculados .delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const alunoId = btn.getAttribute('data-aluno-id');
        try {
          await apiRequest(`/aulas/${aulaId}/alunos/${alunoId}`, 'DELETE');
          showToast('Aluno desvinculado com sucesso', 'success');
          // Recarregar os detalhes
          document.body.removeChild(modal);
          viewAulaDetails(aulaId);
        } catch (error) {
          showToast(`Erro ao desvincular aluno: ${error.message}`, 'error');
        }
      });
    });

  } catch (error) {
    console.error('Erro ao carregar detalhes da aula:', error);
    showToast(`Erro ao carregar detalhes da aula: ${error.message}`, 'error');
  }
}

// ==================== GRÁFICOS E RELATÓRIOS ====================

// Gerar gráficos
// Gerar gráficos
function generateCharts() {
  // Verificar se Chart.js está disponível
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js não está carregado. Gráficos não serão renderizados.');
    return;
  }

  // Destruir gráficos existentes antes de criar novos
  if (revenueChartInstance) {
    revenueChartInstance.destroy();
    revenueChartInstance = null;
  }

  if (instrumentsChartInstance) {
    instrumentsChartInstance.destroy();
    instrumentsChartInstance = null;
  }

  // Gráfico de receita (dados estáticos para exemplo)
  const revenueCtx = document.getElementById('revenueChart')?.getContext('2d');
  if (revenueCtx) {
    revenueChartInstance = new Chart(revenueCtx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
        datasets: [{
          label: 'Receita Mensal (R$)',
          data: [22000, 23400, 25800, 24100, 27200, 28540],
          borderColor: '#4361ee',
          backgroundColor: 'rgba(67, 97, 238, 0.1)',
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          }
        }
      }
    });
  }

  // Gráfico de instrumentos
  const instrumentsCtx = document.getElementById('instrumentsChart')?.getContext('2d');
  if (instrumentsCtx) {
    instrumentsChartInstance = new Chart(instrumentsCtx, {
      type: 'doughnut',
      data: {
        labels: ['Piano', 'Guitarra', 'Violino', 'Bateria', 'Canto', 'Outros'],
        datasets: [{
          data: [35, 28, 15, 12, 8, 2],
          backgroundColor: [
            '#4361ee',
            '#3a0ca3',
            '#4cc9f0',
            '#f72585',
            '#fca311',
            '#6c757d'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
          }
        }
      }
    });
  }
}

// Controle do menu mobile
function setupMobileMenu() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const sidebarClose = document.getElementById('sidebarClose');

  if (!menuToggle || !sidebar) return;

  // Abrir menu
  menuToggle.addEventListener('click', () => {
    sidebar.classList.add('active');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  // Fechar menu
  const closeMenu = () => {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  };

  // Fechar com botão
  if (sidebarClose) {
    sidebarClose.addEventListener('click', closeMenu);
  }

  // Fechar clicando no overlay
  sidebarOverlay.addEventListener('click', closeMenu);

  // Fechar menu ao clicar em um item (em mobile)
  const menuItems = document.querySelectorAll('.menu li');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        closeMenu();
      }
    });
  });

  // Fechar menu ao redimensionar para tamanho maior
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMenu();
    }
  });

  // Fechar menu com a tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('active')) {
      closeMenu();
    }
  });
}

async function generateReport() {
  const reportType = document.getElementById('reportType').value;
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;

  // Validação básica
  if (!startDate || !endDate) {
    showToast('Por favor, selecione as datas de início e fim.', 'warning');
    return;
  }

  try {
    const results = document.getElementById('reportResults');
    results.innerHTML = '<p class="loading">Gerando relatório...</p>';

    // Simular requisição à API (substituir por chamada real quando disponível)
    setTimeout(() => {
      let reportContent = '';

      switch (reportType) {
        case 'financial':
          reportContent = `
                        <h4>Relatório Financeiro</h4>
                        <p>Período: ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}</p>
                        <div class="report-summary">
                            <div class="summary-item">
                                <h5>Receita Total</h5>
                                <p>R$ 15.420,00</p>
                            </div>
                            <div class="summary-item">
                                <h5>Repasses a Professores</h5>
                                <p>R$ 10.794,00</p>
                            </div>
                            <div class="summary-item">
                                <h5>Lucro Líquido</h5>
                                <p>R$ 4.626,00</p>
                            </div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Mês</th>
                                    <th>Receita</th>
                                    <th>Repasses</th>
                                    <th>Lucro</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td>Jan/2023</td><td>R$ 12.400,00</td><td>R$ 8.680,00</td><td>R$ 3.720,00</td></tr>
                                <tr><td>Fev/2023</td><td>R$ 13.850,00</td><td>R$ 9.695,00</td><td>R$ 4.155,00</td></tr>
                                <tr><td>Mar/2023</td><td>R$ 15.420,00</td><td>R$ 10.794,00</td><td>R$ 4.626,00</td></tr>
                            </tbody>
                        </table>
                    `;
          break;

        case 'classes':
          reportContent = `
                        <h4>Relatório de Aulas</h4>
                        <p>Período: ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}</p>
                        <div class="report-summary">
                            <div class="summary-item">
                                <h5>Total de Aulas</h5>
                                <p>248</p>
                            </div>
                            <div class="summary-item">
                                <h5>Taxa de Comparecimento</h5>
                                <p>92%</p>
                            </div>
                            <div class="summary-item">
                                <h5>Cancelamentos</h5>
                                <p>8%</p>
                            </div>
                        </div>
                    `;
          break;

        default:
          reportContent = `<p>Relatório gerado para ${reportType} no período selecionado.</p>`;
      }

      results.innerHTML = reportContent;
      showToast('Relatório gerado com sucesso', 'success');
    }, 1500);
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    document.getElementById('reportResults').innerHTML = '<p class="error">Erro ao gerar relatório.</p>';
    showToast('Erro ao gerar relatório', 'error');
  }
}

// Gerar campos do formulário - MELHORIA
function generateFormFields(entity, action) {
  const fields = {
    'alunos': `
        <div class="form-group">
            <label for="nome">Nome completo</label>
            <input type="text" id="nome" class="form-control" required>
        </div>
        <div class="form-group">
            <label for="email">E-mail</label>
            <input type="email" id="email" class="form-control" required>
        </div>
        <div class="form-group">
            <label for="telefone">Telefone</label>
            <input type="tel" id="telefone" class="form-control">
        </div>
        <div class="form-group">
            <label for="data_nascimento">Data de Nascimento</label>
            <input type="date" id="data_nascimento" class="form-control">
        </div>
        <div class="form-group">
            <label for="instrumento_principal">Instrumento Principal</label>
            <select id="instrumento_principal" class="form-control">
                <option value="">Selecione um instrumento</option>
                <option value="Piano">Piano</option>
                <option value="Guitarra">Guitarra</option>
                <option value="Violino">Violino</option>
                <option value="Bateria">Bateria</option>
                <option value="Canto">Canto</option>
                <option value="Outro">Outro</option>
            </select>
        </div>`,

    'professores': `
            <div class="form-group">
                <label for="nome">Nome completo</label>
                <input type="text" id="nome" class="form-control" required>
            </div>
            <div class="form-group">
                <label for="email">E-mail</label>
                <input type="email" id="email" class="form-control" required>
            </div>
            <div class="form-group">
                <label for="telefone">Telefone</label>
                <input type="tel" id="telefone" class="form-control">
            </div>
            <div class="form-group">
                <label for="especialidade">Especialidade</label>
                <input type="text" id="especialidade" class="form-control">
            </div>
            <div class="form-group">
                <label for="limite_alunos">Limite de Alunos por Horário</label>
                <input type="number" id="limite_alunos" class="form-control" value="5" min="1">
            </div>
            <div class="form-group">
                <label for="porcentagem_repassa">Porcentagem de Repasse (%)</label>
                <input type="number" id="porcentagem_repassa" class="form-control" value="70" min="1" max="100">
            </div>
        `,
    'aulas': `
            <div class="form-group">
                <label for="instrumento">Instrumento</label>
                <input type="text" id="instrumento" class="form-control" required>
            </div>
            <div class="form-group">
                <label for="turno">Turno</label>
                <select id="turno" class="form-control" required>
                    <option value="">Selecione um turno</option>
                    <option value="manhã">Manhã</option>
                    <option value="tarde">Tarde</option>
                    <option value="noite">Noite</option>
                </select>
            </div>
            <div class="form-group">
                <label for="professor_id">Professor</label>
                <select id="professor_id" class="form-control" required>
                    <option value="">Selecione um professor</option>
                </select>
            </div>
            <div class="form-group">
                <label for="data_inicio">Data de Início</label>
                <input type="date" id="data_inicio" class="form-control" required>
            </div>
            <div class="form-group">
                <label>Dias da Semana</label>
                <div class="dias-semana-container" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                    <label><input type="checkbox" name="dias_semana" value="1"> Segunda</label>
                    <label><input type="checkbox" name="dias_semana" value="2"> Terça</label>
                    <label><input type="checkbox" name="dias_semana" value="3"> Quarta</label>
                    <label><input type="checkbox" name="dias_semana" value="4"> Quinta</label>
                </div>
            </div>
        `,
    'pagamentos': `
            <div class="form-group">
                <label for="aluno_id">Aluno</label>
                <select id="aluno_id" class="form-control" required>
                    <option value="">Selecione um aluno</option>
                </select>
            </div>
            <div class="form-group">
                <label for="valor">Valor (R$)</label>
                <input type="number" id="valor" class="form-control" step="0.01" min="0" required>
            </div>
            <div class="form-group">
                <label for="data_vencimento">Data de Vencimento</label>
                <input type="date" id="data_vencimento" class="form-control" required>
            </div>
        `
  };

  return fields[entity] || '<p>Formulário não disponível para esta entidade.</p>';
}