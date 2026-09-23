const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../config/db');

async function authenticateToken(req, res, next) {

  try {

    // =====================================================
    // 1. OBTENER HEADER AUTHORIZATION
    // =====================================================

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Token requerido'
      });
    }


    // =====================================================
    // 2. VALIDAR FORMATO BEARER
    // =====================================================

    const parts = authHeader.split(' ');

    if (
      parts.length !== 2 ||
      parts[0] !== 'Bearer' ||
      !parts[1]
    ) {
      return res.status(401).json({
        error: 'Formato de token inválido'
      });
    }


    const token = parts[1];


    // =====================================================
    // 3. VALIDAR JWT
    // =====================================================

    let decoded;

    try {

      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    } catch (error) {

      return res.status(401).json({
        error: 'Token inválido o expirado'
      });

    }


    // =====================================================
    // 4. VALIDAR ID DEL USUARIO
    // =====================================================

    if (!decoded.id) {
      return res.status(401).json({
        error: 'Token inválido: usuario no identificado'
      });
    }


    // =====================================================
    // 5. CONSULTAR USUARIO ACTUAL EN SQL SERVER
    // =====================================================

    const pool = await poolPromise;

    const result = await pool.request()
      .input('id', sql.Int, decoded.id)
      .query(`
        SELECT
          u.id,
          u.nombre,
          u.email,
          u.departamento,
          u.nivel_seguridad,
          u.pais,
          u.tipo_contrato,
          u.estado,
          r.id AS rol_id,
          r.nombre AS rol_nombre
        FROM Usuario u
        INNER JOIN Rol r
          ON u.rol_id = r.id
        WHERE u.id = @id
      `);


    const usuario = result.recordset[0];


    // =====================================================
    // 6. VERIFICAR QUE EL USUARIO EXISTA
    // =====================================================

    if (!usuario) {
      return res.status(401).json({
        error: 'Usuario no encontrado'
      });
    }


    // =====================================================
    // 7. VERIFICAR ESTADO ACTUAL DEL USUARIO
    // =====================================================

    if (usuario.estado !== 'activo') {
      return res.status(403).json({
        error: 'Usuario inactivo'
      });
    }


    // =====================================================
    // 8. CONSTRUIR USUARIO ACTUAL
    //
    // Ya NO utilizamos los atributos antiguos del JWT.
    // Los obtenemos directamente de SQL Server.
    // =====================================================

    req.user = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol_id: usuario.rol_id,
      rol_nombre: usuario.rol_nombre,
      departamento: usuario.departamento,
      nivel_seguridad: usuario.nivel_seguridad,
      pais: usuario.pais,
      tipo_contrato: usuario.tipo_contrato,
      estado: usuario.estado
    };


    // =====================================================
    // 9. CONTINUAR CON RBAC / ABAC
    // =====================================================

    next();


  } catch (error) {

    console.error(
      'Error autenticando usuario:',
      error
    );

    return res.status(500).json({
      error: 'Error verificando autenticación'
    });

  }
}


module.exports = {
  authenticateToken
};