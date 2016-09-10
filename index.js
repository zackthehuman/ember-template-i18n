/* jshint node: true */
'use strict';

var Addon         = require('./lib/models/i18n-addon');
var ExtractToJson = require('./lib/broccoli/extract-to-json');
var Funnel        = require('broccoli-funnel');
var stew          = require('broccoli-stew');
var mergeTrees    = require('broccoli-merge-trees');
var logger        = require('heimdalljs-logger')('main-i18n');
var path          = require('path');

var ADDON_NAME = 'ember-template-i18n';
var SECRET_REGISTRY = ADDON_NAME + '-secret-registry';

module.exports = Addon.extend({
  name: ADDON_NAME,

  included: function (app) {
    this._super.included.apply(this, arguments);
    this.setupPreprocessorRegistry(SECRET_REGISTRY, this._findHost().registry);
  },

  setupPreprocessorRegistry: function(type, registry) {
    if (type === SECRET_REGISTRY) {
      this.parentRegistry = registry;

      registry.add(SECRET_REGISTRY, {
        name: '[ember-template-i18n] extraction for "' + this.getParentName() + '"',
        addon: this
      });
    } else if (type === 'parent') {
      if (this.isNestedAddon()) {
        logger.info('inside of another addon: ', this.getParentName(), '\n');
      } else {
        logger.info('inside of an app: ', this.getParentName(), '\n');
      }

      registry.add('template', {
        name: '[ember-template-i18n] templates for "' + this.getParentName() + '"',
        ext: 'hbs',
        _addon: this,

        toTree: function(tree) {
          this._addon._treeForExtraction = new ExtractToJson([tree]);
          return tree;
        }
      });
    }
  },

  treeForPublic: function(tree) {
    var publicTree = this._super.treeForPublic.apply(this, arguments);
    var trees = [publicTree];

    if (!this.isNestedAddon()) {
      var pluginWrappers = this.parentRegistry.load(SECRET_REGISTRY);
      var translationTrees = mergeTrees(pluginWrappers.map(function(plugin) {
        var addon = plugin.addon;
        return addon._treeForTranslation();
      }).filter(Boolean), {
        overwrite: true
      });

      trees.push(translationTrees);
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
