const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    // eslint-disable-next-line no-console
    console.warn('[psicompany] Aviso: DATABASE_URL não definida. Configure o arquivo .env.');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Erro inesperado no pool do PostgreSQL', err);
    process.exit(1);
});

module.exports = pool;
