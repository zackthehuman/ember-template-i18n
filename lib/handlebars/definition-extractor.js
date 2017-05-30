'use strict';

const Handlebars = require('handlebars');

function getStringLiteralValue(node) {
  if (node.type === 'StringLiteral') {
    return node.value;
  }

  return null;
}

function buildParams(node) {
  return (node.params && node.params.map(getStringLiteralValue)) || [];
}

function buildHash(node) {
  let result = {};

  if (node.hash && node.hash.pairs) {
    result = node.hash.pairs.reduce(function(tmp, curr) {
      const key = curr.key;
      const value = curr.value.original;
      tmp[key] = value;
      return tmp;
    }, result);
  }

  return result;
}

function DefinitionExtractor() {
  this.extractions = [];
}

DefinitionExtractor.prototype = new Handlebars.Visitor();

DefinitionExtractor.prototype.MustacheStatement = function acceptMustacheStatement(mustache) {
  const path = mustache.path.parts[0];
  const params = buildParams(mustache);
  const hash = buildHash(mustache);

  if (path === 't-def') {
    this.extractions.push({
      params: params,
      hash: hash
    });
  }

  return Handlebars.Visitor.prototype.MustacheStatement.call(this, mustache);
};

module.exports = DefinitionExtractor;
