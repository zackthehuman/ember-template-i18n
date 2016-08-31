/* jshint node: true */
'use strict';

var Addon         = require('./lib/models/i18n-addon');
var ExtractToJson = require('./lib/broccoli/extract-to-json');
var Funnel        = require('broccoli-funnel');
var stew          = require('broccoli-stew');
var mergeTrees    = require('broccoli-merge-trees');
var path          = require('path');

module.exports = Addon.extend({
  name: 'ember-template-i18n',

  setupPreprocessorRegistry: function(type, registry) {
    if (type === 'parent') {
      if (this.isNestedAddon()) {
        console.log('inside of another addon: ', this.getParentName(), '\n');
      } else {
        console.log('inside of an app: ', this.getParentName(), '\n');
      }

      registry.add('template', {
        name: '[ember-template-i18n] extraction for "' + this.getParentName() + '"',
        ext: 'hbs',
        _addon: this,

        toTree: function(tree) {
          this._addon._treeForExtraction = new ExtractToJson([tree]); // tree to extract i18n strings from

          // return stew.log(tree, {
          //   output: 'tree',
          //   label: 'preprocess - ' + type + ' - template / ' + this._addon.getParentName()
          // });

          return tree;
        }
      });
    }
  },

  treeForPublic: function(tree) {
    var publicTree = this._super.treeForPublic.apply(this, arguments);
    var trees = [publicTree];

    if (!this.isNestedAddon()) {
      // When this addon is the child of an app, it has to find any other
      // instances of itself (which were included in other addons) and get
      // their trees for translation.
      var i18nTrees = mergeTrees(this._collectTranslationTrees(), {
        // Hello wandering developer!
        // You may be wondering why we "overwrite: true" here. Well, I've got
        // some interesting news for you!
        //
        // Addons can include other addons. Apps can include addons. Apps can
        // also include addons which include other addons. This means that
        // it is possible to have multiple _instances_ of the same addon that
        // operate on different parents. If an addon that uses _this_ addon is
        // included multiple times, then it will cause two copies of the same
        // tree/node to exist. When it comes time to merge them, there will be
        // blood.
        //
        // So it's safe to overwrite here since the duplicate trees are the
        // same files anyway.
        //
        // Happy coding!
        overwrite: true
      });

      // Push "other addon's" translation trees
      trees.push(i18nTrees);
    }

    trees = trees.filter(Boolean);

    if (trees.length) {
      return new Funnel(mergeTrees(trees), {
        destDir: path.join('i18n', 'properties')
      });
    }

    return publicTree;
  }
});
