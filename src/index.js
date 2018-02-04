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

const Log = function(metadata) {
  this.metadata = metadata;
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
const enabledLevels = _.takeWhile(allLevels, (v,i) => {
  return i <= levelsIndex;
});

_.templateSettings.interpolate =

Log.prototype.log = function(level, template, metadata) {
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
    console.log(JSON.stringify(localMetadata))
  } else {
    let {time, message, level, module} = localMetadata;
    delete localMetadata.message;
    delete localMetadata.level;
    delete localMetadata.time;
    delete localMetadata.module;
    module = module || 'global';
    console.log(yyyymmdd(time).blue, levelColors[level](level), `${module}>`.blue, message, _.map(localMetadata, (v,k) => k.green + ": " + JSON.stringify(v)).join(' '));
  }
};

Log.prototype.context = function(context) {
  return new Log(Object.assign({}, this.metadata, context));
};

Log.prototype.module = function(_module) {
  return this.context({ module: _module.filename.replace(/\.js$/i, '').replace(__dirname + "/", '') });
};

_.keys(levelColors).forEach(k => {
  Log.prototype[k] = function(message, metadata) {
    this.log(k, message, metadata);
  };
});

module.exports = new Log({});