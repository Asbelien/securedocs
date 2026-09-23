const express = require('express');
const router = express.Router();

const { sql, poolPromise } = require('../config/db');

const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');


// =====================================================
// CONSULTAR AUDITORÍA
// RBAC: ver_auditoria
// =====================================================

router.get(
  '/',
  authenticateToken,
  requirePermission('ver_auditoria'),
  async (req, res) => {

    try {

      const pool = await poolPromise;

      const result = await pool.request()
        .query(`
          SELECT
            a.id,
            a.usuario_id,
            u.nombre AS usuario,
            a.recurso,
            a.accion,
            a.resultado,
            a.motivo,
            a.ip,
            a.dispositivo,
            a.fecha
          FROM Auditoria a
          INNER JOIN Usuario u
            ON a.usuario_id = u.id
          ORDER BY a.fecha DESC
        `);


      return res.json({

        mensaje: 'Auditoría consultada correctamente',

        tipo_control: 'RBAC',

        usuario: req.user.nombre,

        rol: req.user.rol_nombre,

        total: result.recordset.length,

        auditoria: result.recordset

      });


    } catch (error) {

      console.error('Error consultando auditoría:', error);

      return res.status(500).json({
        error: 'Error consultando auditoría'
      });

    }

  }
);


module.exports = router;