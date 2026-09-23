const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/pacientes/me -> dados do paciente autenticado
router.get('/me', requireAuth, requireRole('paciente'), async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT id, nome, email, telefone, cpf, data_nascimento, criado_em
             FROM pacientes WHERE id = $1`,
            [req.user.id]
        );
        if (!resultado.rows[0]) return res.status(404).json({ erro: 'Paciente não encontrado.' });
        return res.json(resultado.rows[0]);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao buscar dados do paciente.' });
    }
});

// PUT /api/pacientes/me -> atualizar perfil próprio
router.put(
    '/me',
    requireAuth,
    requireRole('paciente'),
    [
        body('nome').optional().trim().notEmpty(),
        body('telefone').optional().trim().notEmpty(),
    ],
    async (req, res) => {
        const erros = validationResult(req);
        if (!erros.isEmpty()) return res.status(400).json({ erro: 'Dados inválidos.', detalhes: erros.array() });

        const campos = ['nome', 'telefone'];
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
                `UPDATE pacientes SET ${atualizacoes.join(', ')} WHERE id = $${i}
                 RETURNING id, nome, email, telefone`,
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

// Somente psicólogos autenticados podem listar pacientes (ex.: agenda/prontuário)
router.get('/', requireAuth, requireRole('psicologo'), async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT DISTINCT p.id, p.nome, p.telefone, p.email
             FROM pacientes p
             JOIN consultas c ON c.paciente_id = p.id
             WHERE c.psicologo_id = $1
             ORDER BY p.nome ASC`,
            [req.user.id]
        );
        return res.json(resultado.rows);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao listar pacientes.' });
    }
});

module.exports = router;
