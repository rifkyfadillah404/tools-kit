const pool = require('../config/database');

const auditLog = async (actorId, action, entityType, entityId, metadata = {}, ipAddress = null) => {
  try {
    const description = metadata && Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;

    await pool.query(
      'INSERT INTO log_aktivitas (user_id, action, entity_type, entity_id, description, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [actorId ?? null, action, entityType, entityId ?? null, description, ipAddress]
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

const auditMiddleware = (action, entityType, getEntityId = () => null) => {
  return async (req, res, next) => {
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);

    const logIfSuccess = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          const entityId = getEntityId(req, body);
          void auditLog(req.user.id, action, entityType, entityId, {
            method: req.method,
            path: req.path,
            body: req.body,
          }, req.ip);
        } catch (error) {
          // Ignore logging errors
        }
      }
    };

    res.send = function (body) {
      logIfSuccess(body);
      return originalSend(body);
    };

    res.json = function (body) {
      logIfSuccess(body);
      return originalJson(body);
    };

    next();
  };
};

module.exports = { auditLog, auditMiddleware };
