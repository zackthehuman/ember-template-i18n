/**
  An HTMLBars AST transformation that updates all {{t}} statements to
  ensure they have a namespace argument.
*/
var path = require('path');

function EnsureTNamespace(options) {
  this.syntax = null;
  this.options = options;
}

EnsureTNamespace.prototype.transform = function EnsureTNamespace_transform(ast) {
  var traverse = this.syntax.traverse;
  var builders = this.syntax.builders;
  var options = this.options;

  traverse(ast, {
    MustacheStatement(node) {
      if (isT(node)) {
        ensureNamespace(node, builders, options);
      }
    }
  });

  return ast;
};

function isT(node) {
  return node.path.original === 't';
}

function ensureNamespace(node, builders, options) {
  var params = node.params;
  var templateModuleName = options.moduleName || 'unknown';

  templateModuleName = templateModuleName.replace(/\.hbs$/, '');

  params.push(builders.string(templateModuleName));
}

module.exports = EnsureTNamespace;
