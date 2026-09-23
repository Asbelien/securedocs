const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../config/db');

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password son requeridos' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .query(`
        SELECT u.id, u.nombre, u.email, u.password_hash, u.departamento,
               u.nivel_seguridad, u.pais, u.tipo_contrato, u.estado,
               r.id AS rol_id, r.nombre AS rol_nombre
        FROM Usuario u
        INNER JOIN Rol r ON u.rol_id = r.id
        WHERE u.email = @email
      `);

    const usuario = result.recordset[0];

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (usuario.estado !== 'activo') {
      return res.status(403).json({ error: 'Usuario inactivo' });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Payload del JWT: los atributos que ABAC necesitará evaluar
    const payload = {
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

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    });

    res.json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol_nombre,
        departamento: usuario.departamento
      }
    });

  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { login };