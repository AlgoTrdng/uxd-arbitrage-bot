module.exports = {
  apps: [{
    name: 'uxd-arbitrage-bot',
    script: 'dist/index.js',
    error_file: './err.log',
    out_file: './out.log',
    log_date_format: 'YYYY-MM-DD HH:mm',
  }],
}
