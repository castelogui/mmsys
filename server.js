const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const fs = require('fs');

// ==============================================================
// CONFIGURAÇÕES E INICIALIZAÇÃO
// ==============================================================

const app = express();

// Configurações de segurança
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 200
});
app.use(limiter);

// Middlewares
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Log de requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Content Security Policy
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; " +
    "img-src 'self' https://images.unsplash.com data:; " +
    "script-src 'self' https://cdn.jsdelivr.net; " +
    "style-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'; " +
    "font-src 'self' https://cdnjs.cloudflare.com data:; " +
    "connect-src 'self';"
  );
  next();
});

// ==============================================================
// BANCO DE DADOS - MÓDULO
// ==============================================================

const Database = {
  db: null,
  isPostgreSQL: process.env.NODE_ENV === 'production',

  /**
   * Inicializa a conexão com o banco de dados
   */
  initialize: async function () {
    if (this.isPostgreSQL) {
      // Configuração PostgreSQL para produção
      const { Client } = require('pg');
      this.db = new Client({
        connectionString: process.env.DATABASE_URL || "postgresql://postgres:[YOUR-PASSWORD]@db.raxextmpojeoxncbuqtu.supabase.co:5432/postgres",
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      try {
        await this.db.connect();
        console.log('Conectado ao PostgreSQL com sucesso');
        await this.createTables();
      } catch (err) {
        console.error('Erro ao conectar ao PostgreSQL:', err);
      }
    } else {
      // Configuração SQLite para desenvolvimento
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = './database/sqlite.db';

      // Garantir que o diretório existe
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Erro ao conectar ao SQLite:', err.message);
        } else {
          console.log('Conectado ao SQLite com sucesso');
          this.createTables();
        }
      });
    }
  },

  /**
   * Cria as tabelas do banco de dados
   */
  createTables: async function () {
    const tablesSQLite = [
      `CREATE TABLE IF NOT EXISTS professores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        telefone TEXT,
        especialidade TEXT,
        limite_alunos INTEGER DEFAULT 5,
        porcentagem_repassa INTEGER DEFAULT 70,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS alunos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        telefone TEXT,
        data_nascimento TEXT,
        instrumento_principal TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS aulas_configuradas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instrumento TEXT NOT NULL,
        turno TEXT NOT NULL CHECK(turno IN ('manhã', 'tarde', 'noite')),
        professor_id INTEGER NOT NULL,
        data_inicio TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (professor_id) REFERENCES professores (id)
      )`,

      `CREATE TABLE IF NOT EXISTS aulas_dias_semana (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aula_id INTEGER NOT NULL,
        dia_semana INTEGER NOT NULL CHECK(dia_semana BETWEEN 0 AND 6),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aula_id) REFERENCES aulas_configuradas (id) ON DELETE CASCADE,
        UNIQUE(aula_id, dia_semana)
      )`,

      `CREATE TABLE IF NOT EXISTS aulas_alunos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aula_id INTEGER NOT NULL,
        aluno_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aula_id) REFERENCES aulas_configuradas (id) ON DELETE CASCADE,
        FOREIGN KEY (aluno_id) REFERENCES alunos (id) ON DELETE CASCADE,
        UNIQUE(aula_id, aluno_id)
      )`,

      `CREATE TABLE IF NOT EXISTS aulas_agendadas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          aula_configurada_id INTEGER NOT NULL,
          data_aula DATE NOT NULL,
          status TEXT DEFAULT 'agendada' CHECK(status IN ('agendada', 'cancelada', 'realizada', 'reagendada')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (aula_configurada_id) REFERENCES aulas_configuradas (id) ON DELETE CASCADE,
          UNIQUE(aula_configurada_id, data_aula)
      )`,

      `CREATE TABLE IF NOT EXISTS aulas_reagendamentos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          aula_agendada_id INTEGER NOT NULL,
          nova_data DATE NOT NULL,
          motivo TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (aula_agendada_id) REFERENCES aulas_agendadas (id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS pagamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER,
        valor REAL NOT NULL,
        data_vencimento TEXT,
        data_pagamento TEXT,
        status TEXT DEFAULT 'pendente',
        valor_repasse REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aluno_id) REFERENCES alunos (id)
      )`
    ];

    const tablesPostgreSQL = [
      `CREATE TABLE IF NOT EXISTS professores (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        telefone TEXT,
        especialidade TEXT,
        limite_alunos INTEGER DEFAULT 5,
        porcentagem_repassa INTEGER DEFAULT 70,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS alunos (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        telefone TEXT,
        data_nascimento TEXT,
        instrumento_principal TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS aulas_configuradas (
        id SERIAL PRIMARY KEY,
        instrumento TEXT NOT NULL,
        turno TEXT NOT NULL CHECK(turno IN ('manhã', 'tarde', 'noite')),
        professor_id INTEGER NOT NULL,
        data_inicio TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (professor_id) REFERENCES professores (id)
      )`,

      `CREATE TABLE IF NOT EXISTS aulas_dias_semana (
        id SERIAL PRIMARY KEY,
        aula_id INTEGER NOT NULL,
        dia_semana INTEGER NOT NULL CHECK(dia_semana BETWEEN 0 AND 6),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aula_id) REFERENCES aulas_configuradas (id) ON DELETE CASCADE,
        UNIQUE(aula_id, dia_semana)
      )`,

      `CREATE TABLE IF NOT EXISTS aulas_alunos (
        id SERIAL PRIMARY KEY,
        aula_id INTEGER NOT NULL,
        aluno_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aula_id) REFERENCES aulas_configuradas (id) ON DELETE CASCADE,
        FOREIGN KEY (aluno_id) REFERENCES alunos (id) ON DELETE CASCADE,
        UNIQUE(aula_id, aluno_id)
      )`,

      `CREATE TABLE IF NOT EXISTS aulas_agendadas (
          id SERIAL PRIMARY KEY,
          aula_configurada_id INTEGER NOT NULL,
          data_aula DATE NOT NULL,
          status TEXT DEFAULT 'agendada' CHECK(status IN ('agendada', 'cancelada', 'realizada', 'reagendada')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (aula_configurada_id) REFERENCES aulas_configuradas (id) ON DELETE CASCADE,
          UNIQUE(aula_configurada_id, data_aula)
      )`,

      `CREATE TABLE IF NOT EXISTS aulas_reagendamentos (
          id SERIAL PRIMARY KEY,
          aula_agendada_id INTEGER NOT NULL,
          nova_data DATE NOT NULL,
          motivo TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (aula_agendada_id) REFERENCES aulas_agendadas (id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS pagamentos (
        id SERIAL PRIMARY KEY,
        aluno_id INTEGER,
        valor REAL NOT NULL,
        data_vencimento TEXT,
        data_pagamento TEXT,
        status TEXT DEFAULT 'pendente',
        valor_repasse REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aluno_id) REFERENCES alunos (id)
      )`
    ];

    try {
      if (this.isPostgreSQL) {
        for (const tableSQL of tablesPostgreSQL) {
          await this.db.query(tableSQL);
        }
      } else {
        for (const tableSQL of tablesSQLite) {
          this.db.run(tableSQL);
        }
      }
      console.log('Tabelas verificadas/criadas com sucesso');
    } catch (err) {
      console.error('Erro ao criar tabelas:', err);
    }
  },

  /**
   * Executa uma query no banco de dados
   * @param {string} sql - Query SQL
   * @param {Array} params - Parâmetros da query
   * @returns {Promise} Promise com o resultado
   */
  run: function (sql, params = []) {
    if (this.isPostgreSQL) {
      return this.db.query(sql, params)
        .then(result => ({ id: result.rows[0]?.id, changes: result.rowCount }))
        .catch(err => { throw err; });
    } else {
      return new Promise((resolve, reject) => {
        this.db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, changes: this.changes });
        });
      });
    }
  },

  /**
   * Executa uma query e retorna uma única linha
   * @param {string} sql - Query SQL
   * @param {Array} params - Parâmetros da query
   * @returns {Promise} Promise com o resultado
   */
  get: function (sql, params = []) {
    if (this.isPostgreSQL) {
      return this.db.query(sql, params)
        .then(result => result.rows[0])
        .catch(err => { throw err; });
    } else {
      return new Promise((resolve, reject) => {
        this.db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    }
  },

  /**
   * Executa uma query e retorna todas as linhas
   * @param {string} sql - Query SQL
   * @param {Array} params - Parâmetros da query
   * @returns {Promise} Promise com o resultado
   */
  all: function (sql, params = []) {
    if (this.isPostgreSQL) {
      return this.db.query(sql, params)
        .then(result => result.rows)
        .catch(err => { throw err; });
    } else {
      return new Promise((resolve, reject) => {
        this.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  }
};

// Inicializar o banco de dados
Database.initialize();

// ==============================================================
// UTILITÁRIOS
// ==============================================================

const Utils = {
  /**
   * Valida dados com base em regras específicas
   * @param {Object} data - Dados a serem validados
   * @param {Object} validations - Regras de validação
   * @returns {Array} Lista de erros de validação
   */
  validateData: function (data, validations) {
    const errors = [];

    for (const [field, validation] of Object.entries(validations)) {
      if (validation.required && !data[field]) {
        errors.push(`O campo ${field} é obrigatório`);
      }

      if (data[field] && validation.type && typeof data[field] !== validation.type) {
        errors.push(`O campo ${field} deve ser do tipo ${validation.type}`);
      }

      if (data[field] && validation.min && data[field] < validation.min) {
        errors.push(`O campo ${field} deve ser no mínimo ${validation.min}`);
      }

      if (data[field] && validation.max && data[field] > validation.max) {
        errors.push(`O campo ${field} deve ser no máximo ${validation.max}`);
      }

      if (data[field] && validation.pattern && !validation.pattern.test(data[field])) {
        errors.push(`O campo ${field} está em um formato inválido`);
      }
    }

    return errors;
  },

  /**
   * Filtra um objeto mantendo apenas as chaves permitidas
   * @param {Object} data - Objeto a ser filtrado
   * @param {Array} allowedFields - Campos permitidos
   * @returns {Object} Objeto filtrado
   */
  filterObject: function (data, allowedFields) {
    const filtered = {};
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        filtered[field] = data[field];
      }
    });
    return filtered;
  }
};

// ==============================================================
// HANDLERS GENÉRICOS PARA CRUD
// ==============================================================

const GenericHandlers = {
  /**
   * Cria handlers CRUD genéricos para uma entidade
   * @param {string} entityName - Nime da entidade (singular)
   * @param {string} tableName - Nome da tabela no banco
   * @param {Array} fields - Campos permitidos para criação/atualização
   * @param {Object} validations - Validações específicas por campo
   */
  create: function (entityName, tableName, fields, validations = {}) {
    return {
      // GET all
      getAll: async (req, res) => {
        try {
          const rows = await Database.all(`SELECT * FROM ${tableName}`);
          res.json({ [entityName + 's']: rows });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      },

      // GET by ID
      getById: async (req, res) => {
        try {
          const { id } = req.params;
          const row = await Database.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);

          if (!row) {
            return res.status(404).json({ error: `${entityName} não encontrado` });
          }

          res.json(row);
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      },

      // POST - Create
      create: async (req, res) => {
        try {
          const data = Utils.filterObject(req.body, fields);

          // Validações
          const validationErrors = Utils.validateData(data, validations);
          if (validationErrors.length > 0) {
            return res.status(400).json({ errors: validationErrors });
          }

          const columns = Object.keys(data).join(', ');
          const placeholders = Object.keys(data).map(() => '?').join(', ');
          const values = Object.values(data);

          const result = await Database.run(
            `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
            values
          );

          res.status(201).json({
            id: result.id,
            message: `${entityName} criado com sucesso`
          });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      },

      // PUT - Update
      update: async (req, res) => {
        try {
          const { id } = req.params;

          // Verificar se existe
          const existing = await Database.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
          if (!existing) {
            return res.status(404).json({ error: `${entityName} não encontrado` });
          }

          // Filtrar apenas campos permitidos
          const data = Utils.filterObject(req.body, fields);

          // Validações
          const validationErrors = Utils.validateData(data, validations);
          if (validationErrors.length > 0) {
            return res.status(400).json({ errors: validationErrors });
          }

          if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'Nenhum campo válido para atualização' });
          }

          const setClause = Object.keys(data).map(field => `${field} = ?`).join(', ');
          const values = [...Object.values(data), id];

          const result = await Database.run(
            `UPDATE ${tableName} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            values
          );

          res.json({
            message: `${entityName} atualizado com sucesso`,
            changes: result.changes
          });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      },

      // DELETE
      delete: async (req, res) => {
        try {
          const { id } = req.params;
          const result = await Database.run(`DELETE FROM ${tableName} WHERE id = ?`, [id]);

          if (result.changes === 0) {
            return res.status(404).json({ error: `${entityName} não encontrado` });
          }

          res.json({ message: `${entityName} excluído com sucesso` });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      }
    };
  }
};

// ==============================================================
// ROTAS GENÉRICAS
// ==============================================================

// Rotas para Alunos
const alunosHandlers = GenericHandlers.create(
  'aluno', 'alunos',
  ['nome', 'email', 'telefone', 'data_nascimento', 'instrumento_principal'],
  {
    nome: { required: true, type: 'string' },
    email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    telefone: { type: 'string' },
    data_nascimento: { type: 'string' },
    instrumento_principal: { type: 'string' }
  }
);

app.get('/api/alunos', alunosHandlers.getAll);
app.get('/api/alunos/:id', alunosHandlers.getById);
app.post('/api/alunos', alunosHandlers.create);
app.put('/api/alunos/:id', alunosHandlers.update);
app.delete('/api/alunos/:id', alunosHandlers.delete);

// Rotas para Professores
const professoresHandlers = GenericHandlers.create(
  'professore', 'professores',
  ['nome', 'email', 'telefone', 'especialidade', 'limite_alunos', 'porcentagem_repassa'],
  {
    nome: { required: true, type: 'string' },
    email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    telefone: { type: 'string' },
    especialidade: { type: 'string' },
    limite_alunos: { type: 'number', min: 1, max: 20 },
    porcentagem_repassa: { type: 'number', min: 1, max: 100 }
  }
);

app.get('/api/professores', professoresHandlers.getAll);
app.get('/api/professores/:id', professoresHandlers.getById);
app.post('/api/professores', professoresHandlers.create);
app.put('/api/professores/:id', professoresHandlers.update);
app.delete('/api/professores/:id', professoresHandlers.delete);

// ==============================================================
// HANDLERS ESPECÍFICOS PARA AULAS
// ==============================================================

const AulasHandlers = {
  /**
   * Configura uma nova aula
   */
  configurar: async (req, res) => {
    try {
      const { instrumento, turno, professor_id, data_inicio, dias_semana } = req.body;

      // Validações básicas
      if (!instrumento || !turno || !professor_id || !data_inicio || !dias_semana || !Array.isArray(dias_semana) || dias_semana.length === 0) {
        return res.status(400).json({ error: 'Instrumento, turno, professor, data de início e dias da semana são obrigatórios' });
      }

      if (!['manhã', 'tarde', 'noite'].includes(turno)) {
        return res.status(400).json({ error: 'Turno deve ser "manhã", "tarde" ou "noite"' });
      }

      // Verificar se o professor existe
      const professor = await Database.get('SELECT * FROM professores WHERE id = ?', [professor_id]);
      if (!professor) {
        return res.status(404).json({ error: 'Professor não encontrado' });
      }

      // Inserir a configuração da aula
      const result = await Database.run(
        'INSERT INTO aulas_configuradas (instrumento, turno, professor_id, data_inicio) VALUES (?, ?, ?, ?)',
        [instrumento, turno, professor_id, data_inicio]
      );

      const aulaId = result.id;

      // Inserir os dias da semana
      for (const dia of dias_semana) {
        if (dia < 0 || dia > 6) {
          // Se houver erro, remover a aula criada
          await Database.run('DELETE FROM aulas_configuradas WHERE id = ?', [aulaId]);
          return res.status(400).json({ error: 'Dia da semana deve estar entre 0 (domingo) e 6 (sábado)' });
        }

        await Database.run(
          'INSERT INTO aulas_dias_semana (aula_id, dia_semana) VALUES (?, ?)',
          [aulaId, dia]
        );
      }

      // Após inserir os dias da semana, adicione:
      // Gerar agendamento para as próximas 4 semanas
      const dataInicio = new Date(data_inicio);
      for (let semana = 0; semana < 4; semana++) {
        for (const dia of dias_semana) {
          // Calcular data da aula (dia da semana + semana)
          const dataAula = new Date(dataInicio);
          const diffDias = (dia - dataAula.getDay() + 7) % 7 + (semana * 7);
          dataAula.setDate(dataAula.getDate() + diffDias);

          // Inserir agendamento
          await Database.run(
            'INSERT INTO aulas_agendadas (aula_configurada_id, data_aula) VALUES (?, ?)',
            [aulaId, dataAula.toISOString().split('T')[0]]
          );
        }
      }

      res.status(201).json({
        id: aulaId,
        message: 'Aula configurada com sucesso'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Lista todas as aulas configuradas
   */
  listarConfiguradas: async (req, res) => {
    try {
      // Ajustar a query para funcionar em ambos os bancos
      const isPostgreSQL = Database.isPostgreSQL;
      const groupConcatFunction = isPostgreSQL ? 'STRING_AGG' : 'GROUP_CONCAT';
      const groupConcatParams = isPostgreSQL ? 'DISTINCT ads.dia_semana::text, \',\')' : 'DISTINCT ads.dia_semana';

      const query = `
        SELECT 
          ac.*,
          p.nome as professor_nome,
          ${groupConcatFunction}(${groupConcatParams}) as dias_semana,
          COUNT(DISTINCT aa.aluno_id) as total_alunos,
          COUNT(DISTINCT ag.id) as total_agendadas,
          SUM(CASE WHEN ag.status = 'cancelada' THEN 1 ELSE 0 END) as total_canceladas
        FROM aulas_configuradas ac
        LEFT JOIN professores p ON ac.professor_id = p.id
        LEFT JOIN aulas_dias_semana ads ON ac.id = ads.aula_id
        LEFT JOIN aulas_alunos aa ON ac.id = aa.aula_id
        LEFT JOIN aulas_agendadas ag ON ac.id = ag.aula_configurada_id
        GROUP BY ac.id ${isPostgreSQL ? ', p.nome' : ''}
        ORDER BY ac.created_at DESC
      `;

      const rows = await Database.all(query);

      // Processar os dias da semana
      const aulas = rows.map(aula => {
        return {
          ...aula,
          dias_semana: aula.dias_semana ? aula.dias_semana.split(',').map(Number) : []
        };
      });

      res.json({ aulas: aulas });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Obtém detalhes de uma aula específica
   */
  obterDetalhes: async (req, res) => {
    try {
      const { id } = req.params;

      // Obter informações da aula
      const aulaQuery = `
        SELECT 
          ac.*,
          p.nome as professor_nome,
          p.especialidade as professor_especialidade
        FROM aulas_configuradas ac
        LEFT JOIN professores p ON ac.professor_id = p.id
        WHERE ac.id = ?
      `;

      const aula = await Database.get(aulaQuery, [id]);
      if (!aula) {
        return res.status(404).json({ error: 'Aula não encontrada' });
      }

      // Obter dias da semana
      const diasRows = await Database.all(
        'SELECT dia_semana FROM aulas_dias_semana WHERE aula_id = ?',
        [id]
      );
      const dias_semana = diasRows.map(row => row.dia_semana);

      // Obter alunos vinculados
      const alunosRows = await Database.all(
        `SELECT 
          a.id,
          a.nome,
          a.email,
          a.instrumento_principal
        FROM aulas_alunos aa
        LEFT JOIN alunos a ON aa.aluno_id = a.id
        WHERE aa.aula_id = ?`,
        [id]
      );

      res.json({
        ...aula,
        dias_semana,
        alunos: alunosRows
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Vincula um aluno a uma aula
   */
  vincularAluno: async (req, res) => {
    try {
      const { aulaId, alunoId } = req.params;

      // Verificar se a aula existe
      const aula = await Database.get('SELECT * FROM aulas_configuradas WHERE id = ?', [aulaId]);
      if (!aula) {
        return res.status(404).json({ error: 'Aula não encontrada' });
      }

      // Verificar se o aluno existe
      const aluno = await Database.get('SELECT * FROM alunos WHERE id = ?', [alunoId]);
      if (!aluno) {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }

      // Verificar se o aluno já está vinculado a esta aula
      const vinculo = await Database.get(
        'SELECT * FROM aulas_alunos WHERE aula_id = ? AND aluno_id = ?',
        [aulaId, alunoId]
      );

      if (vinculo) {
        return res.status(400).json({ error: 'Aluno já está vinculado a esta aula' });
      }

      // Vincular aluno à aula
      await Database.run(
        'INSERT INTO aulas_alunos (aula_id, aluno_id) VALUES (?, ?)',
        [aulaId, alunoId]
      );

      res.status(201).json({ message: 'Aluno vinculado à aula com sucesso' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Desvincula um aluno de uma aula
   */
  desvincularAluno: async (req, res) => {
    try {
      const { aulaId, alunoId } = req.params;

      const result = await Database.run(
        'DELETE FROM aulas_alunos WHERE aula_id = ? AND aluno_id = ?',
        [aulaId, alunoId]
      );

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Vínculo não encontrado' });
      }

      res.json({ message: 'Aluno desvinculado da aula com sucesso' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Obtém todas as aulas de um aluno
   */
  obterAulasAluno: async (req, res) => {
    try {
      const { alunoId } = req.params;

      // Ajustar a query para funcionar em ambos os bancos
      const isPostgreSQL = Database.isPostgreSQL;
      const groupConcatFunction = isPostgreSQL ? 'STRING_AGG' : 'GROUP_CONCAT';
      const groupConcatParams = isPostgreSQL ? 'ads.dia_semana::text, \',\')' : 'ads.dia_semana';

      const query = `
        SELECT 
          ac.*,
          p.nome as professor_nome,
          p.especialidade as professor_especialidade,
          ${groupConcatFunction}(${groupConcatParams}) as dias_semana
        FROM aulas_alunos aa
        LEFT JOIN aulas_configuradas ac ON aa.aula_id = ac.id
        LEFT JOIN professores p ON ac.professor_id = p.id
        LEFT JOIN aulas_dias_semana ads ON ac.id = ads.aula_id
        WHERE aa.aluno_id = ?
        GROUP BY ac.id ${isPostgreSQL ? ', p.nome, p.especialidade' : ''}
        ORDER BY ac.created_at DESC
      `;

      const rows = await Database.all(query, [alunoId]);

      // Processar os dias da semana
      const aulas = rows.map(aula => {
        return {
          ...aula,
          dias_semana: aula.dias_semana ? aula.dias_semana.split(',').map(Number) : []
        };
      });

      res.json({ aulas: aulas });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Obtém todas as aulas de um professor
   */
  obterAulasProfessor: async (req, res) => {
    try {
      const { professorId } = req.params;

      // Ajustar a query para funcionar em ambos os bancos
      const isPostgreSQL = Database.isPostgreSQL;
      const groupConcatFunction = isPostgreSQL ? 'STRING_AGG' : 'GROUP_CONCAT';
      const groupConcatParams = isPostgreSQL ? 'ads.dia_semana::text, \',\')' : 'ads.dia_semana';

      const query = `
        SELECT 
          ac.*,
          ${groupConcatFunction}(${groupConcatParams}) as dias_semana,
          COUNT(aa.aluno_id) as total_alunos
        FROM aulas_configuradas ac
        LEFT JOIN aulas_dias_semana ads ON ac.id = ads.aula_id
        LEFT JOIN aulas_alunos aa ON ac.id = aa.aula_id
        WHERE ac.professor_id = ?
        GROUP BY ac.id
        ORDER BY ac.created_at DESC
      `;

      const rows = await Database.all(query, [professorId]);

      // Processar os dias da semana
      const aulas = rows.map(aula => {
        return {
          ...aula,
          dias_semana: aula.dias_semana ? aula.dias_semana.split(',').map(Number) : []
        };
      });

      res.json({ aulas: aulas });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Atualiza uma aula configurada
   */
  atualizarAula: async (req, res) => {
    try {
      const { id } = req.params;
      const { instrumento, turno, data_inicio, dias_semana } = req.body;

      // Verificar se a aula existe
      const aula = await Database.get('SELECT * FROM aulas_configuradas WHERE id = ?', [id]);
      if (!aula) {
        return res.status(404).json({ error: 'Aula não encontrada' });
      }

      const updates = [];
      const values = [];

      if (instrumento !== undefined) {
        updates.push('instrumento = ?');
        values.push(instrumento);
      }
      if (turno !== undefined) {
        if (!['manhã', 'tarde', 'noite'].includes(turno)) {
          return res.status(400).json({ error: 'Turno deve ser "manhã", "tarde" ou "noite"' });
        }
        updates.push('turno = ?');
        values.push(turno);
      }
      if (data_inicio !== undefined) {
        updates.push('data_inicio = ?');
        values.push(data_inicio);
      }

      if (updates.length === 0 && !dias_semana) {
        return res.status(400).json({ error: 'Nenhum campo válido para atualização' });
      }

      // Atualizar dados básicos da aula, se houver
      if (updates.length > 0) {
        values.push(id);
        await Database.run(
          `UPDATE aulas_configuradas SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          values
        );
      }

      // Atualizar dias da semana, se fornecidos
      if (dias_semana && Array.isArray(dias_semana)) {
        // Remover dias existentes
        await Database.run('DELETE FROM aulas_dias_semana WHERE aula_id = ?', [id]);

        // Inserir novos dias
        for (const dia of dias_semana) {
          if (dia < 0 || dia > 6) {
            return res.status(400).json({ error: 'Dia da semana deve estar entre 0 (domingo) e 6 (sábado)' });
          }

          await Database.run(
            'INSERT INTO aulas_dias_semana (aula_id, dia_semana) VALUES (?, ?)',
            [id, dia]
          );
        }
      }

      res.json({ message: 'Aula atualizada com sucesso' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Exclui uma aula configurada
   */
  excluirAula: async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar se a aula existe
      const aula = await Database.get('SELECT * FROM aulas_configuradas WHERE id = ?', [id]);
      if (!aula) {
        return res.status(404).json({ error: 'Aula não encontrada' });
      }

      // Excluir a aula (as chaves estrangeiras com CASCADE cuidarão dos registros relacionados)
      await Database.run('DELETE FROM aulas_configuradas WHERE id = ?', [id]);

      res.json({ message: 'Aula excluída com sucesso' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
 * Gera o agendamento de aulas com base na configuração
 */
  gerarAgendamento: async (req, res) => {
    try {
      const { id } = req.params;
      const { semanas } = req.body; // Número de semanas a gerar

      // Verificar se a aula existe
      const aula = await Database.get('SELECT * FROM aulas_configuradas WHERE id = ?', [id]);
      if (!aula) {
        return res.status(404).json({ error: 'Aula não encontrada' });
      }

      // Obter dias da semana configurados
      const diasRows = await Database.all(
        'SELECT dia_semana FROM aulas_dias_semana WHERE aula_id = ?',
        [id]
      );
      const dias_semana = diasRows.map(row => row.dia_semana);

      if (dias_semana.length === 0) {
        return res.status(400).json({ error: 'Aula não possui dias da semana configurados' });
      }

      const dataInicio = new Date(aula.data_inicio);
      const agendamentos = [];

      // Gerar agendamentos para as próximas semanas
      for (let semana = 0; semana < (semanas || 4); semana++) {
        for (const dia of dias_semana) {
          // Calcular data da aula (dia da semana + semana)
          const dataAula = new Date(dataInicio);
          const diffDias = (dia - dataAula.getDay() + 7) % 7 + (semana * 7);
          dataAula.setDate(dataAula.getDate() + diffDias);

          // Verificar se já existe agendamento para esta data
          const existe = await Database.get(
            'SELECT id FROM aulas_agendadas WHERE aula_configurada_id = ? AND data_aula = ?',
            [id, dataAula.toISOString().split('T')[0]]
          );

          if (!existe) {
            // Inserir agendamento
            const result = await Database.run(
              'INSERT INTO aulas_agendadas (aula_configurada_id, data_aula) VALUES (?, ?)',
              [id, dataAula.toISOString().split('T')[0]]
            );
            agendamentos.push({ id: result.id, data_aula: dataAula.toISOString().split('T')[0] });
          }
        }
      }

      res.json({
        message: `Agendamento gerado para ${agendamentos.length} aulas`,
        agendamentos
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Obtém o agendamento de aulas para um período
   */
  obterAgendamento: async (req, res) => {
    try {
      const { id } = req.params;
      const { data_inicio, data_fim } = req.query;

      // Verificar se a aula existe
      const aula = await Database.get('SELECT * FROM aulas_configuradas WHERE id = ?', [id]);
      if (!aula) {
        return res.status(404).json({ error: 'Aula não encontrada' });
      }

      let query = `
            SELECT aa.*, ar.nova_data, ar.motivo
            FROM aulas_agendadas aa
            LEFT JOIN aulas_reagendamentos ar ON aa.id = ar.aula_agendada_id
            WHERE aa.aula_configurada_id = ?
          `;
      let params = [id];

      if (data_inicio && data_fim) {
        query += ' AND aa.data_aula BETWEEN ? AND ?';
        params.push(data_inicio, data_fim);
      }

      query += ' ORDER BY aa.data_aula';

      const agendamentos = await Database.all(query, params);

      res.json({ agendamentos });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  obterUmAgendamento: async (req, res) => {
    try {
      const { id } = req.params;
      const agendamento = await Database.get(
        `SELECT aa.*, ac.instrumento, p.nome as professor_nome 
             FROM aulas_agendadas aa
             INNER JOIN aulas_configuradas ac ON aa.aula_configurada_id = ac.id
             INNER JOIN professores p ON ac.professor_id = p.id
             WHERE aa.id = ?`,
        [id]
      );

      if (!agendamento) {
        return res.status(404).json({ error: 'Agendamento não encontrado' });
      }

      res.json(agendamento);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Cancela uma aula agendada
   */
  cancelarAula: async (req, res) => {
    try {
      const { id } = req.params;
      const { motivo } = req.body;

      // Verificar se o agendamento existe
      const agendamento = await Database.get('SELECT * FROM aulas_agendadas WHERE id = ?', [id]);
      if (!agendamento) {
        return res.status(404).json({ error: 'Agendamento não encontrado' });
      }

      // Atualizar status para cancelada
      await Database.run(
        'UPDATE aulas_agendadas SET status = "cancelada", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );

      res.json({ message: 'Aula cancelada com sucesso' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Reagenda uma aula
   */
  reagendarAula: async (req, res) => {
    try {
      const { id } = req.params;
      const { nova_data, motivo } = req.body;

      // Verificar se o agendamento existe
      const agendamento = await Database.get('SELECT * FROM aulas_agendadas WHERE id = ?', [id]);
      if (!agendamento) {
        return res.status(404).json({ error: 'Agendamento não encontrado' });
      }

      // Verificar se a nova data é válida
      if (!nova_data || new Date(nova_data) <= new Date()) {
        return res.status(400).json({ error: 'Nova data inválida' });
      }

      // Registrar o reagendamento
      await Database.run(
        'INSERT INTO aulas_reagendamentos (aula_agendada_id, nova_data, motivo) VALUES (?, ?, ?)',
        [id, nova_data, motivo]
      );

      // Atualizar status do agendamento original
      await Database.run(
        'UPDATE aulas_agendadas SET status = "reagendada", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );

      // Criar novo agendamento para a nova data
      const result = await Database.run(
        'INSERT INTO aulas_agendadas (aula_configurada_id, data_aula, status) VALUES (?, ?, "agendada")',
        [agendamento.aula_configurada_id, nova_data]
      );

      res.json({
        message: 'Aula reagendada com sucesso',
        novo_agendamento_id: result.id
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Obtém a agenda semanal
   */
  obterAgendaSemanal: async (req, res) => {
    try {
      const { data_inicio } = req.query;

      // Se não fornecer data_início, usa a segunda-feira da semana atual
      let inicioSemana;
      if (data_inicio) {
        inicioSemana = new Date(data_inicio);
      } else {
        inicioSemana = new Date();
        // Ajustar para segunda-feira
        const dia = inicioSemana.getDay();
        const diff = inicioSemana.getDate() - dia + (dia === 0 ? -6 : 1);
        inicioSemana.setDate(diff);
      }

      // Calcular fim da semana (domingo)
      const fimSemana = new Date(inicioSemana);
      fimSemana.setDate(inicioSemana.getDate() + 6);

      const query = `
      SELECT 
        aa.*,
        ac.instrumento,
        ac.turno,
        p.nome as professor_nome,
        p.especialidade as professor_especialidade,
        ar.nova_data,
        ar.motivo
      FROM aulas_agendadas aa
      INNER JOIN aulas_configuradas ac ON aa.aula_configurada_id = ac.id
      INNER JOIN professores p ON ac.professor_id = p.id
      LEFT JOIN aulas_reagendamentos ar ON aa.id = ar.aula_agendada_id
      WHERE aa.data_aula BETWEEN ? AND ?
      ORDER BY aa.data_aula, ac.turno
    `;

      const agendamentos = await Database.all(query, [
        inicioSemana.toISOString().split('T')[0],
        fimSemana.toISOString().split('T')[0]
      ]);

      res.json({
        semana_inicio: inicioSemana.toISOString().split('T')[0],
        semana_fim: fimSemana.toISOString().split('T')[0],
        agendamentos
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

// ==============================================================
// ROTAS PARA AULAS
// ==============================================================

app.post('/api/aulas/configurar', AulasHandlers.configurar);
app.get('/api/aulas/configuradas', AulasHandlers.listarConfiguradas);
app.get('/api/aulas/configuradas/:id', AulasHandlers.obterDetalhes);
app.post('/api/aulas/:aulaId/alunos/:alunoId', AulasHandlers.vincularAluno);
app.delete('/api/aulas/:aulaId/alunos/:alunoId', AulasHandlers.desvincularAluno);
app.get('/api/alunos/:alunoId/aulas', AulasHandlers.obterAulasAluno);
app.get('/api/professores/:professorId/aulas', AulasHandlers.obterAulasProfessor);
app.put('/api/aulas/configuradas/:id', AulasHandlers.atualizarAula);
app.delete('/api/aulas/configuradas/:id', AulasHandlers.excluirAula);
// Rotas para agendamento de aulas
app.post('/api/aulas/configuradas/:id/gerar-agendamento', AulasHandlers.gerarAgendamento);
app.get('/api/aulas/configuradas/:id/agendamento', AulasHandlers.obterAgendamento);
app.put('/api/aulas/agendadas/:id/cancelar', AulasHandlers.cancelarAula);
app.put('/api/aulas/agendadas/:id/reagendar', AulasHandlers.reagendarAula);
app.get('/api/aulas/agenda-semanal', AulasHandlers.obterAgendaSemanal);
app.get('/api/aulas/agendadas/:id', AulasHandlers.obterUmAgendamento);

// ==============================================================
// HANDLERS PARA FINANCEIRO
// ==============================================================

const FinanceiroHandlers = {
  /**
   * Lista todos os pagamentos
   */
  listar: async (req, res) => {
    try {
      const query = `
        SELECT p.*, a.nome as aluno_nome 
        FROM pagamentos p 
        LEFT JOIN alunos a ON p.aluno_id = a.id
        ORDER BY p.data_vencimento DESC
      `;

      const rows = await Database.all(query);
      res.json({ pagamentos: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Obtém um pagamento específico
   */
  obter: async (req, res) => {
    try {
      const { id } = req.params;
      const query = `
        SELECT p.*, a.nome as aluno_nome 
        FROM pagamentos p 
        LEFT JOIN alunos a ON p.aluno_id = a.id
        WHERE p.id = ?
      `;

      const row = await Database.get(query, [id]);
      if (!row) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }

      res.json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Cria um novo pagamento
   */
  criar: async (req, res) => {
    try {
      const { aluno_id, valor, data_vencimento } = req.body;

      // Validações
      if (!aluno_id || !valor || !data_vencimento) {
        return res.status(400).json({ error: 'Aluno, valor e data de vencimento são obrigatórios' });
      }

      if (valor <= 0) {
        return res.status(400).json({ error: 'O valor deve ser maior que zero' });
      }

      const result = await Database.run(
        'INSERT INTO pagamentos (aluno_id, valor, data_vencimento) VALUES (?, ?, ?)',
        [aluno_id, valor, data_vencimento]
      );

      res.status(201).json({ id: result.id, message: 'Pagamento registrado com sucesso' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Atualiza um pagamento
   */
  atualizar: async (req, res) => {
    try {
      const { id } = req.params;
      const { aluno_id, valor, data_vencimento, status, data_pagamento, valor_repasse } = req.body;

      // Verificar se o pagamento existe
      const pagamento = await Database.get('SELECT * FROM pagamentos WHERE id = ?', [id]);
      if (!pagamento) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }

      const updates = [];
      const values = [];

      if (aluno_id !== undefined) {
        updates.push('aluno_id = ?');
        values.push(aluno_id);
      }
      if (valor !== undefined) {
        updates.push('valor = ?');
        values.push(valor);
      }
      if (data_vencimento !== undefined) {
        updates.push('data_vencimento = ?');
        values.push(data_vencimento);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        values.push(status);
      }
      if (data_pagamento !== undefined) {
        updates.push('data_pagamento = ?');
        values.push(data_pagamento);
      }
      if (valor_repasse !== undefined) {
        updates.push('valor_repasse = ?');
        values.push(valor_repasse);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo válido para atualização' });
      }

      values.push(id);
      const result = await Database.run(
        `UPDATE pagamentos SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      res.json({ message: 'Pagamento atualizado com sucesso', changes: result.changes });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Exclui um pagamento
   */
  excluir: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await Database.run('DELETE FROM pagamentos WHERE id = ?', [id]);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }

      res.json({ message: 'Pagamento excluído com sucesso' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Processa um pagamento
   */
  processarPagamento: async (req, res) => {
    try {
      const { id } = req.params;
      const { data_pagamento } = req.body;

      // Obter informações do pagamento e do aluno
      const pagamento = await Database.get(
        'SELECT p.*, a.nome as aluno_nome FROM pagamentos p LEFT JOIN alunos a ON p.aluno_id = a.id WHERE p.id = ?',
        [id]
      );

      if (!pagamento) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }

      // Obter a aula relacionada a este aluno para calcular o repasse
      const aula = await Database.get(
        'SELECT ac.*, p.porcentagem_repassa FROM aulas_alunos aa LEFT JOIN aulas_configuradas ac ON aa.aula_id = ac.id LEFT JOIN professores p ON ac.professor_id = p.id WHERE aa.aluno_id = ? LIMIT 1',
        [pagamento.aluno_id]
      );

      let valor_repasse = 0;
      if (aula && aula.porcentagem_repassa) {
        valor_repasse = pagamento.valor * (aula.porcentagem_repassa / 100);
      }

      // Atualizar o pagamento
      await Database.run(
        'UPDATE pagamentos SET status = "pago", data_pagamento = ?, valor_repasse = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [data_pagamento || new Date().toISOString(), valor_repasse, id]
      );

      res.json({ message: 'Pagamento processado com sucesso', valor_repasse });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

// ==============================================================
// ROTAS PARA FINANCEIRO
// ==============================================================

app.get('/api/financeiro', FinanceiroHandlers.listar);
app.get('/api/financeiro/:id', FinanceiroHandlers.obter);
app.post('/api/financeiro', FinanceiroHandlers.criar);
app.put('/api/financeiro/:id', FinanceiroHandlers.atualizar);
app.delete('/api/financeiro/:id', FinanceiroHandlers.excluir);
app.post('/api/financeiro/:id/pagar', FinanceiroHandlers.processarPagamento);

// ==============================================================
// ROTAS DE RELATÓRIOS
// ==============================================================

app.get('/api/relatorios/resumo', async (req, res) => {
  try {
    const isPostgreSQL = Database.isPostgreSQL;

    // Consultas compatíveis com ambos os bancos
    const queries = {
      totalAlunos: 'SELECT COUNT(*) as total FROM alunos',
      totalProfessores: 'SELECT COUNT(*) as total FROM professores',
      totalAulasConfiguradas: 'SELECT COUNT(*) as total FROM aulas_configuradas',
      receitaMensal: isPostgreSQL
        ? `SELECT SUM(valor) as total FROM pagamentos WHERE status = 'pago' AND EXTRACT(YEAR FROM data_pagamento) = EXTRACT(YEAR FROM NOW()) AND EXTRACT(MONTH FROM data_pagamento) = EXTRACT(MONTH FROM NOW())`
        : `SELECT SUM(valor) as total FROM pagamentos WHERE status = 'pago' AND strftime('%Y', data_pagamento) = strftime('%Y', 'now') AND strftime('%m', data_pagamento) = strftime('%m', 'now')`
    };

    const results = {};

    for (const [key, query] of Object.entries(queries)) {
      const row = await Database.get(query);
      results[key] = row ? row.total : 0;
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================
// MIDDLEWARE DE ERRO E ROTAS FINAIS
// ==============================================================

// Middleware de erro
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo deu errado!' });
});

// Rota para 404 - deve vir depois de todas as outras rotas
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint da API não encontrado' });
});

// Rota para servir a página HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==============================================================
// CONFIGURAÇÃO PARA VERCEL
// ==============================================================

module.exports = app;

// Se não estivermos na Vercel, iniciamos o servidor normalmente
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
  });
}