module.exports = function (chromy, scenario, vp) {
  scenario._logger.log('SCENARIO > ' + scenario.label);
  require('./clickAndHoverHelper')(chromy, scenario);
  // add more ready handlers here...
};
