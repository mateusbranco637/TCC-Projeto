-- =========================================================
-- BANCO DE DADOS: PsiCompany
-- =========================================================
-- Baseado no schema original enviado, com adições necessárias
-- para o sistema completo (login/autenticação + consultas):
--   1) coluna senha_hash em pacientes e psicologos
--   2) tabela consultas (agendamentos) + histórico + índices
-- =========================================================

CREATE DATABASE psicompany;
\c psicompany;

-- =========================================================
-- EXTENSÃO PARA GERAÇÃO DE UUID
-- =========================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- TABELA: PACIENTES
-- =========================================================
CREATE TABLE pacientes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome            VARCHAR(150)        NOT NULL,
    data_nascimento DATE                NOT NULL,
    cpf             CHAR(11)            NOT NULL UNIQUE,
    email           VARCHAR(150)        NOT NULL UNIQUE,
    telefone        VARCHAR(20)         NOT NULL,
    senha_hash      VARCHAR(255)        NOT NULL,
    criado_em       TIMESTAMP           NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMP           NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_cpf_paciente CHECK (cpf ~ '^[0-9]{11}$'),
    CONSTRAINT chk_email_paciente CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- =========================================================
-- TABELA: PSICÓLOGOS
-- =========================================================
CREATE TABLE psicologos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome            VARCHAR(150)        NOT NULL,
    data_nascimento DATE                NOT NULL,
    cpf_cnpj        VARCHAR(14)         NOT NULL UNIQUE,
    numero_crp      VARCHAR(20)         NOT NULL UNIQUE,
    telefone        VARCHAR(20)         NOT NULL,
    email           VARCHAR(150)        NOT NULL UNIQUE,
    senha_hash      VARCHAR(255)        NOT NULL,
    especialidade   VARCHAR(100),
    bio             TEXT,
    criado_em       TIMESTAMP           NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMP           NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_cpf_cnpj_psicologo CHECK (
        cpf_cnpj ~ '^[0-9]{11}$' OR cpf_cnpj ~ '^[0-9]{14}$'
    ),
    CONSTRAINT chk_email_psicologo CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- =========================================================
-- TABELA: CONSULTAS (agendamentos entre paciente e psicólogo)
-- =========================================================
CREATE TABLE consultas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id     UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    psicologo_id    UUID NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
    data_hora       TIMESTAMP NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'agendada',
    observacoes     TEXT,
    criado_em       TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_status_consulta CHECK (
        status IN ('agendada', 'confirmada', 'concluida', 'cancelada')
    )
);

-- =========================================================
-- TABELAS DE HISTÓRICO (AUDITORIA)
-- Guardam automaticamente cada alteração feita no site
-- =========================================================
CREATE TABLE pacientes_historico (
    hist_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id     UUID,
    operacao        VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    dados_antigos   JSONB,
    dados_novos     JSONB,
    alterado_em     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE psicologos_historico (
    hist_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psicologo_id    UUID,
    operacao        VARCHAR(10) NOT NULL,
    dados_antigos   JSONB,
    dados_novos     JSONB,
    alterado_em     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE consultas_historico (
    hist_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consulta_id     UUID,
    operacao        VARCHAR(10) NOT NULL,
    dados_antigos   JSONB,
    dados_novos     JSONB,
    alterado_em     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================================================
-- FUNÇÃO GENÉRICA: atualizar "atualizado_em" automaticamente
-- =========================================================
CREATE OR REPLACE FUNCTION fn_atualiza_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pacientes_timestamp
BEFORE UPDATE ON pacientes
FOR EACH ROW EXECUTE FUNCTION fn_atualiza_timestamp();

CREATE TRIGGER trg_psicologos_timestamp
BEFORE UPDATE ON psicologos
FOR EACH ROW EXECUTE FUNCTION fn_atualiza_timestamp();

CREATE TRIGGER trg_consultas_timestamp
BEFORE UPDATE ON consultas
FOR EACH ROW EXECUTE FUNCTION fn_atualiza_timestamp();

-- =========================================================
-- FUNÇÕES DE AUDITORIA: registram toda alteração no histórico
-- =========================================================
CREATE OR REPLACE FUNCTION fn_audita_paciente()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO pacientes_historico(paciente_id, operacao, dados_novos)
        VALUES (NEW.id, 'INSERT', to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO pacientes_historico(paciente_id, operacao, dados_antigos, dados_novos)
        VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO pacientes_historico(paciente_id, operacao, dados_antigos)
        VALUES (OLD.id, 'DELETE', to_jsonb(OLD));
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audita_paciente
AFTER INSERT OR UPDATE OR DELETE ON pacientes
FOR EACH ROW EXECUTE FUNCTION fn_audita_paciente();

CREATE OR REPLACE FUNCTION fn_audita_psicologo()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO psicologos_historico(psicologo_id, operacao, dados_novos)
        VALUES (NEW.id, 'INSERT', to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO psicologos_historico(psicologo_id, operacao, dados_antigos, dados_novos)
        VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO psicologos_historico(psicologo_id, operacao, dados_antigos)
        VALUES (OLD.id, 'DELETE', to_jsonb(OLD));
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audita_psicologo
AFTER INSERT OR UPDATE OR DELETE ON psicologos
FOR EACH ROW EXECUTE FUNCTION fn_audita_psicologo();

CREATE OR REPLACE FUNCTION fn_audita_consulta()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO consultas_historico(consulta_id, operacao, dados_novos)
        VALUES (NEW.id, 'INSERT', to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO consultas_historico(consulta_id, operacao, dados_antigos, dados_novos)
        VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO consultas_historico(consulta_id, operacao, dados_antigos)
        VALUES (OLD.id, 'DELETE', to_jsonb(OLD));
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audita_consulta
AFTER INSERT OR UPDATE OR DELETE ON consultas
FOR EACH ROW EXECUTE FUNCTION fn_audita_consulta();

-- =========================================================
-- ÍNDICES PARA BUSCA RÁPIDA (login, filtros de busca no site)
-- =========================================================
CREATE INDEX idx_pacientes_email ON pacientes(email);
CREATE INDEX idx_pacientes_cpf ON pacientes(cpf);
CREATE INDEX idx_psicologos_crp ON psicologos(numero_crp);
CREATE INDEX idx_psicologos_cpf_cnpj ON psicologos(cpf_cnpj);
CREATE INDEX idx_psicologos_email ON psicologos(email);
CREATE INDEX idx_consultas_paciente ON consultas(paciente_id);
CREATE INDEX idx_consultas_psicologo ON consultas(psicologo_id);
CREATE INDEX idx_consultas_data_hora ON consultas(data_hora);
