'use strict';

const Plugin     = require('broccoli-caching-writer');
const fs         = require('fs-extra');
const partial    = require('lodash.partial');
const groupBy    = require('lodash.groupby');
const assign     = require('lodash.assign');
const merge      = require('lodash.merge');
const path       = require('path');
const walkSync   = require('walk-sync');

const DEFAULT_OPTIONS = {
  outFile: 'strings.js'
};

CombineStrings.prototype = Object.create(Plugin.prototype);
CombineStrings.prototype.constructor = CombineStrings;

function CombineStrings(inputNodes, options) {
  this.options = merge({}, DEFAULT_OPTIONS, options || {});

  Plugin.call(this, inputNodes, {
    annotation: this.options.annotation
  });
}

CombineStrings.prototype.build = function() {
  toDisk(
    path.join(this.outputPath, this.options.outFile),
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
      const fullPath = path.join(fileBatch.baseDir, relativePath);
      const contents = fs.readFileSync(fullPath, 'utf8');

      return {
        relativePath: relativePath,
        contents: contents
      };
    })
  };
}

function toCombined(reduced, fileBatch) {
  const localeGroups = groupBy(fileBatch.files, identifyLocale);
  const combined = Object.keys(localeGroups).reduce(function combineLocale(blob, locale) {
    const modules = localeGroups[locale];

    blob[locale] = {};

    modules.forEach(function mergeEntries(descriptor) {
      const moduleName = descriptor.relativePath.slice(0, -('_en_US.properties'.length));
      const contents = JSON.parse(descriptor.contents);
      blob[locale][moduleName] = assign(blob[locale][moduleName], contents);
    });

    return blob;

  }, {});

  return merge(reduced, combined);
}

function identifyLocale(fileDescriptor) {
  const basename = path.basename(fileDescriptor.relativePath, '.properties');
  return basename.slice(-5);
}

function toDisk(outputPath, stringMap) {
  const contents = 'export default ' + JSON.stringify(stringMap, null, 2) + ';';
  fs.ensureFileSync(outputPath);
  fs.writeFileSync(outputPath, contents, 'utf8');
  return stringMap;
}

module.exports = CombineStrings;
