const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const fs = require('fs');

const app = express();

// ==================== CONFIGURAÇÕES DE SEGURANÇA ====================

// Helmet para headers de segurança
app.use(helmet());

// CORS para permitir requisições de diferentes origens
app.use(cors());

// Rate limiting para prevenir ataques de força bruta
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200 // limite de 100 requisições por IP a cada 15 minutos
});
app.use(limiter);

// Middlewares
app.use(bodyParser.json({ limit: '10mb' }));
// Servir arquivos estáticos - importante para a Vercel
app.use(express.static(path.join(__dirname, 'public')));

// Log de todas as requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ========== Configuração de Content Security Policy ========== 
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

// ==================== CONEXÃO COM BANCO DE DADOS ====================
// Na Vercel, usamos diretório temporário
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/sqlite.db' 
  : './database/sqlite.db';

// Garantir que o diretório existe
if (process.env.NODE_ENV !== 'production') {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let db;

// Função para inicializar o banco
function initializeDatabase() {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
      console.log('Conectado ao banco de dados SQLite.');
      createTables();
    }
  });
}

// ==================== INICIALIZAÇÃO DO BANCO ====================

function createTables() {
  const tables = [
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

  tables.forEach((tableSQL, index) => {
    db.run(tableSQL, (err) => {
      if (err) {
        console.error(`Erro ao criar tabela ${index + 1}:`, err.message);
      }
    });
  });
}

// Inicializar o banco de dados
initializeDatabase();

// ==================== API GENÉRICA ====================

/**
 * Cria rotas CRUD genéricas para uma entidade
 * @param {string} entityName - Nome da entidade (singular)
 * @param {string} tableName - Nome da tabela no banco
 * @param {Array} fields - Campos permitidos para criação/atualização
 * @param {Object} validations - Validações específicas por campo
 */
function createGenericRoutes(entityName, tableName, fields, validations = {}) {
  const basePath = `/api/${entityName}s`;

  // GET all
  app.get(basePath, (req, res) => {
    const query = `SELECT * FROM ${tableName}`;

    db.all(query, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ [entityName + 's']: rows });
    });
  });

  // GET by ID
  app.get(`${basePath}/:id`, (req, res) => {
    const { id } = req.params;

    db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: `${entityName} não encontrado` });
      }
      res.json(row);
    });
  });

  // POST - Create
  app.post(basePath, (req, res) => {
    // Filtrar apenas campos permitidos
    console.log(req.body);
    
    const data = {};
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    });

    // Validações
    const validationErrors = validateData(data, validations);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }

    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;

    db.run(query, values, function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: this.lastID,
        message: `${entityName} criado com sucesso`
      });
    });
  });

  // PUT - Update
  app.put(`${basePath}/:id`, (req, res) => {
    const { id } = req.params;

    // Verificar se existe
    db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: `${entityName} não encontrado` });
      }

      // Filtrar apenas campos permitidos
      const data = {};
      fields.forEach(field => {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      });

      // Validações
      const validationErrors = validateData(data, validations);
      if (validationErrors.length > 0) {
        return res.status(400).json({ errors: validationErrors });
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'Nenhum campo válido para atualização' });
      }

      const setClause = Object.keys(data).map(field => `${field} = ?`).join(', ');
      const values = [...Object.values(data), id];

      const query = `UPDATE ${tableName} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

      db.run(query, values, function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          message: `${entityName} atualizado com sucesso`,
          changes: this.changes
        });
      });
    });
  });

  // DELETE
  app.delete(`${basePath}/:id`, (req, res) => {
    const { id } = req.params;

    db.run(`DELETE FROM ${tableName} WHERE id = ?`, [id], function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: `${entityName} não encontrado` });
      }
      res.json({ message: `${entityName} excluído com sucesso` });
    });
  });
}

// Função de validação genérica
function validateData(data, validations) {
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
}

// ==================== ROTAS GENÉRICAS ====================

// Rotas para Alunos
createGenericRoutes('aluno', 'alunos',
  ['nome', 'email', 'telefone', 'data_nascimento', 'instrumento_principal'],
  {
    nome: { required: true, type: 'string' },
    email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    telefone: { type: 'string' },
    data_nascimento: { type: 'string' },
    instrumento_principal: { type: 'string' }
  }
);

// Rotas para Professores
createGenericRoutes('professore', 'professores',
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

// ==================== NOVAS ROTAS PARA O SISTEMA DE AULAS ====================

// Rota para criar uma nova configuração de aula
app.post('/api/aulas/configurar', (req, res) => {
  const { instrumento, turno, professor_id, data_inicio, dias_semana } = req.body;

  // Validações básicas
  if (!instrumento || !turno || !professor_id || !data_inicio || !dias_semana || !Array.isArray(dias_semana) || dias_semana.length === 0) {
    return res.status(400).json({ error: 'Instrumento, turno, professor, data de início e dias da semana são obrigatórios' });
  }

  if (!['manhã', 'tarde', 'noite'].includes(turno)) {
    return res.status(400).json({ error: 'Turno deve ser "manhã", "tarde" ou "noite"' });
  }

  // Verificar se o professor existe
  db.get('SELECT * FROM professores WHERE id = ?', [professor_id], (err, professor) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!professor) {
      return res.status(404).json({ error: 'Professor não encontrado' });
    }

    // Inserir a configuração da aula
    db.run(
      'INSERT INTO aulas_configuradas (instrumento, turno, professor_id, data_inicio) VALUES (?, ?, ?, ?)',
      [instrumento, turno, professor_id, data_inicio],
      function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        const aulaId = this.lastID;

        // Inserir os dias da semana
        const diasPromises = dias_semana.map(dia => {
          return new Promise((resolve, reject) => {
            if (dia < 0 || dia > 6) {
              return reject(new Error('Dia da semana deve estar entre 0 (domingo) e 6 (sábado)'));
            }

            db.run(
              'INSERT INTO aulas_dias_semana (aula_id, dia_semana) VALUES (?, ?)',
              [aulaId, dia],
              function (err) {
                if (err) {
                  return reject(err);
                }
                resolve();
              }
            );
          });
        });

        Promise.all(diasPromises)
          .then(() => {
            res.status(201).json({ 
              id: aulaId, 
              message: 'Aula configurada com sucesso' 
            });
          })
          .catch(error => {
            // Se houver erro ao inserir dias, remover a aula criada
            db.run('DELETE FROM aulas_configuradas WHERE id = ?', [aulaId]);
            res.status(500).json({ error: error.message });
          });
      }
    );
  });
});

// Rota para listar todas as aulas configuradas com seus dias e alunos
app.get('/api/aulas/configuradas', (req, res) => {
  const query = `
    SELECT 
        ac.*,
        p.nome as professor_nome,
        GROUP_CONCAT(DISTINCT ads.dia_semana ORDER BY ads.dia_semana) as dias_semana,
        COUNT(DISTINCT aa.aluno_id) as total_alunos
    FROM aulas_configuradas ac
    LEFT JOIN professores p ON ac.professor_id = p.id
    LEFT JOIN aulas_dias_semana ads ON ac.id = ads.aula_id
    LEFT JOIN aulas_alunos aa ON ac.id = aa.aula_id
    GROUP BY ac.id
    ORDER BY ac.created_at DESC
  `;

  db.all(query, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Processar os dias da semana
    const aulas = rows.map(aula => {
      return {
        ...aula,
        dias_semana: aula.dias_semana ? aula.dias_semana.split(',').map(Number) : []
      };
    });

    res.json({ aulas: aulas });
  });
});

// Rota para obter detalhes de uma aula específica
app.get('/api/aulas/configuradas/:id', (req, res) => {
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

  // Obter dias da semana
  const diasQuery = `
    SELECT dia_semana FROM aulas_dias_semana WHERE aula_id = ?
  `;

  // Obter alunos vinculados
  const alunosQuery = `
    SELECT 
      a.id,
      a.nome,
      a.email,
      a.instrumento_principal
    FROM aulas_alunos aa
    LEFT JOIN alunos a ON aa.aluno_id = a.id
    WHERE aa.aula_id = ?
  `;

  db.get(aulaQuery, [id], (err, aula) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!aula) {
      return res.status(404).json({ error: 'Aula não encontrada' });
    }

    // Obter dias da semana
    db.all(diasQuery, [id], (err, diasRows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const dias_semana = diasRows.map(row => row.dia_semana);

      // Obter alunos
      db.all(alunosQuery, [id], (err, alunosRows) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        res.json({
          ...aula,
          dias_semana,
          alunos: alunosRows
        });
      });
    });
  });
});

// Rota para vincular um aluno a uma aula
app.post('/api/aulas/:aulaId/alunos/:alunoId', (req, res) => {
  const { aulaId, alunoId } = req.params;

  // Verificar se a aula existe
  db.get('SELECT * FROM aulas_configuradas WHERE id = ?', [aulaId], (err, aula) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!aula) {
      return res.status(404).json({ error: 'Aula não encontrada' });
    }

    // Verificar se o aluno existe
    db.get('SELECT * FROM alunos WHERE id = ?', [alunoId], (err, aluno) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!aluno) {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }

      // Verificar se o aluno já está vinculado a esta aula
      db.get('SELECT * FROM aulas_alunos WHERE aula_id = ? AND aluno_id = ?', [aulaId, alunoId], (err, vinculo) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (vinculo) {
          return res.status(400).json({ error: 'Aluno já está vinculado a esta aula' });
        }

        // Vincular aluno à aula
        db.run(
          'INSERT INTO aulas_alunos (aula_id, aluno_id) VALUES (?, ?)',
          [aulaId, alunoId],
          function (err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: 'Aluno vinculado à aula com sucesso' });
          }
        );
      });
    });
  });
});

// Rota para desvincular um aluno de uma aula
app.delete('/api/aulas/:aulaId/alunos/:alunoId', (req, res) => {
  const { aulaId, alunoId } = req.params;

  db.run(
    'DELETE FROM aulas_alunos WHERE aula_id = ? AND aluno_id = ?',
    [aulaId, alunoId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Vínculo não encontrado' });
      }
      res.json({ message: 'Aluno desvinculado da aula com sucesso' });
    }
  );
});

// Rota para obter todas as aulas de um aluno
app.get('/api/alunos/:alunoId/aulas', (req, res) => {
  const { alunoId } = req.params;

  const query = `
    SELECT 
      ac.*,
      p.nome as professor_nome,
      p.especialidade as professor_especialidade,
      GROUP_CONCAT(ads.dia_semana) as dias_semana
    FROM aulas_alunos aa
    LEFT JOIN aulas_configuradas ac ON aa.aula_id = ac.id
    LEFT JOIN professores p ON ac.professor_id = p.id
    LEFT JOIN aulas_dias_semana ads ON ac.id = ads.aula_id
    WHERE aa.aluno_id = ?
    GROUP BY ac.id
    ORDER BY ac.created_at DESC
  `;

  db.all(query, [alunoId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Processar os dias da semana
    const aulas = rows.map(aula => {
      return {
        ...aula,
        dias_semana: aula.dias_semana ? aula.dias_semana.split(',').map(Number) : []
      };
    });

    res.json({ aulas: aulas });
  });
});

// Rota para obter todas as aulas de um professor
app.get('/api/professores/:professorId/aulas', (req, res) => {
  const { professorId } = req.params;

  const query = `
    SELECT 
      ac.*,
      GROUP_CONCAT(ads.dia_semana) as dias_semana,
      COUNT(aa.aluno_id) as total_alunos
    FROM aulas_configuradas ac
    LEFT JOIN aulas_dias_semana ads ON ac.id = ads.aula_id
    LEFT JOIN aulas_alunos aa ON ac.id = aa.aula_id
    WHERE ac.professor_id = ?
    GROUP BY ac.id
    ORDER BY ac.created_at DESC
  `;

  db.all(query, [professorId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Processar os dias da semana
    const aulas = rows.map(aula => {
      return {
        ...aula,
        dias_semana: aula.dias_semana ? aula.dias_semana.split(',').map(Number) : []
      };
    });

    res.json({ aulas: aulas });
  });
});

// Rota para atualizar uma aula configurada
app.put('/api/aulas/configuradas/:id', (req, res) => {
  const { id } = req.params;
  const { instrumento, turno, data_inicio, dias_semana } = req.body;

  // Verificar se a aula existe
  db.get('SELECT * FROM aulas_configuradas WHERE id = ?', [id], (err, aula) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
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
      const query = `UPDATE aulas_configuradas SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

      db.run(query, values, function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
      });
    }

    // Atualizar dias da semana, se fornecidos
    if (dias_semana && Array.isArray(dias_semana)) {
      // Remover dias existentes
      db.run('DELETE FROM aulas_dias_semana WHERE aula_id = ?', [id], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // Inserir novos dias
        const diasPromises = dias_semana.map(dia => {
          return new Promise((resolve, reject) => {
            if (dia < 0 || dia > 6) {
              return reject(new Error('Dia da semana deve estar entre 0 (domingo) e 6 (sábado)'));
            }

            db.run(
              'INSERT INTO aulas_dias_semana (aula_id, dia_semana) VALUES (?, ?)',
              [id, dia],
              function (err) {
                if (err) {
                  return reject(err);
                }
                resolve();
              }
            );
          });
        });

        Promise.all(diasPromises)
          .then(() => {
            res.json({ message: 'Aula atualizada com sucesso' });
          })
          .catch(error => {
            res.status(500).json({ error: error.message });
          });
      });
    } else {
      res.json({ message: 'Aula atualizada com sucesso' });
    }
  });
});

// Rota para excluir uma aula configurada
app.delete('/api/aulas/configuradas/:id', (req, res) => {
  const { id } = req.params;

  // Verificar se a aula existe
  db.get('SELECT * FROM aulas_configuradas WHERE id = ?', [id], (err, aula) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!aula) {
      return res.status(404).json({ error: 'Aula não encontrada' });
    }

    // Excluir a aula (as chaves estrangeiras com CASCADE cuidarão dos registros relacionados)
    db.run('DELETE FROM aulas_configuradas WHERE id = ?', [id], function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Aula excluída com sucesso' });
    });
  });
});

// ==================== ROTAS PARA FINANCEIRO ====================

app.get('/api/financeiro', (req, res) => {
  const query = `
    SELECT p.*, a.nome as aluno_nome 
    FROM pagamentos p 
    LEFT JOIN alunos a ON p.aluno_id = a.id
    ORDER BY p.data_vencimento DESC
  `;

  db.all(query, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ pagamentos: rows });
  });
});

app.get('/api/financeiro/:id', (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT p.*, a.nome as aluno_nome 
    FROM pagamentos p 
    LEFT JOIN alunos a ON p.aluno_id = a.id
    WHERE p.id = ?
  `;

  db.get(query, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }
    res.json(row);
  });
});

app.post('/api/financeiro', (req, res) => {
  const { aluno_id, valor, data_vencimento } = req.body;

  // Validações
  if (!aluno_id || !valor || !data_vencimento) {
    return res.status(400).json({ error: 'Aluno, valor e data de vencimento são obrigatórios' });
  }

  if (valor <= 0) {
    return res.status(400).json({ error: 'O valor deve ser maior que zero' });
  }

  db.run(
    'INSERT INTO pagamentos (aluno_id, valor, data_vencimento) VALUES (?, ?, ?)',
    [aluno_id, valor, data_vencimento],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, message: 'Pagamento registrado com sucesso' });
    }
  );
});

app.put('/api/financeiro/:id', (req, res) => {
  const { id } = req.params;
  const { aluno_id, valor, data_vencimento, status, data_pagamento, valor_repasse } = req.body;

  // Verificar se o pagamento existe
  db.get('SELECT * FROM pagamentos WHERE id = ?', [id], (err, pagamento) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
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
    const query = `UPDATE pagamentos SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    db.run(query, values, function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Pagamento atualizado com sucesso', changes: this.changes });
    });
  });
});

app.delete('/api/financeiro/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM pagamentos WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }
    res.json({ message: 'Pagamento excluído com sucesso' });
  });
});

// Rota para processar pagamento
app.post('/api/financeiro/:id/pagar', (req, res) => {
  const { id } = req.params;
  const { data_pagamento } = req.body;

  // Obter informações do pagamento e do aluno
  db.get(
    'SELECT p.*, a.nome as aluno_nome FROM pagamentos p LEFT JOIN alunos a ON p.aluno_id = a.id WHERE p.id = ?',
    [id],
    (err, pagamento) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!pagamento) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }

      // Obter a aula relacionada a este aluno para calcular o repasse
      db.get(
        'SELECT ac.*, p.porcentagem_repassa FROM aulas_alunos aa LEFT JOIN aulas_configuradas ac ON aa.aula_id = ac.id LEFT JOIN professores p ON ac.professor_id = p.id WHERE aa.aluno_id = ? LIMIT 1',
        [pagamento.aluno_id],
        (err, aula) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          let valor_repasse = 0;
          if (aula && aula.porcentagem_repassa) {
            valor_repasse = pagamento.valor * (aula.porcentagem_repassa / 100);
          }

          // Atualizar o pagamento
          db.run(
            'UPDATE pagamentos SET status = "pago", data_pagamento = ?, valor_repasse = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [data_pagamento || new Date().toISOString(), valor_repasse, id],
            function (err) {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              res.json({ message: 'Pagamento processado com sucesso', valor_repasse });
            }
          );
        }
      );
    }
  );
});

// ==================== ROTAS DE RELATÓRIOS ====================

app.get('/api/relatorios/resumo', (req, res) => {
  const queries = {
    totalAlunos: 'SELECT COUNT(*) as total FROM alunos',
    totalProfessores: 'SELECT COUNT(*) as total FROM professores',
    totalAulasConfiguradas: 'SELECT COUNT(*) as total FROM aulas_configuradas',
    receitaMensal: 'SELECT SUM(valor) as total FROM pagamentos WHERE status = "pago" AND strftime("%Y-%m", data_pagamento) = strftime("%Y-%m", "now")'
  };

  const results = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;

  for (const [key, query] of Object.entries(queries)) {
    db.get(query, (err, row) => {
      if (err) {
        console.error(`Erro na query ${key}:`, err.message);
      }
      results[key] = row ? row.total : 0;

      completed++;
      if (completed === totalQueries) {
        res.json(results);
      }
    });
  }
});

// ==================== ROTAS PARA O CLIENTE ====================

// Rota para servir o aplicativo React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== MIDDLEWARE DE ERRO ====================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo deu errado!' });
});

// Rota para 404 - deve vir depois de todas as outras rotas
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint da API não encontrado' });
});

app.use('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== SERVIÇO DO FRONTEND ====================

// Rota para servir a página HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de fallback para qualquer outra URL
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// ==================== CONFIGURAÇÃO PARA VERCEL ====================

// A Vercel espera que exportemos a app como um módulo
module.exports = app;

// Se não estivermos na Vercel, iniciamos o servidor normalmente
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
  });
}