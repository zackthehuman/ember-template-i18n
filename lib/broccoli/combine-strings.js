var Plugin     = require('broccoli-caching-writer');
var fs         = require('fs-extra');
var partial    = require('lodash.partial');
var groupBy    = require('lodash.groupby');
var assign     = require('lodash.assign');
var merge      = require('lodash.merge');
var path       = require('path');
var walkSync   = require('walk-sync');

CombineStrings.prototype = Object.create(Plugin.prototype);
CombineStrings.prototype.constructor = CombineStrings;

function CombineStrings(inputNodes, options) {
  this.options = options || {};

  Plugin.call(this, inputNodes, {
    annotation: this.options.annotation
  });
}

CombineStrings.prototype.build = function() {
  toDisk(
    path.join(this.outputPath, 'strings.js'),
    this.inputPaths
      .map(getAllFiles)
      .map(toFileDescriptor)
      .reduce(toCombined, {})
  );
};

function getAllFiles(inputPath) {
  return {
    baseDir: inputPath,
    files: walkSync(inputPath, {
      directories: false
    })
  };
}

function toFileDescriptor(fileBatch) {
  return {
    files: fileBatch.files.map(function(relativePath) {
      var fullPath = path.join(fileBatch.baseDir, relativePath);
      var contents = fs.readFileSync(fullPath, 'utf8');

      return {
        relativePath: relativePath,
        contents: contents
      };
    })
  };
}

function toCombined(reduced, fileBatch) {
  var localeGroups = groupBy(fileBatch.files, identifyLocale);
  var combined = Object.keys(localeGroups).reduce(function combineLocale(blob, locale) {
    var modules = localeGroups[locale];

    blob[locale] = {};

    modules.forEach(function mergeEntries(descriptor) {
      var moduleName = descriptor.relativePath.slice(0, -('_en_US.properties'.length));
      var contents = JSON.parse(descriptor.contents);
      blob[locale][moduleName] = assign(blob[locale][moduleName], contents);
    });

    return blob;

  }, {});

  return merge(reduced, combined);
}

function identifyLocale(fileDescriptor) {
  var basename = path.basename(fileDescriptor.relativePath, '.properties');
  return basename.slice(-5);
}

function toDisk(outputPath, stringMap) {
  var contents = 'export default ' + JSON.stringify(stringMap, null, 2) + ';';
  fs.ensureFileSync(outputPath);
  fs.writeFileSync(outputPath, contents, 'utf8');
  return stringMap;
}

module.exports = CombineStrings;
