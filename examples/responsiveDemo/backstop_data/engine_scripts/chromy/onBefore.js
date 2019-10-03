module.exports = function (chromy, scenario, vp) {
  require('./loadCookies')(chromy, scenario, vp);

  // IGNORE ANY CERT WARNINGS
  chromy.ignoreCertificateErrors();
};
