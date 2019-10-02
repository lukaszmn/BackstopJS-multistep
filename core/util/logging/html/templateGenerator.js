const fs = require('fs');
const path = require('path');
const open = require('opn');

class TemplateGenerator {
  constructor (path) {
    this.path = path;

    /** @type {{ scenario: any; viewport: any; log: string; browser: string; comparer: string; }[]} */
    this.rows = [];

    /** @type {string[]} */
    this.messages = [];

    this.template = '';
    this.rowTemplate = '';
    this.title = '';
  }

  init (title) {
    this._loadTemplate();

    this.title = title;
    const json = this._getData();
    const html = this.template.replace('{{title}}', this.title);
    fs.writeFileSync(this.path, json + html);

    open(this.path, { wait: false });
  }

  end () {
    const file = fs.readFileSync(this.path).toString();

    const fileWithoutRefresh = file.replace('setTimeout(()', '//setTimeout(()');

    fs.writeFileSync(this.path, fileWithoutRefresh);
  }

  load () {
    this._loadTemplate();
    const data = this._loadData();
    this._loadRowTemplate();

    this.title = data.title;
    this.rows = data.rows;
    this.messages = data.messages;
  }

  _loadTemplate () {
    const templateUrl = path.resolve(__dirname, 'template.html');
    this.template = fs.readFileSync(templateUrl).toString();
  }

  _loadRowTemplate () {
    const START = '{{template-start}}';
    const start = this.template.indexOf(START);
    const end = this.template.indexOf('{{template-end}}');
    this.rowTemplate = this.template.substring(start + START.length, end);
  }

  _loadData () {
    const file = fs.readFileSync(this.path).toString();

    const start = 4; // <!--
    const end = file.indexOf(';;;-->');
    const str = file.substring(start, end);

    return JSON.parse(str);
  }

  addMessage (color, message) {
    this.messages.push(`<li style="background: ${color}">${message}`);
  }

  addContext (color, message, context) {
    const row = this._getOrAddRow(context);
    this._updateRow(row, color, message, context);
  }

  _getOrAddRow (context) {
    const scenario = context.scenario && context.scenario.label;
    const viewport = context.viewport && context.viewport.label;

    if (scenario) {
      const found = this.rows.find(r => r.scenario === scenario && r.viewport === viewport);
      if (found) {
        return found;
      }
    }

    return this._addRow(context);
  }

  _addRow (context) {
    const row = {
      scenario: context.scenario && context.scenario.label,
      viewport: context.viewport && context.viewport.label,
      log: '',
      browser: '',
      comparer: ''
    };
    this.rows.push(row);
    return row;
  }

  _updateRow (row, color, message, context) {
    message = `<p><span style="background: ${color}">${message}</span>`;
    switch (context.stage) {
      case 'browser':
        row.browser += message;
        break;

      case 'compare':
        if (context.result === false) {
          message += '<br><h2 style="background:lightcoral">FAILURE</h2>';
        } else if (context.result === true) {
          message += '<br><h2 style="background:lightgreen">SUCCESS</h2>';
        }

        row.comparer += message;
        break;

      default:
        row.log += message;
    }
  }

  save () {
    const json = this._getData();
    const html = this._getHtml();
    fs.writeFileSync(this.path, json + html);
  }

  _getData () {
    const json = JSON.stringify({ title: this.title, rows: this.rows, messages: this.messages });
    return `<!--${json};;;-->`;
  }

  _getHtml () {
    const t1 = this.template.replace('{{title}}', this.title);
    const t2 = this._fillHtmlRows(t1);
    return this._fillHtmlMessages(t2);
  }

  _fillHtmlRows (template) {
    const PLACEHOLDER = '<!--{{insert-template}}-->';
    const rows = this.rows.map(r => this._getHtmlRow(r)).join('\n');
    return template.replace(PLACEHOLDER, rows);
  }

  _getHtmlRow (row) {
    const NB = '&nbsp;';
    return this.rowTemplate
      .replace('{{scenario}}', row.scenario || NB)
      .replace('{{viewport}}', row.viewport || NB)
      .replace('{{log}}', row.log || NB)
      .replace('{{browser}}', row.browser || NB)
      .replace('{{comparer}}', row.comparer || NB);
  }

  _fillHtmlMessages (template) {
    const PLACEHOLDER = '<!--{{misc}}-->';
    const messages = this.messages.join('\n');
    return template.replace(PLACEHOLDER, messages);
  }
}

module.exports = TemplateGenerator;
