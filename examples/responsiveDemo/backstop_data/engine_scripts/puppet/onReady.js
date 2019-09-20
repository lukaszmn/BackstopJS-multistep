module.exports = async (page, scenario, vp) => {
  scenario._logger.log(`SCENARIO > ${scenario.label} (${vp.label})`, { scenario: scenario, viewport: vp });
  await require('./clickAndHoverHelper')(page, scenario);

  // add more ready handlers here...
};
