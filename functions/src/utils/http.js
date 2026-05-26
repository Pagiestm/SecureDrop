const setCorsHeaders = (req, res) => {
  const origin = req?.get('Origin');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req?.get('Access-Control-Request-Headers') || 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  if (req?.get('Access-Control-Request-Private-Network') === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
};

module.exports = { setCorsHeaders };
