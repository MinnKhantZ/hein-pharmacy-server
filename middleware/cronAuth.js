/**
 * Middleware to authenticate requests from external cron services
 * Requires CRON_API_KEY environment variable to be set
 */
const authenticateCron = (req, res, next) => {
  const apiKey = req.headers['x-cron-api-key'] || req.query.api_key;
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'API key required',
      message: 'Please provide X-Cron-Api-Key header or api_key query parameter'
    });
  }

  const expectedKey = process.env.CRON_API_KEY;
  
  if (!expectedKey) {
    console.error('CRON_API_KEY environment variable not set');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'Cron API key not configured on server'
    });
  }

  if (apiKey !== expectedKey) {
    return res.status(403).json({ 
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }

  next();
};

module.exports = { authenticateCron };
