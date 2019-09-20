module.exports = function (chromy, scenario, vp) {
  scenario._logger.log(`SCENARIO > ${scenario.label} (${vp.label})`, { scenario: scenario, viewport: vp });
  require('./clickAndHoverHelper')(chromy, scenario);
  // add more ready handlers here...
};
