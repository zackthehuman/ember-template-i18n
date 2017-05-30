/**
  An HTMLBars AST transformation that updates all {{t}} statements to
  ensure they have a namespace argument.
*/
const path = require('path');

function EnsureTNamespace(options) {
  this.syntax = null;
  this.options = options;
}

EnsureTNamespace.prototype.transform = function EnsureTNamespace_transform(ast) {
  const traverse = this.syntax.traverse;
  const builders = this.syntax.builders;
  const options = this.options;

  traverse(ast, {
    MustacheStatement: function(node) {
      if (isT(node)) {
        ensureNamespace(node, builders, options);
      }
    },
    SubExpression: function(node) {
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
  const params = node.params;
  const templateModuleName = (options.moduleName || 'unknown').replace(/\.hbs$/, '');
  params.push(builders.string(templateModuleName));
}

module.exports = EnsureTNamespace;
