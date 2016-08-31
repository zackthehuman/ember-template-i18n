var Plugin   = require('broccoli-caching-writer');
var fs       = require('fs-extra');
var partial  = require('lodash.partial');
var path     = require('path');
var walkSync = require('walk-sync');

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
      var fullPath = path.join(fileBatch.baseDir, relativePath);
      var contents = fs.readFileSync(fullPath, 'utf8');

      return {
        relativePath: relativePath,
        contents: contents
      };
    })
  };
}

function toExtractions(fileBatch) {
  console.log(JSON.stringify(fileBatch, null, 2));
  return fileBatch;
}

function toDisk(outputPath, extractions) {
  extractions.files.forEach(function writeToDisk(fileDescriptor) {
    var fullOutPath = path.join(outputPath, fileDescriptor.relativePath);
    var contents = {
      text: fileDescriptor.contents.toString()
    };

    fs.ensureFileSync(fullOutPath);
    fs.writeJsonSync(fullOutPath, contents, 'utf8');
  });

  return extractions;
}

module.exports = ExtractToJson;
