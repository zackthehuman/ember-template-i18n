/**
  An HTMLBars AST transformation that removes all {{t-def}} statements.
*/

function RemoveAllTDefStatements() {
  this.syntax = null;
}

RemoveAllTDefStatements.prototype.transform = function RemoveAllTDefStatements_transform(ast) {
  var traverse = this.syntax.traverse;

  traverse(ast, {
    MustacheStatement(node) {
      if (isTDef(node)) {
        return null;
      }
    }
  });

  return ast;
};

function isTDef(node) {
  return node.path.original === 't-def';
}

module.exports = RemoveAllTDefStatements;
