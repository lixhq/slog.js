const _ = require('lodash');
const colors = require('colors');

function pad(x) { return x > 9 ? x : `0${x}`; }
function yyyymmdd(date) {
  const mm = date.getMonth() + 1,
        dd = date.getDate(),
        hh = date.getHours(),
        MM = date.getMinutes(),
        ss = date.getSeconds();

  return `${date.getFullYear()}/${pad(mm)}/${pad(dd)}-${pad(hh)}:${pad(MM)}:${pad(ss)}`;
}

const Log = function(metadata, formatting) {
  this.metadata = metadata;
  this.formatting = formatting;
};

const caching = {};

const levelColors = {
  emerg: colors.red, alert: colors.red, crit: colors.red, error: colors.red, warn: colors.yellow, notice: colors.white, info: colors.white, debug: colors.gray
};

const logLevelValue = process.env.SLOG_LOG_LEVEL ? process.env.SLOG_LOG_LEVEL.toLowerCase() : 'debug';
const allLevels = [
  'emerg',
  'alert',
  'crit',
  'error',
  'warn',
  'notice',
  'info',
  'debug',
];
const levelsIndex = _.findIndex(allLevels, x => x === logLevelValue);
if(levelsIndex === -1) {
  throw new Error(`Could not understand SLOG_LOG_LEVEL="${logLevelValue}". Valid values are ${allLevels.join(',')}`);
}
const levels = _(allLevels)
.map((v, i) => [v, i <= levelsIndex])
.fromPairs()
.value();

Log.prototype.log = function(level, template, metadata, formatting) {
  if(levels[level] === false) return;
  const localMetadata = Object.assign({}, this.metadata, metadata || {});
  localMetadata.time = new Date();
  localMetadata.level = level;
  localMetadata.template = template;
  if(!caching[template]) {
    caching[template] = _.template(template, {
      interpolate: /@([a-zA-Z]+)/g,
      //escape: null,
      evaluate: /@\{([^\}]+)\}/g
    });
  }
  localMetadata.message = caching[template](localMetadata);
  if(process.env.SLOG_LOG_JSON && process.env.SLOG_LOG_JSON.toLowerCase() === 'true') {
    console.log(JSON.stringify(_.mapValues(localMetadata, (data,key) => {
      switch(this.formatting[key] || 'info') {
        case 'error':
          return data ? data.stack || data.toString() : data
        case 'info':
        default:
          return data;
      }
    })))
  } else {
    const noOfColumns = process.stdout.isTTY ? process.stdout.columns : 50;
    let {time, message, level, module} = localMetadata;
    delete localMetadata.message;
    delete localMetadata.level;
    delete localMetadata.time;
    delete localMetadata.module;
    module = module || 'global';
    metadataTyped = _.map(localMetadata, (data,key) => ({
      type: this.formatting[key] || 'info',
      data,
      key,
    }));
    let metadataPrinted = metadataTyped.filter(({type}) => type !== 'error').map(({type,data,key}) => {
      switch(type) {
        case 'info':
        default:
          return key.green + ": " + JSON.stringify(data)
      }
    }).join(' ')
    errors = metadataTyped.filter(({type}) => type === 'error');
    if(errors.length > 0) {
      metadataPrinted += "\n" + errors.map(({data, key}) => {
        const prefix = `└┬─ ${key} `;
        return `${prefix}${_.repeat('─', noOfColumns-prefix.length)}\n`.red + (data ? data.stack || data.toString() : '').replace(/^/gm, ` │ `.red) + `\n └${_.repeat('─', noOfColumns-2)}`.red;
      }).join('\n')
    }
    console.log(yyyymmdd(time).blue, levelColors[level](level), `${module}>`.blue, message, metadataPrinted);
  }
};

Log.prototype.defaultLogFormatting = { error: 'error' };

Log.prototype.context = function(context) {
  return new Log(Object.assign({}, this.metadata, context), this.formatting);
};

Log.prototype.formatting = function(formatting) {
  return new Log(this.context, formatting);
};

Log.prototype.module = function(_module) {
  return this.context({ module: _module.filename.replace(/\.js$/i, '').replace(__dirname + "/", '') });
};

_.keys(levelColors).forEach(k => {
  Log.prototype[k] = function(message, metadata, formatting) {
    this.log(k, message, metadata, formatting);
  };
});

module.exports = new Log({}, Log.prototype.defaultLogFormatting);