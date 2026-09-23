require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const pacientesRoutes = require('./routes/pacientes');
const psicologosRoutes = require('./routes/psicologos');
const consultasRoutes = require('./routes/consultas');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/psicologos', psicologosRoutes);
app.use('/api/consultas', consultasRoutes);

// 404
app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// Tratador de erros genérico
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`PsiCompany API rodando na porta ${PORT}`);
});
