const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

module.exports = {
  checkExpressServer: function (SERVER_PORT, EXPRESS_CHECK_INTERVAL, MAX_EXPRESS_WAIT, log, LogLevel, http) {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = MAX_EXPRESS_WAIT / EXPRESS_CHECK_INTERVAL;
      log(LogLevel.DEBUG, `Waiting for Express server on port ${SERVER_PORT}...`);

      const checkPort = () => {
        attempts++;
        const req = http.get(`http://localhost:${SERVER_PORT}/api/health`, (res) => {
          if (res.statusCode === 200) {
            log(LogLevel.INFO, `Express server is ready on port ${SERVER_PORT}`);
            resolve(true);
          } else {
            retry();
          }
        }).on('error', retry);

        req.setTimeout(500, () => {
          req.abort();
          retry();
        });

        function retry() {
          if (attempts >= maxAttempts) {
            log(LogLevel.ERROR, `Express server failed to start within ${MAX_EXPRESS_WAIT}ms`);
            resolve(false);
          } else {
            setTimeout(checkPort, EXPRESS_CHECK_INTERVAL);
          }
        }
      };
      checkPort();
    });
  }
};
