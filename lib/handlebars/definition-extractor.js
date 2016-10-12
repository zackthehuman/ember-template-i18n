var Handlebars = require('handlebars');

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
  var result = {};

  if (node.hash && node.hash.pairs) {
    result = node.hash.pairs.reduce(function(tmp, curr) {
      var key = curr.key;
      var value = curr.value.original;
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
  var path = mustache.path.parts[0];
  var params = buildParams(mustache);
  var hash = buildHash(mustache);

  if (path === 't-def') {
    this.extractions.push({
      params: params,
      hash: hash
    });
  }

  return Handlebars.Visitor.prototype.MustacheStatement.call(this, mustache);
};

module.exports = DefinitionExtractor;
