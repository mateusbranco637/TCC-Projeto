const jwt = require('jsonwebtoken');

/**
 * Exige um token JWT válido no header Authorization: Bearer <token>.
 * Preenche req.user = { id, papel } quando válido.
 */
function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ erro: 'Token de autenticação ausente.' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: payload.sub, papel: payload.papel };
        return next();
    } catch (err) {
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
}

/**
 * Restringe o acesso a um ou mais papéis ('paciente' | 'psicologo').
 * Use depois de requireAuth.
 */
function requireRole(...papeis) {
    return (req, res, next) => {
        if (!req.user || !papeis.includes(req.user.papel)) {
            return res.status(403).json({ erro: 'Acesso não permitido para este papel de usuário.' });
        }
        return next();
    };
}

module.exports = { requireAuth, requireRole };
