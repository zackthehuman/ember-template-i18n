const Plugin     = require('broccoli-caching-writer');
const fs         = require('fs-extra');
const Handlebars = require('handlebars');
const partial    = require('lodash.partial');
const path       = require('path');
const walkSync   = require('walk-sync');
const Extractor  = require('../handlebars/definition-extractor');

ExtractToJson.prototype = Object.create(Plugin.prototype);
ExtractToJson.prototype.constructor = ExtractToJson;

function ExtractToJson(inputNodes, options) {
  this.options = options || {};

  Plugin.call(this, inputNodes, {
    annotation: this.options.annotation
  });
}

ExtractToJson.prototype.build = function() {
  this.inputPaths
    .map(getAllFiles)
    .map(toFileDescriptor)
    .map(toExtractions)
    .forEach(partial(toDisk, this.outputPath));
    // cache has been busted
    // do anything, for example:
    //   1. read from this.inputPaths
    //   2. do something based on the result
    //   3. and then, write to this.outputPath
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

function toExtractions(fileBatch) {
  // console.log(JSON.stringify(fileBatch, null, 2));
  return {
    files: fileBatch.files.map(function extractDefinitions(file) {
      const ast = Handlebars.parse(file.contents);
      const extractor = new Extractor();

      extractor.accept(ast);

      const extractions = extractor.extractions.reduce(function(result, item) {
        result[item.hash.key] = item.params[0];
        return result;
      }, {});

      return {
        relativePath: file.relativePath,
        contents: file.contents,
        extractions: extractions
      };
    })
  };

  return fileBatch;
}

function toDisk(outputPath, extractions) {
  extractions.files.forEach(function writeToDisk(fileDescriptor) {
    const fullOutPath = path.join(outputPath, fileDescriptor.relativePath);
    const contents = {
      extractions: fileDescriptor.extractions
    };

    fs.ensureFileSync(fullOutPath);
    fs.writeJsonSync(fullOutPath, fileDescriptor.extractions, 'utf8');
  });

  return extractions;
}

module.exports = ExtractToJson;
