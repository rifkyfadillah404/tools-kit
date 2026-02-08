const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { auditLog } = require('../middlewares/audit');

const validateTool = [
  body('name').notEmpty().withMessage('Nama alat wajib diisi'),
  body('category_id').isInt().withMessage('Kategori wajib dipilih'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock minimal 0'),
  body('available_stock').optional().isInt({ min: 0 }).withMessage('Available stock minimal 0'),
  body('photo_url').optional().isString().withMessage('photo_url tidak valid'),
];

const validateUnitPayload = [
  body('unit_codes').optional().isArray({ min: 1 }).withMessage('unit_codes harus array'),
  body('unit_codes.*').optional().isString().withMessage('Format unit code tidak valid'),
  body('status').optional().isIn(['available', 'dipinjam', 'maintenance', 'hilang']).withMessage('Status unit tidak valid'),
  body('condition_note').optional().isString().withMessage('condition_note tidak valid'),
];

const normalizeBaseCode = (tool) => {
  if (tool.asset_tag && String(tool.asset_tag).trim()) {
    return String(tool.asset_tag).trim().toUpperCase();
  }

  return `TOOL-${tool.id}`;
};

const pad3 = (num) => String(num).padStart(3, '0');

const generateNextUnitCode = async (connection, tool, startFrom = 1) => {
  const baseCode = normalizeBaseCode(tool);
  let seq = startFrom;

  while (true) {
    let candidate = `${baseCode}-${pad3(seq)}`;
    let suffix = 1;

    // eslint-disable-next-line no-await-in-loop
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const [dup] = await connection.query('SELECT id FROM tool_units WHERE unit_code = ? LIMIT 1', [candidate]);
      if (dup.length === 0) {
        return { unitCode: candidate, nextSeq: seq + 1 };
      }
      candidate = `${baseCode}-${pad3(seq)}-${suffix}`;
      suffix += 1;
    }
  }
};

const parseUnitCodes = (value) => {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\r?\n|,|;/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  return [];
};

const buildPhotoUrl = (req, filename) => {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  return `${proto}://${req.get('host')}/uploads/tools/${filename}`;
};

const getAll = async (req, res) => {
  try {
    const { category_id, status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        t.*,
        c.name as category_name,
        COALESCE(u.total_units, 0) as unit_total,
        COALESCE(u.available_units, 0) as unit_available
      FROM tools t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN (
        SELECT
          tu.tool_id,
          COUNT(*) as total_units,
          SUM(tu.status = 'available') as available_units
        FROM tool_units tu
        GROUP BY tu.tool_id
      ) u ON u.tool_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      query += ' AND t.category_id = ?';
      params.push(category_id);
    }

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    if (search) {
      query += `
        AND (
          t.name LIKE ?
          OR t.asset_tag LIKE ?
          OR t.description LIKE ?
          OR EXISTS (
            SELECT 1
            FROM tool_units su
            WHERE su.tool_id = t.id
              AND su.unit_code LIKE ?
          )
        )
      `;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const countQuery = query.replace(/SELECT[\s\S]*?FROM tools t/, 'SELECT COUNT(*) as total FROM tools t');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    query += ' ORDER BY t.name LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const [tools] = await pool.query(query, params);

    res.json({
      data: tools,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get tools error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const getById = async (req, res) => {
  try {
    const [tools] = await pool.query(
      `
        SELECT t.*, c.name as category_name
        FROM tools t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = ?
      `,
      [req.params.id]
    );

    if (tools.length === 0) {
      return res.status(404).json({ error: 'Alat tidak ditemukan' });
    }

    const tool = tools[0];

    const [unitStatsRows] = await pool.query(
      `
        SELECT
          COUNT(*) as unit_total,
          SUM(status = 'available') as unit_available,
          SUM(status = 'dipinjam') as unit_dipinjam,
          SUM(status = 'maintenance') as unit_maintenance,
          SUM(status = 'hilang') as unit_hilang
        FROM tool_units
        WHERE tool_id = ?
      `,
      [req.params.id]
    );

    res.json({
      ...tool,
      unit_stats: {
        unit_total: Number(unitStatsRows[0]?.unit_total || 0),
        unit_available: Number(unitStatsRows[0]?.unit_available || 0),
        unit_dipinjam: Number(unitStatsRows[0]?.unit_dipinjam || 0),
        unit_maintenance: Number(unitStatsRows[0]?.unit_maintenance || 0),
        unit_hilang: Number(unitStatsRows[0]?.unit_hilang || 0),
      },
    });
  } catch (error) {
    console.error('Get tool error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let connection;

  try {
    const {
      category_id,
      name,
      asset_tag,
      description,
      location,
      photo_url,
      stock,
      available_stock,
      unit_codes,
    } = req.body;

    if (asset_tag) {
      const [existing] = await pool.query('SELECT id FROM tools WHERE asset_tag = ?', [asset_tag]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Asset tag sudah digunakan' });
      }
    }

    const parsedCodes = parseUnitCodes(unit_codes);
    const normalizedStock = stock === undefined || stock === null ? (parsedCodes.length > 0 ? parsedCodes.length : 1) : parseInt(stock, 10);
    const normalizedAvailableStock =
      available_stock === undefined || available_stock === null ? normalizedStock : parseInt(available_stock, 10);

    if (Number.isNaN(normalizedStock) || normalizedStock < 0) {
      return res.status(400).json({ error: 'Stock tidak valid' });
    }

    if (
      Number.isNaN(normalizedAvailableStock) ||
      normalizedAvailableStock < 0 ||
      normalizedAvailableStock > normalizedStock
    ) {
      return res.status(400).json({ error: 'Available stock tidak valid' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        INSERT INTO tools (category_id, name, asset_tag, description, location, stock, available_stock, status, photo_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        category_id,
        name,
        asset_tag || null,
        description || null,
        location || null,
        normalizedStock,
        normalizedAvailableStock,
        normalizedAvailableStock > 0 ? 'available' : 'not_available',
        photo_url || null,
      ]
    );

    const toolId = result.insertId;
    const [toolRows] = await connection.query('SELECT id, asset_tag FROM tools WHERE id = ?', [toolId]);
    const toolData = toolRows[0];

    const inserts = [];
    const usedCodes = new Set();

    parsedCodes.forEach((code) => {
      const normalized = code.toUpperCase();
      if (usedCodes.has(normalized)) return;
      usedCodes.add(normalized);
      inserts.push([toolId, normalized, 'available']);
    });

    let nextSeq = 1;
    while (inserts.length < normalizedStock) {
      // eslint-disable-next-line no-await-in-loop
      const next = await generateNextUnitCode(connection, toolData, nextSeq);
      nextSeq = next.nextSeq;
      inserts.push([toolId, next.unitCode, 'available']);
    }

    if (inserts.length > 0) {
      await connection.query(
        'INSERT INTO tool_units (tool_id, unit_code, status) VALUES ?',
        [inserts]
      );
    }

    if (normalizedAvailableStock < normalizedStock) {
      await connection.query(
        `
          UPDATE tool_units
          SET status = 'dipinjam'
          WHERE tool_id = ?
          ORDER BY id DESC
          LIMIT ?
        `,
        [toolId, normalizedStock - normalizedAvailableStock]
      );
    }

    await connection.query('CALL sp_sync_tool_stock(?)', [toolId]);

    await connection.commit();

    await auditLog(req.user.id, 'CREATE', 'tool', toolId, {
      name,
      asset_tag,
      photo_url: photo_url || null,
      generated_units: normalizedStock,
    });

    const [createdRows] = await pool.query('SELECT * FROM tools WHERE id = ?', [toolId]);
    res.status(201).json(createdRows[0]);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Create tool error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  } finally {
    if (connection) connection.release();
  }
};

const update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { category_id, name, asset_tag, description, location, photo_url } = req.body;

    if (asset_tag) {
      const [existing] = await pool.query('SELECT id FROM tools WHERE asset_tag = ? AND id != ?', [asset_tag, req.params.id]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Asset tag sudah digunakan' });
      }
    }

    const [result] = await pool.query(
      `
        UPDATE tools
        SET category_id = ?,
            name = ?,
            asset_tag = ?,
            description = ?,
            location = ?,
            photo_url = ?
        WHERE id = ?
      `,
      [
        category_id,
        name,
        asset_tag || null,
        description || null,
        location || null,
        photo_url || null,
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Alat tidak ditemukan' });
    }

    await pool.query('CALL sp_sync_tool_stock(?)', [req.params.id]);

    await auditLog(req.user.id, 'UPDATE', 'tool', req.params.id, {
      name,
      asset_tag,
      photo_url: photo_url || null,
    });

    res.json({ message: 'Alat berhasil diperbarui' });
  } catch (error) {
    console.error('Update tool error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const remove = async (req, res) => {
  try {
    const [activeLoans] = await pool.query(
      `
        SELECT 1
        FROM peminjaman p
        WHERE p.tool_id = ?
          AND p.status IN ('approved', 'dipinjam')
        LIMIT 1
      `,
      [req.params.id]
    );

    if (activeLoans.length > 0) {
      return res.status(400).json({ error: 'Alat tidak dapat dihapus karena masih dipinjam/proses.' });
    }

    const [result] = await pool.query('DELETE FROM tools WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Alat tidak ditemukan' });
    }

    await auditLog(req.user.id, 'DELETE', 'tool', req.params.id);

    res.json({ message: 'Alat berhasil dihapus' });
  } catch (error) {
    console.error('Delete tool error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['available', 'not_available'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid' });
    }

    if (status === 'not_available') {
      await pool.query(
        `
          UPDATE tool_units
          SET status = 'maintenance'
          WHERE tool_id = ?
            AND status = 'available'
        `,
        [req.params.id]
      );
    } else {
      await pool.query(
        `
          UPDATE tool_units
          SET status = 'available'
          WHERE tool_id = ?
            AND status = 'maintenance'
        `,
        [req.params.id]
      );
    }

    await pool.query('CALL sp_sync_tool_stock(?)', [req.params.id]);

    await auditLog(req.user.id, 'UPDATE_STATUS', 'tool', req.params.id, { status });

    res.json({ message: 'Status alat berhasil diperbarui' });
  } catch (error) {
    console.error('Update tool status error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File foto wajib diunggah' });
    }

    const photoUrl = buildPhotoUrl(req, req.file.filename);

    await auditLog(req.user.id, 'UPLOAD_PHOTO', 'tool_photo', null, {
      filename: req.file.filename,
      photo_url: photoUrl,
    });

    res.status(201).json({
      message: 'Foto berhasil diunggah',
      photo_url: photoUrl,
      filename: req.file.filename,
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const getUnits = async (req, res) => {
  try {
    const [toolRows] = await pool.query('SELECT id FROM tools WHERE id = ?', [req.params.id]);
    if (toolRows.length === 0) {
      return res.status(404).json({ error: 'Alat tidak ditemukan' });
    }

    const [rows] = await pool.query(
      `
        SELECT
          tu.*,
          pu.peminjaman_id,
          pu.checkout_at,
          pu.return_at
        FROM tool_units tu
        LEFT JOIN peminjaman_units pu
          ON pu.tool_unit_id = tu.id
          AND pu.return_at IS NULL
        WHERE tu.tool_id = ?
        ORDER BY tu.unit_code ASC
      `,
      [req.params.id]
    );

    res.json(rows);
  } catch (error) {
    console.error('Get units error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const addUnits = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let connection;

  try {
    const codes = parseUnitCodes(req.body.unit_codes);

    if (codes.length === 0) {
      return res.status(400).json({ error: 'Daftar unit code tidak boleh kosong' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [toolRows] = await connection.query('SELECT id, asset_tag FROM tools WHERE id = ? FOR UPDATE', [req.params.id]);
    if (toolRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Alat tidak ditemukan' });
    }

    const normalizedCodes = [...new Set(codes.map((c) => c.toUpperCase()))];
    const placeholders = normalizedCodes.map(() => '?').join(', ');
    const [existingCodes] = await connection.query(
      `SELECT unit_code FROM tool_units WHERE unit_code IN (${placeholders})`,
      normalizedCodes
    );

    if (existingCodes.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        error: 'Ada unit code yang sudah digunakan',
        duplicated_codes: existingCodes.map((row) => row.unit_code),
      });
    }

    const inserts = normalizedCodes.map((code) => [req.params.id, code, 'available']);
    await connection.query('INSERT INTO tool_units (tool_id, unit_code, status) VALUES ?', [inserts]);
    await connection.query('CALL sp_sync_tool_stock(?)', [req.params.id]);

    await connection.commit();

    await auditLog(req.user.id, 'CREATE', 'tool_unit', req.params.id, {
      count: normalizedCodes.length,
      unit_codes: normalizedCodes,
    });

    res.status(201).json({
      message: 'Unit berhasil ditambahkan',
      added_count: normalizedCodes.length,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Add units error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  } finally {
    if (connection) connection.release();
  }
};

const updateUnit = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { status, condition_note } = req.body;

    const [rows] = await pool.query(
      `
        SELECT tu.id, tu.tool_id, tu.status,
               pu.peminjaman_id
        FROM tool_units tu
        LEFT JOIN peminjaman_units pu
          ON pu.tool_unit_id = tu.id
          AND pu.return_at IS NULL
        WHERE tu.id = ?
          AND tu.tool_id = ?
        LIMIT 1
      `,
      [req.params.unitId, req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Unit tidak ditemukan' });
    }

    const unit = rows[0];

    if (unit.peminjaman_id && status && status !== 'dipinjam') {
      return res.status(400).json({ error: 'Unit sedang dipinjam aktif dan tidak bisa diubah status-nya.' });
    }

    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }

    if (condition_note !== undefined) {
      updates.push('condition_note = ?');
      params.push(condition_note || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Tidak ada perubahan yang dikirim' });
    }

    params.push(req.params.unitId, req.params.id);

    await pool.query(
      `
        UPDATE tool_units
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = ? AND tool_id = ?
      `,
      params
    );

    await pool.query('CALL sp_sync_tool_stock(?)', [req.params.id]);

    await auditLog(req.user.id, 'UPDATE', 'tool_unit', req.params.unitId, {
      tool_id: Number(req.params.id),
      status: status || unit.status,
      condition_note,
    });

    res.json({ message: 'Unit berhasil diperbarui' });
  } catch (error) {
    console.error('Update unit error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const removeUnit = async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
        SELECT tu.id, tu.tool_id,
               EXISTS(
                 SELECT 1
                 FROM peminjaman_units pu
                 JOIN peminjaman p ON p.id = pu.peminjaman_id
                 WHERE pu.tool_unit_id = tu.id
                   AND p.status IN ('approved', 'dipinjam')
                 LIMIT 1
               ) as has_active_usage
        FROM tool_units tu
        WHERE tu.id = ?
          AND tu.tool_id = ?
        FOR UPDATE
      `,
      [req.params.unitId, req.params.id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Unit tidak ditemukan' });
    }

    if (rows[0].has_active_usage) {
      await connection.rollback();
      return res.status(400).json({ error: 'Unit sedang dipakai pada peminjaman aktif.' });
    }

    await connection.query('DELETE FROM tool_units WHERE id = ? AND tool_id = ?', [req.params.unitId, req.params.id]);
    await connection.query('CALL sp_sync_tool_stock(?)', [req.params.id]);

    await connection.commit();

    await auditLog(req.user.id, 'DELETE', 'tool_unit', req.params.unitId, {
      tool_id: Number(req.params.id),
    });

    res.json({ message: 'Unit berhasil dihapus' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Delete unit error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  validateTool,
  validateUnitPayload,
  getAll,
  getById,
  create,
  update,
  remove,
  updateStatus,
  uploadPhoto,
  getUnits,
  addUnits,
  updateUnit,
  removeUnit,
};
