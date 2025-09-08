const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// ==============================================================
// CONFIGURAÇÕES E INICIALIZAÇÃO
// ==============================================================
const PORT = process.env.PORT || 3000;
PORT == 3000 ? require('dotenv').config() : '';

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
// INICIALIZAÇÃO DO SUPABASE
// ==============================================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis SUPABASE_URL ou SUPABASE_KEY não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Testar conexão
supabase.from('professores').select('*').limit(1)
  .then(({ error }) => {
    if (error) {
      console.error('Erro ao conectar ao Supabase:', error.message);
      process.exit(1);
    }
    console.log('Conectado ao Supabase com sucesso');
  })
  .catch(err => {
    console.error('Erro ao conectar ao Supabase:', err.message);
    process.exit(1);
  });

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
   * @param {string} entityName - Nome da entidade (singular)
   * @param {string} tableName - Nome da tabela no banco
   * @param {Array} fields - Campos permitidos para criação/atualização
   * @param {Object} validations - Validações específicas por campo
   */
  create: function (entityName, tableName, fields, validations = {}) {
    return {
      // GET all
      getAll: async (req, res) => {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*');

          if (error) throw error;
          res.json({ [tableName]: data });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      },

      // GET by ID
      getById: async (req, res) => {
        try {
          const { id } = req.params;
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .eq('id', id)
            .single();

          if (error) throw error;
          if (!data) {
            return res.status(404).json({ error: `${entityName} não encontrado` });
          }

          res.json(data);
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

          const { data: result, error } = await supabase
            .from(tableName)
            .insert(data)
            .select();

          if (error) throw error;

          res.status(201).json({
            id: result[0].id,
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
          const { data: existing, error: checkError } = await supabase
            .from(tableName)
            .select('*')
            .eq('id', id)
            .single();

          if (checkError) throw checkError;
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

          const { error } = await supabase
            .from(tableName)
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', id);

          if (error) throw error;

          res.json({
            message: `${entityName} atualizado com sucesso`
          });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      },

      // DELETE
      delete: async (req, res) => {
        try {
          const { id } = req.params;
          const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', id);

          if (error) throw error;

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
  'professor', 'professores',
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
      const { data: professor, error: professorError } = await supabase
        .from('professores')
        .select('*')
        .eq('id', professor_id)
        .single();

      if (professorError) throw professorError;
      if (!professor) {
        return res.status(404).json({ error: 'Professor não encontrado' });
      }

      // Inserir a configuração da aula
      const { data: aula, error: aulaError } = await supabase
        .from('aulas_configuradas')
        .insert({
          instrumento,
          turno,
          professor_id,
          data_inicio
        })
        .select()
        .single();

      if (aulaError) throw aulaError;

      // Inserir os dias da semana
      for (const dia of dias_semana) {
        if (dia < 0 || dia > 6) {
          // Se houver erro, remover a aula criada
          await supabase
            .from('aulas_configuradas')
            .delete()
            .eq('id', aula.id);
          return res.status(400).json({ error: 'Dia da semana deve estar entre 0 (domingo) e 6 (sábado)' });
        }

        const { error: diaError } = await supabase
          .from('aulas_dias_semana')
          .insert({
            aula_id: aula.id,
            dia_semana: dia
          });

        if (diaError) throw diaError;
      }

      // Gerar agendamento para as próximas 4 semanas
      const dataInicio = new Date(data_inicio);
      for (let semana = 0; semana < 4; semana++) {
        for (const dia of dias_semana) {
          // Calcular data da aula (dia da semana + semana)
          const dataAula = new Date(dataInicio);
          const diffDias = (dia - dataAula.getDay() + 7) % 7 + (semana * 7);
          dataAula.setDate(dataAula.getDate() + diffDias);

          // Verificar se já existe agendamento para esta data
          const { data: existe } = await supabase
            .from('aulas_agendadas')
            .select('id')
            .eq('aula_configurada_id', aula.id)
            .eq('data_aula', dataAula.toISOString().split('T')[0])
            .single();

          if (!existe) {
            // Inserir agendamento
            await supabase
              .from('aulas_agendadas')
              .insert({
                aula_configurada_id: aula.id,
                data_aula: dataAula.toISOString().split('T')[0]
              });
          }
        }
      }

      res.status(201).json({
        id: aula.id,
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
      // Primeiro, buscar as aulas configuradas com informações do professor
      const { data: aulas, error } = await supabase
        .from('aulas_configuradas')
        .select(`
        *,
        professores(nome)
      `);

      if (error) throw error;

      // Processar cada aula individualmente para obter os dados adicionais
      const aulasProcessadas = await Promise.all(aulas.map(async (aula) => {
        // Obter dias da semana
        const { data: dias } = await supabase
          .from('aulas_dias_semana')
          .select('dia_semana')
          .eq('aula_id', aula.id);

        // Contar alunos
        const { count: totalAlunos } = await supabase
          .from('aulas_alunos')
          .select('*', { count: 'exact', head: true })
          .eq('aula_id', aula.id);

        // Contar total de agendamentos
        const { count: totalAgendadas } = await supabase
          .from('aulas_agendadas')
          .select('*', { count: 'exact', head: true })
          .eq('aula_configurada_id', aula.id);

        // Contar agendamentos cancelados
        const { count: totalCanceladas } = await supabase
          .from('aulas_agendadas')
          .select('*', { count: 'exact', head: true })
          .eq('aula_configurada_id', aula.id)
          .eq('status', 'cancelada');

        return {
          ...aula,
          professor_nome: aula.professores.nome,
          dias_semana: dias ? dias.map(d => d.dia_semana) : [],
          total_alunos: totalAlunos || 0,
          total_agendadas: totalAgendadas || 0,
          total_canceladas: totalCanceladas || 0
        };
      }));

      res.json({ aulas: aulasProcessadas });
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
      const { data: aula, error: aulaError } = await supabase
        .from('aulas_configuradas')
        .select(`
          *,
          professores(nome, especialidade)
        `)
        .eq('id', id)
        .single();

      if (aulaError) throw aulaError;
      if (!aula) {
        return res.status(404).json({ error: 'Aula não encontrada' });
      }

      // Obter dias da semana
      const { data: dias, error: diasError } = await supabase
        .from('aulas_dias_semana')
        .select('dia_semana')
        .eq('aula_id', id);

      if (diasError) throw diasError;
      const dias_semana = dias.map(d => d.dia_semana);

      // Obter alunos vinculados
      const { data: alunos, error: alunosError } = await supabase
        .from('aulas_alunos')
        .select(`
          alunos(id, nome, email, instrumento_principal)
        `)
        .eq('aula_id', id);

      if (alunosError) throw alunosError;
      const alunosProcessados = alunos.map(a => a.alunos);

      res.json({
        ...aula,
        professor_nome: aula.professores.nome,
        professor_especialidade: aula.professores.especialidade,
        dias_semana,
        alunos: alunosProcessados
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
      const { data: aula, error: aulaError } = await supabase
        .from('aulas_configuradas')
        .select('*')
        .eq('id', aulaId)
        .single();

      if (aulaError) throw aulaError;
      if (!aula) {
        return res.status(404).json({ error: 'Aula não encontrada' });
      }

      // Verificar se o aluno existe
      const { data: aluno, error: alunoError } = await supabase
        .from('alunos')
        .select('*')
        .eq('id', alunoId)
        .single();

      if (alunoError) throw alunoError;
      if (!aluno) {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }

      // Verificar se o aluno já está vinculado a esta aula
      const { data: vinculo, error: vinculoError } = await supabase
        .from('aulas_alunos')
        .select('*')
        .eq('aula_id', aulaId)
        .eq('aluno_id', alunoId)
        .single();

      if (vinculoError && vinculoError.code !== 'PGRST116') throw vinculoError;
      if (vinculo) {
        return res.status(400).json({ error: 'Aluno já está vinculado a esta aula' });
      }

      // Vincular aluno à aula
      const { error: insertError } = await supabase
        .from('aulas_alunos')
        .insert({
          aula_id: aulaId,
          aluno_id: alunoId
        });

      if (insertError) throw insertError;

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

      const { error } = await supabase
        .from('aulas_alunos')
        .delete()
        .eq('aula_id', aulaId)
        .eq('aluno_id', alunoId);

      if (error) throw error;

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

      const { data: aulas, error } = await supabase
        .from('aulas_alunos')
        .select(`
          aulas_configuradas(*, professores(nome, especialidade)),
          aulas_dias_semana(dia_semana)
        `)
        .eq('aluno_id', alunoId);

      if (error) throw error;

      // Processar os dados
      const aulasProcessadas = aulas.map(aula => ({
        ...aula.aulas_configuradas,
        professor_nome: aula.aulas_configuradas.professores.nome,
        professor_especialidade: aula.aulas_configuradas.professores.especialidade,
        dias_semana: aula.aulas_dias_semana.map(d => d.dia_semana)
      }));

      res.json({ aulas: aulasProcessadas });
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

      const { data: aulas, error } = await supabase
        .from('aulas_configuradas')
        .select(`
          *,
          aulas_dias_semana(dia_semana),
          aulas_alunos(count)
        `)
        .eq('professor_id', professorId);

      if (error) throw error;

      // Processar os dados
      const aulasProcessadas = aulas.map(aula => ({
        ...aula,
        dias_semana: aula.aulas_dias_semana.map(d => d.dia_semana),
        total_alunos: aula.aulas_alunos[0]?.count || 0
      }));

      res.json({ aulas: aulasProcessadas });
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
      const { data: aula, error: aulaError } = await supabase
        .from('aulas_configuradas')
        .select('*')
        .eq('id', id)
        .single();

      if (aulaError) throw aulaError;
      if (!aula) {
        return res.status(404).json({ error: 'Aula não encontrada' });
      }

      const updates = {};
      if (instrumento !== undefined) updates.instrumento = instrumento;
      if (turno !== undefined) {
        if (!['manhã', 'tarde', 'noite'].includes(turno)) {
          return res.status(400).json({ error: 'Turno deve ser "manhã", "tarde" ou "noite"' });
        }
        updates.turno = turno;
      }
      if (data_inicio !== undefined) updates.data_inicio = data_inicio;

      if (Object.keys(updates).length === 0 && !dias_semana) {
        return res.status(400).json({ error: 'Nenhum campo válido para atualização' });
      }

      // Atualizar dados básicos da aula, se houver
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('aulas_configuradas')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (updateError) throw updateError;
      }

      // Atualizar dias da semana, se fornecidos
      if (dias_semana && Array.isArray(dias_semana)) {
        // Remover dias existentes
        await supabase
          .from('aulas_dias_semana')
          .delete()
          .eq('aula_id', id);

        // Inserir novos dias
        for (const dia of dias_semana) {
          if (dia < 0 || dia > 6) {
            return res.status(400).json({ error: 'Dia da semana deve estar entre 0 (domingo) e 6 (sábado)' });
          }

          const { error: diaError } = await supabase
            .from('aulas_dias_semana')
            .insert({
              aula_id: id,
              dia_semana: dia
            });

          if (diaError) throw diaError;
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
      const { data: aula, error: aulaError } = await supabase
        .from('aulas_configuradas')
        .select('*')
        .eq('id', id)
        .single();

      if (aulaError) throw aulaError;
      if (!aula) {
        return res.status(404).json({ error: 'Aula não encontrada' });
      }

      // Excluir a aula (as chaves estrangeiras com CASCADE cuidarão dos registros relacionados)
      const { error } = await supabase
        .from('aulas_configuradas')
        .delete()
        .eq('id', id);

      if (error) throw error;

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
      const { data: aula, error: aulaError } = await supabase
        .from('aulas_configuradas')
        .select('*')
        .eq('id', id)
        .single();

      if (aulaError) throw aulaError;
      if (!aula) {
        return res.status(404).json({ error: 'Aula não encontrada' });
      }

      // Obter dias da semana configurados
      const { data: dias, error: diasError } = await supabase
        .from('aulas_dias_semana')
        .select('dia_semana')
        .eq('aula_id', id);

      if (diasError) throw diasError;
      const dias_semana = dias.map(d => d.dia_semana);

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
          const { data: existe } = await supabase
            .from('aulas_agendadas')
            .select('id')
            .eq('aula_configurada_id', id)
            .eq('data_aula', dataAula.toISOString().split('T')[0])
            .single();

          if (!existe) {
            // Inserir agendamento
            const { data: result, error: insertError } = await supabase
              .from('aulas_agendadas')
              .insert({
                aula_configurada_id: id,
                data_aula: dataAula.toISOString().split('T')[0]
              })
              .select()
              .single();

            if (insertError) throw insertError;
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

      let query = supabase
        .from('aulas_agendadas')
        .select('*, aulas_reagendamentos(nova_data, motivo)')
        .eq('aula_configurada_id', id);

      if (data_inicio && data_fim) {
        query = query.gte('data_aula', data_inicio).lte('data_aula', data_fim);
      }

      query = query.order('data_aula');

      const { data: agendamentos, error } = await query;

      if (error) throw error;

      res.json({ agendamentos });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  obterUmAgendamento: async (req, res) => {
    try {
      const { id } = req.params;

      const { data: agendamento, error } = await supabase
        .from('aulas_agendadas')
        .select(`
          *,
          aulas_configuradas(instrumento, professores(nome))
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!agendamento) {
        return res.status(404).json({ error: 'Agendamento não encontrado' });
      }

      res.json({
        ...agendamento,
        instrumento: agendamento.aulas_configuradas.instrumento,
        professor_nome: agendamento.aulas_configuradas.professores.nome
      });
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
      const { data: agendamento, error: agendamentoError } = await supabase
        .from('aulas_agendadas')
        .select('*')
        .eq('id', id)
        .single();

      if (agendamentoError) throw agendamentoError;
      if (!agendamento) {
        return res.status(404).json({ error: 'Agendamento não encontrado' });
      }

      // Atualizar status para cancelada
      const { error } = await supabase
        .from('aulas_agendadas')
        .update({ status: 'cancelada', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

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
      const { data: agendamento, error: agendamentoError } = await supabase
        .from('aulas_agendadas')
        .select('*')
        .eq('id', id)
        .single();

      if (agendamentoError) throw agendamentoError;
      if (!agendamento) {
        return res.status(404).json({ error: 'Agendamento não encontrado' });
      }

      // Verificar se a nova data é válida
      if (!nova_data || new Date(nova_data) <= new Date()) {
        return res.status(400).json({ error: 'Nova data inválida' });
      }

      // Registrar o reagendamento
      const { error: reagendamentoError } = await supabase
        .from('aulas_reagendamentos')
        .insert({
          aula_agendada_id: id,
          nova_data,
          motivo
        });

      if (reagendamentoError) throw reagendamentoError;

      // Atualizar status do agendamento original
      await supabase
        .from('aulas_agendadas')
        .update({ status: 'reagendada', updated_at: new Date().toISOString() })
        .eq('id', id);

      // Criar novo agendamento para a nova data
      const { data: result, error: insertError } = await supabase
        .from('aulas_agendadas')
        .insert({
          aula_configurada_id: agendamento.aula_configurada_id,
          data_aula: nova_data,
          status: 'agendada'
        })
        .select()
        .single();

      if (insertError) throw insertError;

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
        const dia = inicioSemana.getDay();
        const diff = inicioSemana.getDate() - dia + (dia === 0 ? -6 : 1);
        inicioSemana.setDate(diff);
      }

      // Calcular fim da semana (domingo)
      const fimSemana = new Date(inicioSemana);
      fimSemana.setDate(inicioSemana.getDate() + 6);

      const { data: agendamentos, error } = await supabase
        .from('aulas_agendadas')
        .select(`
          *,
          aulas_configuradas(instrumento, turno, professores(nome, especialidade)),
          aulas_reagendamentos(nova_data, motivo)
        `)
        .gte('data_aula', inicioSemana.toISOString().split('T')[0])
        .lte('data_aula', fimSemana.toISOString().split('T')[0])
        .order('data_aula')
        .order('turno', { foreignTable: 'aulas_configuradas' });

      if (error) throw error;

      res.json({
        semana_inicio: inicioSemana.toISOString().split('T')[0],
        semana_fim: fimSemana.toISOString().split('T')[0],
        agendamentos: agendamentos.map(a => ({
          ...a,
          instrumento: a.aulas_configuradas.instrumento,
          turno: a.aulas_configuradas.turno,
          professor_nome: a.aulas_configuradas.professores.nome,
          professor_especialidade: a.aulas_configuradas.professores.especialidade,
          nova_data: a.aulas_reagendamentos[0]?.nova_data,
          motivo: a.aulas_reagendamentos[0]?.motivo
        }))
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
      const { data: pagamentos, error } = await supabase
        .from('pagamentos')
        .select('*, alunos(nome)')
        .order('data_vencimento', { ascending: false });

      if (error) throw error;

      res.json(pagamentos.map(p => ({
        ...p,
        aluno_nome: p.alunos.nome
      })));
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
      const { data: pagamento, error } = await supabase
        .from('pagamentos')
        .select('*, alunos(nome)')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!pagamento) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }

      res.json({
        ...pagamento,
        aluno_nome: pagamento.alunos.nome
      });
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

      const { data: result, error } = await supabase
        .from('pagamentos')
        .insert({
          aluno_id,
          valor,
          data_vencimento
        })
        .select();

      if (error) throw error;

      res.status(201).json({ id: result[0].id, message: 'Pagamento registrado com sucesso' });
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
      const { data: pagamento, error: pagamentoError } = await supabase
        .from('pagamentos')
        .select('*')
        .eq('id', id)
        .single();

      if (pagamentoError) throw pagamentoError;
      if (!pagamento) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }

      const updates = {};
      if (aluno_id !== undefined) updates.aluno_id = aluno_id;
      if (valor !== undefined) updates.valor = valor;
      if (data_vencimento !== undefined) updates.data_vencimento = data_vencimento;
      if (status !== undefined) updates.status = status;
      if (data_pagamento !== undefined) updates.data_pagamento = data_pagamento;
      if (valor_repasse !== undefined) updates.valor_repasse = valor_repasse;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Nenhum campo válido para atualização' });
      }

      const { error } = await supabase
        .from('pagamentos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      res.json({ message: 'Pagamento atualizado com sucesso' });
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
      const { error } = await supabase
        .from('pagamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;

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
      const { data: pagamento, error: pagamentoError } = await supabase
        .from('pagamentos')
        .select('*, alunos(nome)')
        .eq('id', id)
        .single();

      if (pagamentoError) throw pagamentoError;
      if (!pagamento) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }

      // Obter a aula relacionada a este aluno para calcular o repasse
      const { data: aula, error: aulaError } = await supabase
        .from('aulas_alunos')
        .select(`
          aulas_configuradas(professor_id),
          professores(porcentagem_repassa)
        `)
        .eq('aluno_id', pagamento.aluno_id)
        .limit(1)
        .single();

      let valor_repasse = 0;
      if (aula && aula.professores.porcentagem_repassa) {
        valor_repasse = pagamento.valor * (aula.professores.porcentagem_repassa / 100);
      }

      // Atualizar o pagamento
      const { error } = await supabase
        .from('pagamentos')
        .update({
          status: 'pago',
          data_pagamento: data_pagamento || new Date().toISOString(),
          valor_repasse,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

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
    // Total de alunos
    const { count: totalAlunos, error: alunosError } = await supabase
      .from('alunos')
      .select('*', { count: 'exact', head: true });

    if (alunosError) throw alunosError;

    // Total de professores
    const { count: totalProfessores, error: professoresError } = await supabase
      .from('professores')
      .select('*', { count: 'exact', head: true });

    if (professoresError) throw professoresError;

    // Total de aulas configuradas
    const { count: totalAulasConfiguradas, error: aulasError } = await supabase
      .from('aulas_configuradas')
      .select('*', { count: 'exact', head: true });

    if (aulasError) throw aulasError;

    // Receita mensal
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: receita, error: receitaError } = await supabase
      .from('pagamentos')
      .select('valor')
      .eq('status', 'pago')
      .gte('data_pagamento', firstDayOfMonth)
      .lte('data_pagamento', lastDayOfMonth);

    if (receitaError) throw receitaError;

    const receitaMensal = receita.reduce((total, p) => total + p.valor, 0);

    res.json({
      totalAlunos,
      totalProfessores,
      totalAulasConfiguradas,
      receitaMensal
    });
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
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
  });
}