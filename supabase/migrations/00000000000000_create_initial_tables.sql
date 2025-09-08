-- Tabela de professores
CREATE TABLE professores (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT,
  especialidade TEXT,
  limite_alunos INTEGER DEFAULT 10,
  porcentagem_repassa INTEGER DEFAULT 70,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de alunos
CREATE TABLE alunos (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT,
  data_nascimento DATE,
  instrumento_principal TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de aulas configuradas
CREATE TABLE aulas_configuradas (
  id BIGSERIAL PRIMARY KEY,
  instrumento TEXT NOT NULL,
  turno TEXT NOT NULL CHECK (turno IN ('manhã', 'tarde', 'noite')),
  professor_id BIGINT NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de dias da semana para aulas
CREATE TABLE aulas_dias_semana (
  id BIGSERIAL PRIMARY KEY,
  aula_id BIGINT NOT NULL REFERENCES aulas_configuradas(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6)
);

-- Tabela de relação entre aulas e alunos
CREATE TABLE aulas_alunos (
  id BIGSERIAL PRIMARY KEY,
  aula_id BIGINT NOT NULL REFERENCES aulas_configuradas(id) ON DELETE CASCADE,
  aluno_id BIGINT NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  UNIQUE(aula_id, aluno_id)
);

-- Tabela de aulas agendadas
CREATE TABLE aulas_agendadas (
  id BIGSERIAL PRIMARY KEY,
  aula_configurada_id BIGINT NOT NULL REFERENCES aulas_configuradas(id) ON DELETE CASCADE,
  data_aula DATE NOT NULL,
  status TEXT DEFAULT 'agendada' CHECK (status IN ('agendada', 'realizada', 'cancelada', 'reagendada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(aula_configurada_id, data_aula)
);

-- Tabela de reagendamentos
CREATE TABLE aulas_reagendamentos (
  id BIGSERIAL PRIMARY KEY,
  aula_agendada_id BIGINT NOT NULL REFERENCES aulas_agendadas(id) ON DELETE CASCADE,
  nova_data DATE NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de pagamentos
CREATE TABLE pagamentos (
  id BIGSERIAL PRIMARY KEY,
  aluno_id BIGINT NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  valor DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  data_pagamento DATE,
  valor_repasse DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);