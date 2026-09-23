const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const COLUNAS_PUBLICAS = 'id, nome, telefone, especialidade, bio, criado_em';

// GET /api/psicologos  -> lista pública (para o paciente escolher um profissional)
router.get('/', async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT ${COLUNAS_PUBLICAS} FROM psicologos ORDER BY nome ASC`
        );
        return res.json(resultado.rows);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao listar psicólogos.' });
    }
});

// GET /api/psicologos/me -> dados do psicólogo autenticado
router.get('/me', requireAuth, requireRole('psicologo'), async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT id, nome, email, telefone, cpf_cnpj, numero_crp, especialidade, bio, criado_em
             FROM psicologos WHERE id = $1`,
            [req.user.id]
        );
        if (!resultado.rows[0]) return res.status(404).json({ erro: 'Psicólogo não encontrado.' });
        return res.json(resultado.rows[0]);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao buscar dados do psicólogo.' });
    }
});

// PUT /api/psicologos/me -> atualizar perfil próprio
router.put(
    '/me',
    requireAuth,
    requireRole('psicologo'),
    [
        body('nome').optional().trim().notEmpty(),
        body('telefone').optional().trim().notEmpty(),
        body('especialidade').optional({ nullable: true, checkFalsy: true }).trim(),
        body('bio').optional({ nullable: true, checkFalsy: true }).trim(),
    ],
    async (req, res) => {
        const erros = validationResult(req);
        if (!erros.isEmpty()) return res.status(400).json({ erro: 'Dados inválidos.', detalhes: erros.array() });

        const campos = ['nome', 'telefone', 'especialidade', 'bio'];
        const atualizacoes = [];
        const valores = [];
        let i = 1;

        campos.forEach((campo) => {
            if (req.body[campo] !== undefined) {
                atualizacoes.push(`${campo} = $${i++}`);
                valores.push(req.body[campo]);
            }
        });

        if (atualizacoes.length === 0) {
            return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
        }

        valores.push(req.user.id);

        try {
            const resultado = await pool.query(
                `UPDATE psicologos SET ${atualizacoes.join(', ')} WHERE id = $${i}
                 RETURNING id, nome, email, telefone, especialidade, bio`,
                valores
            );
            return res.json(resultado.rows[0]);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
            return res.status(500).json({ erro: 'Erro ao atualizar perfil.' });
        }
    }
);

// GET /api/psicologos/:id -> detalhe público de um psicólogo
router.get('/:id', async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT ${COLUNAS_PUBLICAS} FROM psicologos WHERE id = $1`,
            [req.params.id]
        );
        if (!resultado.rows[0]) return res.status(404).json({ erro: 'Psicólogo não encontrado.' });
        return res.json(resultado.rows[0]);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao buscar psicólogo.' });
    }
});

module.exports = router;
