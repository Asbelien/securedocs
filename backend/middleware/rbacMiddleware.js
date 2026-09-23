const { sql, poolPromise } = require('../config/db');
const { registrarAuditoria } = require('./auditMiddleware');

function requirePermission(permisoRequerido) {

  return async (req, res, next) => {

    try {

      if (!req.user) {
        return res.status(401).json({
          error: 'Usuario no autenticado'
        });
      }

      const pool = await poolPromise;

      const result = await pool.request()
        .input('rol_id', sql.Int, req.user.rol_id)
        .input('permiso', sql.VarChar, permisoRequerido)
        .query(`
          SELECT p.id, p.nombre
          FROM RolPermiso rp
          INNER JOIN Permiso p
              ON rp.permiso_id = p.id
          WHERE rp.rol_id = @rol_id
            AND p.nombre = @permiso
        `);

      if (result.recordset.length === 0) {

        await registrarAuditoria({
          usuarioId: req.user.id,
          recurso: req.originalUrl,
          accion: permisoRequerido,
          resultado: 'DENEGADO',
          motivo: 'Permiso insuficiente',
          ip: req.ip,
          dispositivo: req.headers['user-agent']
        });

        return res.status(403).json({
          error: 'Permiso insuficiente',
          permiso_requerido: permisoRequerido
        });

      }

      req.permission = permisoRequerido;

      next();

    } catch (error) {

      console.error('Error en RBAC:', error);

      return res.status(500).json({
        error: 'Error verificando permisos'
      });
    }
  };
}

module.exports = {
  requirePermission
};