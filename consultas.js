const express = require('express');
const { body, param, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function tratarErroValidacao(req, res) {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
        res.status(400).json({ erro: 'Dados inválidos.', detalhes: erros.array() });
        return true;
    }
    return false;
}

// POST /api/consultas -> paciente agenda uma consulta com um psicólogo
router.post(
    '/',
    requireAuth,
    requireRole('paciente'),
    [
        body('psicologo_id').isUUID().withMessage('psicologo_id inválido.'),
        body('data_hora').isISO8601().withMessage('data_hora inválida (use um formato ISO 8601).'),
        body('observacoes').optional({ nullable: true, checkFalsy: true }).trim(),
    ],
    async (req, res) => {
        if (tratarErroValidacao(req, res)) return;

        const { psicologo_id, data_hora, observacoes } = req.body;

        try {
            const psicologo = await pool.query('SELECT id FROM psicologos WHERE id = $1', [psicologo_id]);
            if (!psicologo.rows[0]) {
                return res.status(404).json({ erro: 'Psicólogo não encontrado.' });
            }

            const resultado = await pool.query(
                `INSERT INTO consultas (paciente_id, psicologo_id, data_hora, observacoes)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, paciente_id, psicologo_id, data_hora, status, observacoes, criado_em`,
                [req.user.id, psicologo_id, data_hora, observacoes || null]
            );

            return res.status(201).json(resultado.rows[0]);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
            return res.status(500).json({ erro: 'Erro ao agendar consulta.' });
        }
    }
);

// GET /api/consultas/minhas -> lista consultas do usuário logado (paciente ou psicólogo)
router.get('/minhas', requireAuth, async (req, res) => {
    const coluna = req.user.papel === 'paciente' ? 'paciente_id' : 'psicologo_id';

    try {
        const resultado = await pool.query(
            `SELECT c.id, c.data_hora, c.status, c.observacoes,
                    p.id AS paciente_id, p.nome AS paciente_nome,
                    ps.id AS psicologo_id, ps.nome AS psicologo_nome, ps.especialidade
             FROM consultas c
             JOIN pacientes p ON p.id = c.paciente_id
             JOIN psicologos ps ON ps.id = c.psicologo_id
             WHERE c.${coluna} = $1
             ORDER BY c.data_hora ASC`,
            [req.user.id]
        );
        return res.json(resultado.rows);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao listar consultas.' });
    }
});

// PATCH /api/consultas/:id/status -> psicólogo confirma/conclui/cancela; paciente pode cancelar
router.patch(
    '/:id/status',
    requireAuth,
    [
        param('id').isUUID(),
        body('status').isIn(['agendada', 'confirmada', 'concluida', 'cancelada']),
    ],
    async (req, res) => {
        if (tratarErroValidacao(req, res)) return;

        const { id } = req.params;
        const { status } = req.body;

        try {
            const consultaAtual = await pool.query('SELECT * FROM consultas WHERE id = $1', [id]);
            const consulta = consultaAtual.rows[0];
            if (!consulta) return res.status(404).json({ erro: 'Consulta não encontrada.' });

            const ehDono =
                (req.user.papel === 'paciente' && consulta.paciente_id === req.user.id) ||
                (req.user.papel === 'psicologo' && consulta.psicologo_id === req.user.id);

            if (!ehDono) {
                return res.status(403).json({ erro: 'Você não tem permissão para alterar esta consulta.' });
            }

            // Pacientes só podem cancelar; psicólogos podem confirmar, concluir ou cancelar
            if (req.user.papel === 'paciente' && status !== 'cancelada') {
                return res.status(403).json({ erro: 'Pacientes só podem cancelar consultas.' });
            }

            const resultado = await pool.query(
                `UPDATE consultas SET status = $1 WHERE id = $2
                 RETURNING id, paciente_id, psicologo_id, data_hora, status, observacoes`,
                [status, id]
            );
            return res.json(resultado.rows[0]);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
            return res.status(500).json({ erro: 'Erro ao atualizar status da consulta.' });
        }
    }
);

module.exports = router;
