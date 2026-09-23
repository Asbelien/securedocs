require('dotenv').config();
const bcrypt = require('bcrypt');
const { sql, poolPromise } = require('../config/db');

async function actualizarPasswords() {
  try {
    const pool = await poolPromise;
    const passwordPlano = 'password123'; // misma clave para todos los usuarios de prueba
    const hash = await bcrypt.hash(passwordPlano, 10);

    const result = await pool.request()
      .input('hash', sql.VarChar, hash)
      .query(`UPDATE Usuario SET password_hash = @hash WHERE password_hash = 'PENDIENTE_HASH'`);

    console.log(`Contraseñas actualizadas: ${result.rowsAffected[0]} usuarios`);
    console.log(`Clave de prueba para todos: ${passwordPlano}`);
    process.exit(0);
  } catch (err) {
    console.error('Error actualizando contraseñas:', err);
    process.exit(1);
  }
}

actualizarPasswords();