// ==============================================================
// MÓDULO PRINCIPAL DA APLICAÇÃO
// ==============================================================

// Configurações da aplicação
const AppConfig = {
  API_BASE_URL: window.location.origin,
  TOKEN_PREFIX: 'simulated-jwt-token-'
};

// Estado global da aplicação
const AppState = {
  currentUser: null,
  currentSection: 'dashboard',
  editingId: null,
  revenueChartInstance: null,
  instrumentsChartInstance: null,
  currentEntity: '',
  currentAction: ''
};

// Cache de elementos DOM
const DomElements = {
  loginContainer: document.getElementById('loginContainer'),
  loader: document.getElementById('loader'),
  mainSystem: document.getElementById('mainSystem'),
  sectionTitle: document.getElementById('sectionTitle'),
  contentArea: document.getElementById('contentArea'),
  addButton: document.getElementById('addButton'),
  searchInput: document.getElementById('searchInput'),
  toastContainer: document.getElementById('toast-container')
};

// ==============================================================
// MÓDULO DE UTILITÁRIOS
// ==============================================================

/**
 * Utilitários genéricos para a aplicação
 */
const Utils = {
  /**
   * Debounce function para limitar chamadas repetidas
   * @param {Function} func - Função a ser executada
   * @param {number} wait - Tempo de espera em ms
   * @returns {Function} Função debounced
   */
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Formata valor monetário em Real brasileiro
   * @param {number} value - Valor a ser formatado
   * @returns {string} Valor formatado
   */
  formatCurrency: (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  },

  /**
   * Formata data para o formato brasileiro
   * @param {string|Date} date - Data a ser formatada
   * @returns {string} Data formatada
   */
  formatDate: (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  },

  /**
   * Obtém o nome amigável de uma entidade
   * @param {string} entity - Nome técnico da entidade
   * @returns {string} Nome amigável
   */
  getEntityName: (entity) => {
    const names = {
      'alunos': 'Aluno',
      'professores': 'Professor',
      'aulas': 'Aula',
      'financeiro': 'Pagamento',
      'pagamentos': 'Pagamento'
    };
    return names[entity] || 'Item';
  },

  /**
   * Obtém o nome da API para uma seção
   * @param {string} section - Nome da seção
   * @returns {string} Nome da entidade na API
   */
  getEntityApiName: (section) => {
    const mapping = {
      'alunos': 'alunos',
      'professores': 'professores',
      'aulas': 'aulas',
      'financeiro': 'pagamentos'
    };
    return mapping[section] || section;
  },

  /**
   * Obtém o título da seção
   * @param {string} section - Nome da seção
   * @returns {string} Título da seção
   */
  getSectionTitle: (section) => {
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
};

// ==============================================================
// MÓDULO DE TOAST (NOTIFICAÇÕES)
// ==============================================================

/**
 * Sistema de notificações toast
 */
const ToastSystem = {
  /**
   * Inicializa o sistema de toasts
   */
  init: () => {
    if (!DomElements.toastContainer) {
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
      DomElements.toastContainer = toastContainer;
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
  },

  /**
   * Exibe uma notificação toast
   * @param {string} message - Mensagem a ser exibida
   * @param {string} type - Tipo de toast (success, error, warning, info)
   * @param {number} duration - Duração em milissegundos
   * @returns {HTMLElement} Elemento do toast criado
   */
  show: (message, type = 'info', duration = 3000) => {
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
                    background: ${ToastSystem.getColor(type)};
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
      ToastSystem.remove(toast);
    });

    DomElements.toastContainer.appendChild(toast);

    // Remover automaticamente após a duração
    if (duration > 0) {
      setTimeout(() => {
        ToastSystem.remove(toast);
      }, duration);
    }

    return toast;
  },

  /**
   * Obtém a cor do toast baseado no tipo
   * @param {string} type - Tipo do toast
   * @returns {string} Código da cor
   */
  getColor: (type) => {
    const colors = {
      success: '#4caf50',
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196f3'
    };
    return colors[type] || colors.info;
  },

  /**
   * Remove um toast da tela
   * @param {HTMLElement} toast - Elemento do toast a ser removido
   */
  remove: (toast) => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }
};

// ==============================================================
// MÓDULO DE API
// ==============================================================

/**
 * Serviços de comunicação com a API
 */
const ApiService = {
  /**
   * Testa a conexão com a API
   * @returns {Promise<boolean>} Resultado do teste de conexão
   */
  testConnection: async () => {
    try {
      const response = await fetch(`${AppConfig.API_BASE_URL}/api/alunos`);
      if (!response.ok) {
        throw new Error(`API não está respondendo: ${response.status}`);
      }
      console.log('Conexão com API estabelecida com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao conectar com a API:', error);
      ToastSystem.show('Erro ao conectar com o servidor. Verifique se a API está rodando.', 'error');
      return false;
    }
  },

  /**
   * Faz uma requisição para a API
   * @param {string} endpoint - Endpoint da API
   * @param {string} method - Método HTTP (GET, POST, PUT, DELETE)
   * @param {Object} data - Dados a serem enviados (opcional)
   * @returns {Promise} Promise com a resposta
   */
  request: async (endpoint, method = 'GET', data = null) => {
    // Garantir que o endpoint comece com /api/
    if (!endpoint.startsWith('/api/')) {
      endpoint = '/api' + (endpoint.startsWith('/') ? endpoint : '/' + endpoint);
    }

    const url = `${AppConfig.API_BASE_URL}${endpoint}`;
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
  },

  /**
   * Carrega dados de uma entidade
   * @param {string} entity - Nome da entidade
   * @param {string} tableId - ID da tabela HTML
   * @returns {Promise} Promise com os dados carregados
   */
  loadEntityData: async (entity, tableId) => {
    try {
      const data = await ApiService.request(`/${entity}`);
      const items = data[entity] || data;
      TableSystem.render(items, tableId, entity);
      return items;
    } catch (error) {
      console.error(`Erro ao carregar ${entity}:`, error);
      ToastSystem.show(`Erro ao carregar ${entity}: ${error.message}`, 'error');
      return [];
    }
  }
};

// ==============================================================
// MÓDULO DE TABELAS
// ==============================================================

/**
 * Sistema de renderização e gerenciamento de tabelas
 */
const TableSystem = {
  /**
   * Renderiza uma tabela com os dados fornecidos
   * @param {Array} items - Itens a serem renderizados
   * @param {string} tableId - ID da tabela HTML
   * @param {string} entity - Nome da entidade
   */
  render: (items, tableId, entity) => {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!items || items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center;">Nenhum ${Utils.getEntityName(entity)} encontrado</td></tr>`;
      return;
    }

    items.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = TableSystem.generateRow(item, entity);
      tbody.appendChild(row);
    });

    TableSystem.addActionListeners(tableId, entity);
  },

  /**
   * Gera o HTML de uma linha da tabela
   * @param {Object} item - Item a ser renderizado
   * @param {string} entity - Nome da entidade
   * @returns {string} HTML da linha
   */
  generateRow: (item, entity) => {
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
        const diasSemanaMap = ['Domingo','Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const diasSemana = item.dias_semana ? item.dias_semana.map(dia => diasSemanaMap[dia]).join(', ') : '';
        console.log(item.dias_semana, diasSemana);
        

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
                            <td>${Utils.formatCurrency(item.valor)}</td>
                            <td>${Utils.formatDate(vencimento)}</td>
                            <td>${Utils.formatDate(pagamentoDate)}</td>
                            <td>${item.valor_repasse ? Utils.formatCurrency(item.valor_repasse) : '-'}</td>
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
  },

  /**
   * Adiciona listeners de ação aos botões da tabela
   * @param {string} tableId - ID da tabela
   * @param {string} entity - Nome da entidade
   */
  addActionListeners: (tableId, entity) => {
    const table = document.getElementById(tableId);
    if (!table) {
      console.error(`Tabela com ID ${tableId} não encontrada`);
      return;
    }

    // Delegation para botões editar
    table.addEventListener('click', (e) => {
      if (e.target.closest('.edit-btn')) {
        const btn = e.target.closest('.edit-btn');
        AppState.editingId = btn.getAttribute('data-id');
        ModalSystem.show('edit', entity);
      }
    });

    // Delegation para botões excluir
    table.addEventListener('click', (e) => {
      if (e.target.closest('.delete-btn')) {
        const btn = e.target.closest('.delete-btn');
        AppState.editingId = btn.getAttribute('data-id');
        ModalSystem.showConfirm(entity);
      }
    });

    // Botões de visualizar (apenas para aulas)
    if (entity === 'aulas') {
      table.addEventListener('click', (e) => {
        if (e.target.closest('.view-btn')) {
          const btn = e.target.closest('.view-btn');
          AppState.editingId = btn.getAttribute('data-id');
          AulaSystem.viewDetails(AppState.editingId);
        }
      });
    }

    // Botões de pagamento (apenas para financeiro)
    if (entity === 'financeiro') {
      table.addEventListener('click', (e) => {
        if (e.target.closest('.pay-btn')) {
          const btn = e.target.closest('.pay-btn');
          AppState.editingId = btn.getAttribute('data-id');
          FinanceiroSystem.processPayment(AppState.editingId);
        }
      });
    }
  },

  /**
   * Filtra os itens da tabela com base no termo de pesquisa
   * @param {string} searchTerm - Termo de pesquisa
   * @param {string} tableId - ID da tabela
   */
  filter: (searchTerm, tableId) => {
    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    const searchTermLower = searchTerm.toLowerCase();

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTermLower) ? '' : 'none';
    });
  }
};

// ==============================================================
// MÓDULO DE MODAIS
// ==============================================================

/**
 * Sistema de gerenciamento de modais
 */
const ModalSystem = {
  /**
   * Exibe o modal de formulário para adicionar/editar
   * @param {string} action - Ação (add ou edit)
   * @param {string} entity - Nome da entidade
   */
  show: async (action, entity) => {
    AppState.currentEntity = entity;
    AppState.currentAction = action;

    const modal = document.getElementById('formModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('formFields');

    title.textContent = `${action === 'add' ? 'Adicionar' : 'Editar'} ${Utils.getEntityName(entity)}`;
    form.innerHTML = ModalSystem.generateFormFields(entity, action);

    // Carregar opções para selects se necessário
    if (entity === 'aulas' || entity === 'pagamentos') {
      await ModalSystem.loadSelectOptions(entity);
    }

    // Carregar dados existentes se for edição
    if (action === 'edit' && AppState.editingId) {
      await ModalSystem.loadEntityDataForEdit(entity, AppState.editingId);
    }

    modal.style.display = 'flex';
  },

  /**
   * Gera os campos do formulário para uma entidade
   * @param {string} entity - Nome da entidade
   * @param {string} action - Ação (add ou edit)
   * @returns {string} HTML dos campos do formulário
   */
  generateFormFields: (entity, action) => {
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
  },

  /**
   * Carrega opções para selects baseado na entidade
   * @param {string} entity - Nome da entidade
   */
  loadSelectOptions: async (entity) => {
    try {
      if (entity === 'aulas') {
        const professoresData = await ApiService.request('/professores');
        const professores = professoresData.professores || professoresData;

        const professorSelect = document.getElementById('professor_id');
        if (professorSelect) {
          professorSelect.innerHTML = '<option value="">Selecione um professor</option>';
          professores.forEach(professor => {
            professorSelect.innerHTML += `<option value="${professor.id}">${professor.nome}</option>`;
          });
        }
      } else if (entity === 'pagamentos') {
        const alunosData = await ApiService.request('/alunos');
        const alunos = alunosData.alunos || alunosData;

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
      ToastSystem.show(`Erro ao carregar opções: ${error.message}`, 'error');
    }
  },

  /**
   * Carrega dados de uma entidade para edição
   * @param {string} entity - Nome da entidade
   * @param {string} id - ID do item
   */
  loadEntityDataForEdit: async (entity, id) => {
    try {
      let endpoint = entity === 'aulas' ? `/aulas/configuradas/${id}` : `/${entity}/${id}`;
      const data = await ApiService.request(endpoint);

      // Preencher os campos do formulário
      Object.keys(data).forEach(key => {
        const field = document.getElementById(key);
        if (field) {
          field.value = data[key] || '';
        }
      });

      // Preencher checkboxes de dias da semana para aulas
      if (entity === 'aulas' && data.dias_semana) {
        const checkboxes = document.querySelectorAll('input[name="dias_semana"]');
        checkboxes.forEach(checkbox => {
          checkbox.checked = data.dias_semana.includes(parseInt(checkbox.value));
        });
      }

      // Preencher selects após carregar opções
      if (entity === 'aulas') {
        await ModalSystem.loadSelectOptions(entity);
        setTimeout(() => {
          const professorField = document.getElementById('professor_id');
          if (professorField && data.professor_id) {
            professorField.value = data.professor_id;
          }
        }, 100);
      }
    } catch (error) {
      console.error(`Erro ao carregar dados do ${entity}:`, error);
      ToastSystem.show(`Erro ao carregar dados para edição: ${error.message}`, 'error');
    }
  },

  /**
   * Manipula o envio do formulário
   * @param {string} entity - Nome da entidade
   * @param {string} action - Ação (add ou edit)
   */
  handleSubmit: async (entity, action) => {
    try {
      let formData = {};

      if (entity === 'aulas') {
        const diasSemanaCheckboxes = document.querySelectorAll('input[name="dias_semana"]:checked');
        const dias_semana = Array.from(diasSemanaCheckboxes).map(cb => parseInt(cb.value));

        formData = {
          instrumento: document.getElementById('instrumento').value,
          turno: document.getElementById('turno').value,
          professor_id: document.getElementById('professor_id').value,
          data_inicio: document.getElementById('data_inicio').value,
          dias_semana: dias_semana
        };

        let endpoint, method;
        if (action === 'add') {
          endpoint = '/aulas/configurar';
          method = 'POST';
        } else {
          endpoint = `/aulas/configuradas/${AppState.editingId}`;
          method = 'PUT';
        }

        await ApiService.request(endpoint, method, formData);
      } else {
        const fields = document.querySelectorAll('#formFields .form-control');
        fields.forEach(field => {
          if (field.type === 'number' || field.type === 'range') {
            formData[field.id] = field.value ? parseFloat(field.value) : null;
          } else {
            formData[field.id] = field.value;
          }
        });

        const endpoint = action === 'edit' ? `/${entity}/${AppState.editingId}` : `/${entity}`;
        const method = action === 'add' ? 'POST' : 'PUT';

        await ApiService.request(endpoint, method, formData);
      }

      ToastSystem.show(`${Utils.getEntityName(entity)} ${action === 'add' ? 'criado' : 'atualizado'} com sucesso!`, 'success');
      ModalSystem.close();
      NavigationSystem.reloadCurrentSection();
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
      ToastSystem.show(`Erro ao salvar dados: ${error.message}`, 'error');
    }
  },

  /**
   * Exibe modal de confirmação para exclusão
   * @param {string} entity - Nome da entidade
   */
  showConfirm: (entity) => {
    const modal = document.getElementById('confirmModal');
    const message = document.getElementById('confirmMessage');

    message.textContent = `Tem certeza que deseja excluir este ${Utils.getEntityName(entity).toLowerCase()}?`;
    modal.style.display = 'flex';
    modal.dataset.entity = entity;
  },

  /**
   * Manipula a ação de confirmação (exclusão)
   */
  handleConfirm: async () => {
    const modal = document.getElementById('confirmModal');
    const entity = modal.dataset.entity;

    try {
      let endpoint = entity === 'aulas' ? `/aulas/configuradas/${AppState.editingId}` : `/${entity}/${AppState.editingId}`;
      await ApiService.request(endpoint, 'DELETE');

      ToastSystem.show(`${Utils.getEntityName(entity)} excluído com sucesso!`, 'success');
      ModalSystem.close();
      NavigationSystem.reloadCurrentSection();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      ToastSystem.show(`Erro ao excluir: ${error.message}`, 'error');
    }
  },

  /**
   * Fecha todos os modais
   */
  close: () => {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
    });

    AppState.editingId = null;
    AppState.currentEntity = '';
    AppState.currentAction = '';
  }
};

// ==============================================================
// MÓDULO DE NAVEGAÇÃO
// ==============================================================

/**
 * Sistema de navegação e carregamento de seções
 */
const NavigationSystem = {
  /**
   * Altera a seção atual
   * @param {string} section - Nome da seção
   */
  changeSection: (section) => {
    if (AppState.currentSection === 'dashboard') {
      DashboardSystem.destroyCharts()
    }

    AppState.currentSection = section;

    // Atualizar menu ativo
    document.querySelectorAll('.menu li').forEach(item => {
      if (item.getAttribute('data-section') === section) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Atualizar título
    DomElements.sectionTitle.textContent = Utils.getSectionTitle(section);

    // Mostrar/ocultar seções
    document.querySelectorAll('.content-section').forEach(sec => {
      sec.style.display = 'none';
    });

    document.getElementById(section + 'Section').style.display = 'block';

    // Mostrar/ocultar botão adicionar
    DomElements.addButton.style.display = ['dashboard', 'relatorios'].includes(section) ? 'none' : 'block';

    // Carregar dados da seção
    NavigationSystem.loadSectionData(section);
  },

  /**
   * Carrega os dados da seção especificada
   * @param {string} section - Nome da seção
   */
  loadSectionData: (section) => {
    switch (section) {
      case 'dashboard':
        DashboardSystem.loadData();
        break;
      case 'alunos':
        ApiService.loadEntityData('alunos', 'alunosTable');
        break;
      case 'professores':
        ApiService.loadEntityData('professores', 'professoresTable');
        break;
      case 'aulas':
        AulaSystem.load();
        break;
      case 'financeiro':
        ApiService.loadEntityData('financeiro', 'financeiroTable');
        break;
      case 'relatorios':
        // Não precisa carregar dados inicialmente
        break;
    }
  },

  /**
   * Recarrega a seção atual
   */
  reloadCurrentSection: () => {
    NavigationSystem.loadSectionData(AppState.currentSection);
  }
};

// ==============================================================
// MÓDULO DE AUTENTICAÇÃO
// ==============================================================

/**
 * Sistema de autenticação e gerenciamento de usuário
 */
const AuthSystem = {
  /**
   * Manipula o processo de login
   * @param {Event} e - Evento de submit do formulário
   */
  handleLogin: async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      if (email === 'admin@music.com' && password === 'senha123') {
        const userData = {
          id: 1,
          name: 'Administrador',
          email: email,
          role: 'admin',
          token: AppConfig.TOKEN_PREFIX + Date.now()
        };

        localStorage.setItem('authToken', userData.token);
        localStorage.setItem('userData', JSON.stringify(userData));

        AppState.currentUser = userData;
        AuthSystem.showMainSystem();
        ToastSystem.show('Login realizado com sucesso!', 'success');
      } else {
        ToastSystem.show('Credenciais inválidas. Use admin@music.com / senha123 para teste.', 'error');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      ToastSystem.show('Erro ao fazer login. Tente novamente.', 'error');
    }
  },

  /**
   * Valida o token de autenticação
   * @param {string} token - Token JWT
   */
  validateToken: (token) => {
    if (token && token.startsWith(AppConfig.TOKEN_PREFIX)) {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      AppState.currentUser = userData;
      AuthSystem.showMainSystem();
    } else {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      AuthSystem.showLogin();
    }
  },

  /**
   * Manipula o logout do usuário
   */
  handleLogout: () => {
    // Destruir gráficos
    DashboardSystem.destroyCharts()

    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    AppState.currentUser = null;
    AuthSystem.showLogin();
    ToastSystem.show('Logout realizado com sucesso', 'info');
  },

  /**
   * Exibe a tela de login
   */
  showLogin: () => {
    if (DomElements.loginContainer) DomElements.loginContainer.style.display = 'flex';
    if (DomElements.mainSystem) DomElements.mainSystem.style.display = 'none';
  },

  /**
   * Exibe o sistema principal
   */
  showMainSystem: () => {
    if (DomElements.loginContainer) DomElements.loginContainer.style.display = 'none';
    if (DomElements.mainSystem) DomElements.mainSystem.style.display = 'flex';

    // Atualizar informações do usuário
    if (AppState.currentUser) {
      document.getElementById('userName').textContent = AppState.currentUser.name;
      document.getElementById('userRole').textContent = AppState.currentUser.role;
    }

    // Carregar dados iniciais
    DashboardSystem.loadData();
  }
};

// ==============================================================
// MÓDULO DO DASHBOARD
// ==============================================================

/**
 * Sistema do dashboard e gráficos
 */
const DashboardSystem = {
  /**
   * Carrega os dados do dashboard
   */
  loadData: async () => {
    try {
      const data = await ApiService.request('/relatorios/resumo');

      document.getElementById('totalAlunos').textContent = data.totalAlunos || '0';
      document.getElementById('totalProfessores').textContent = data.totalProfessores || '0';
      document.getElementById('totalAulasConfiguradas').textContent = data.totalAulasConfiguradas || '0';
      document.getElementById('receitaMensal').textContent = Utils.formatCurrency(data.receitaMensal);

      // Gerar gráficos
      DashboardSystem.generateCharts();
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      ToastSystem.show('Erro ao carregar dados do dashboard', 'error');
    }
  },

  destroyCharts: () => {
    if (AppState.revenueChartInstance) {
      AppState.revenueChartInstance.destroy();
      AppState.revenueChartInstance = null;
    }
    if (AppState.instrumentsChartInstance) {
      AppState.instrumentsChartInstance.destroy();
      AppState.instrumentsChartInstance = null;
    }
  },

  /**
   * Gera os gráficos do dashboard
   */
  generateCharts: () => {
    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js não está carregado. Gráficos não serão renderizados.');
      return;
    }

    // Destruir gráficos existentes    
    DashboardSystem.destroyCharts();

    // Gráfico de receita (dados estáticos para exemplo)
    const revenueCtx = document.getElementById('revenueChart')?.getContext('2d');
    if (revenueCtx) {
      AppState.revenueChartInstance = new Chart(revenueCtx, {
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
      AppState.instrumentsChartInstance = new Chart(instrumentsCtx, {
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
};

// ==============================================================
// MÓDULO DE AULAS
// ==============================================================

/**
 * Sistema de gerenciamento de aulas
 */
const AulaSystem = {
  /**
   * Carrega os dados das aulas
   */
  load: async () => {
    try {
      const data = await ApiService.request('/aulas/configuradas');
      const aulas = data.aulas || data;
      TableSystem.render(aulas, 'aulasTable', 'aulas');
    } catch (error) {
      console.error('Erro ao carregar aulas:', error);
      ToastSystem.show(`Erro ao carregar aulas: ${error.message}`, 'error');
    }
  },

  /**
   * Visualiza os detalhes de uma aula
   * @param {number} aulaId - ID da aula
   */
  viewDetails: async (aulaId) => {
    ModalSystem.close();
    try {
      const aula = await ApiService.request(`/aulas/configuradas/${aulaId}`);
      const alunosData = await ApiService.request('/alunos');
      const alunos = alunosData.alunos || alunosData;

      // Criar modal para exibir detalhes
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
                        <div class="modal-content" style="max-width: 600px;">
                            <span class="close">&times;</span>
                            <h2>Detalhes da Aula</h2>
                            <p><strong>Instrumento:</strong> ${aula.instrumento}</p>
                            <p><strong>Turno:</strong> ${aula.turno}</p>
                            <p><strong>Professor:</strong> ${aula.professor_nome}</p>
                            <p><strong>Data de Início:</strong> ${Utils.formatDate(aula.data_inicio)}</p>
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
          ToastSystem.show('Selecione um aluno para vincular', 'warning');
          return;
        }

        try {
          await ApiService.request(`/aulas/${aulaId}/alunos/${alunoId}`, 'POST');
          ToastSystem.show('Aluno vinculado com sucesso', 'success');
          // Recarregar os detalhes
          document.body.removeChild(modal);
          AulaSystem.viewDetails(aulaId);
        } catch (error) {
          ToastSystem.show(`Erro ao vincular aluno: ${error.message}`, 'error');
        }
      });

      // Desvincular aluno
      modal.querySelectorAll('#alunos-vinculados .delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const alunoId = btn.getAttribute('data-aluno-id');
          try {
            await ApiService.request(`/aulas/${aulaId}/alunos/${alunoId}`, 'DELETE');
            ToastSystem.show('Aluno desvinculado com sucesso', 'success');
            // Recarregar os detalhes
            document.body.removeChild(modal);
            AulaSystem.viewDetails(aulaId);
          } catch (error) {
            ToastSystem.show(`Erro ao desvincular aluno: ${error.message}`, 'error');
          }
        });
      });

    } catch (error) {
      console.error('Erro ao carregar detalhes da aula:', error);
      ToastSystem.show(`Erro ao carregar detalhes da aula: ${error.message}`, 'error');
    }
  }
};

// ==============================================================
// MÓDULO FINANCEIRO
// ==============================================================

/**
 * Sistema de gerenciamento financeiro
 */
const FinanceiroSystem = {
  /**
   * Processa um pagamento
   * @param {string} paymentId - ID do pagamento
   */
  processPayment: async (paymentId) => {
    try {
      await ApiService.request(`/financeiro/${paymentId}/pagar`, 'POST', {
        data_pagamento: new Date().toISOString()
      });

      ToastSystem.show('Pagamento processado com sucesso!', 'success');
      NavigationSystem.reloadCurrentSection();
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      ToastSystem.show(`Erro ao processar pagamento: ${error.message}`, 'error');
    }
  }
};

// ==============================================================
// MÓDULO DE RELATÓRIOS
// ==============================================================

/**
 * Sistema de geração de relatórios
 */
const ReportSystem = {
  /**
   * Gera um relatório
   */
  generate: async () => {
    const reportType = document.getElementById('reportType').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    // Validação básica
    if (!startDate || !endDate) {
      ToastSystem.show('Por favor, selecione as datas de início e fim.', 'warning');
      return;
    }

    try {
      const results = document.getElementById('reportResults');
      results.innerHTML = '<p class="loading">Gerando relatório...</p>';

      // Simular requisição à API
      setTimeout(() => {
        let reportContent = '';

        switch (reportType) {
          case 'financial':
            reportContent = `
                                    <h4>Relatório Financeiro</h4>
                                    <p>Período: ${Utils.formatDate(startDate)} a ${Utils.formatDate(endDate)}</p>
                                    <div class="report-summary">
                                        <div class="summary-item">
                                            <h5>Receita Total</h5>
                                            <p>${Utils.formatCurrency(15420)}</p>
                                        </div>
                                        <div class="summary-item">
                                            <h5>Repasses a Professores</h5>
                                            <p>${Utils.formatCurrency(10794)}</p>
                                        </div>
                                        <div class="summary-item">
                                            <h5>Lucro Líquido</h5>
                                            <p>${Utils.formatCurrency(4626)}</p>
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
                                            <tr><td>Jan/2023</td><td>${Utils.formatCurrency(12400)}</td><td>${Utils.formatCurrency(8680)}</td><td>${Utils.formatCurrency(3720)}</td></tr>
                                            <tr><td>Fev/2023</td><td>${Utils.formatCurrency(13850)}</td><td>${Utils.formatCurrency(9695)}</td><td>${Utils.formatCurrency(4155)}</td></tr>
                                            <tr><td>Mar/2023</td><td>${Utils.formatCurrency(15420)}</td><td>${Utils.formatCurrency(10794)}</td><td>${Utils.formatCurrency(4626)}</td></tr>
                                        </tbody>
                                    </table>
                                `;
            break;

          case 'classes':
            reportContent = `
                                    <h4>Relatório de Aulas</h4>
                                    <p>Período: ${Utils.formatDate(startDate)} a ${Utils.formatDate(endDate)}</p>
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
        ToastSystem.show('Relatório gerado com sucesso', 'success');
      }, 1500);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      document.getElementById('reportResults').innerHTML = '<p class="error">Erro ao gerar relatório.</p>';
      ToastSystem.show('Erro ao gerar relatório', 'error');
    }
  }
};

// ==============================================================
// MÓDULO DE MENU MOBILE
// ==============================================================

/**
 * Sistema de menu mobile
 */
const MobileMenuSystem = {
  /**
   * Configura o menu mobile
   */
  setup: () => {
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
};

// ==============================================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ==============================================================

/**
 * Configura os event listeners da aplicação
 */
const setupEventListeners = () => {
  ToastSystem.init();
  MobileMenuSystem.setup();

  // Login
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', AuthSystem.handleLogin);
  }

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', AuthSystem.handleLogout);
  }

  // Navegação do menu
  document.querySelectorAll('.menu li').forEach(item => {
    if (item.id !== 'logoutBtn') {
      item.addEventListener('click', () => {
        const section = item.getAttribute('data-section');
        NavigationSystem.changeSection(section);
      });
    }
  });

  // Botão adicionar
  if (DomElements.addButton) {
    DomElements.addButton.addEventListener('click', () => {
      AppState.editingId = null;
      ModalSystem.show('add', Utils.getEntityApiName(AppState.currentSection));
    });
  }

  // Fechar modais
  document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', ModalSystem.close);
  });

  // Pesquisa
  if (DomElements.searchInput) {
    DomElements.searchInput.addEventListener('input', Utils.debounce(() => {
      TableSystem.filter(DomElements.searchInput.value, `${AppState.currentSection}Table`);
    }, 300));
  }

  // Geração de relatórios
  const generateReportBtn = document.getElementById('generateReportBtn');
  if (generateReportBtn) {
    generateReportBtn.addEventListener('click', ReportSystem.generate);
  }

  // Configurar evento de submit do formulário modal
  const modalForm = document.getElementById('modalForm');
  if (modalForm) {
    modalForm.addEventListener('submit', function (e) {
      e.preventDefault();
      ModalSystem.handleSubmit(AppState.currentEntity, AppState.currentAction);
    });
  }

  // Confirmar ação modal
  const confirmAction = document.getElementById('confirmAction');
  if (confirmAction) {
    confirmAction.addEventListener('click', ModalSystem.handleConfirm);
  }

  // Cancelar ação modal
  const confirmCancel = document.getElementById('confirmCancel');
  if (confirmCancel) {
    confirmCancel.addEventListener('click', ModalSystem.close);
  }
};

/**
 * Inicializa a aplicação
 */
const initApp = async () => {
  // Mostra o loader
  loader.style.display = 'flex';
  loginContainer.style.display = 'none';
  mainSystem.style.display = 'none';
  // Verificar se há um token salvo
  const token = localStorage.getItem('authToken');

  // Testar conexão com API primeiro
  const apiConnected = await ApiService.testConnection();

  loader.style.display = 'none';
  if (token && apiConnected) {
    // Verificar se o token é válido
    AuthSystem.validateToken(token);
  } else {
    AuthSystem.showLogin();
  }

  // Configurar eventos
  setupEventListeners();
  ToastSystem.show('Sistema carregado', 'success');
};

// Iniciar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', initApp);

// ==============================================================
// EXPOSIÇÃO DE MÓDULOS PARA USO GLOBAL (apenas para debug)
// ==============================================================

window.App = {
  Config: AppConfig,
  State: AppState,
  Utils: Utils,
  Api: ApiService,
  Toast: ToastSystem,
  Table: TableSystem,
  Modal: ModalSystem,
  Navigation: NavigationSystem,
  Auth: AuthSystem,
  Dashboard: DashboardSystem,
  Aula: AulaSystem,
  Financeiro: FinanceiroSystem,
  Report: ReportSystem,
  MobileMenu: MobileMenuSystem
};

console.log('Sistema carregado. Módulos disponíveis em window.App');
