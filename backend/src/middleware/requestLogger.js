const requestLogger = (req, res, next) => {
  const start = Date.now();
  const isProd = process.env.NODE_ENV === 'production';

  const safeHeaders = {
    ...(req.headers || {}),
  };
  // Mask auth header
  if (safeHeaders.authorization) {
    safeHeaders.authorization = `${safeHeaders.authorization.substring(0, 16)}...`;
  }

  const safeBody = (() => {
    try {
      const body = typeof req.body === 'object' ? { ...req.body } : req.body;
      if (body && typeof body === 'object') {
        if (body.password) body.password = '***';
        if (body.refresh_token) body.refresh_token = `${String(body.refresh_token).substring(0, 8)}...`;
      }
      return body;
    } catch {
      return undefined;
    }
  })();

  const logBase = {
    method: req.method,
    url: req.originalUrl || req.url,
    headers: isProd ? undefined : safeHeaders,
    body: isProd ? undefined : safeBody,
  };

console.info('➡️  Request', logBase);

  // Intercept JSON responses to log body details in non-production
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const duration = Date.now() - start;
    const meta = {
      status: res.statusCode,
      durationMs: duration,
      method: req.method,
      url: req.originalUrl || req.url,
    };

    if (!isProd) {
      const isError = res.statusCode >= 400 || (body && body.success === false);
      const level = isError ? 'error' : 'info';
      console[level](`⬅️  Response${isError ? ' (error)' : ''}`, { ...meta, body });
    } else {
      console.info('⬅️  Response', meta);
    }

    return originalJson(body);
  };

  const onFinish = () => {
    res.removeListener('finish', onFinish);
    const duration = Date.now() - start;
    const meta = {
      status: res.statusCode,
      durationMs: duration,
      method: req.method,
      url: req.originalUrl || req.url,
    };
    // Keep a lightweight finish log to trace non-JSON responses
    if (isProd) {
      console.info('⬅️  Response', meta);
    }
  };

  res.on('finish', onFinish);
  next();
};

module.exports = { requestLogger };