const express = require('express');
const router = express.Router();

const { login } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { registrarAuditoria } = require('../middleware/auditMiddleware');


// =====================================================
// LOGIN
// =====================================================

router.post('/login', login);


// =====================================================
// LOGOUT
// =====================================================

router.post(
  '/logout',
  authenticateToken,
  async (req, res) => {

    try {

      await registrarAuditoria({
        usuarioId: req.user.id,
        recurso: '/api/auth/logout',
        accion: 'logout',
        resultado: 'PERMITIDO',
        motivo: 'Cierre de sesión exitoso',
        ip: req.ip,
        dispositivo: req.headers['user-agent']
      });

      return res.json({
        mensaje: 'Logout exitoso',
        usuario: req.user.nombre
      });

    } catch (error) {

      console.error('Error en logout:', error);

      return res.status(500).json({
        error: 'Error cerrando sesión'
      });

    }
  }
);


module.exports = router;