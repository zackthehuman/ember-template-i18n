/* jshint node: true */
'use strict';

var Addon         = require('./lib/models/i18n-addon');
var ExtractToJson = require('./lib/broccoli/extract-to-json');
var Funnel        = require('broccoli-funnel');
var stew          = require('broccoli-stew');
var mergeTrees    = require('broccoli-merge-trees');
var logger        = require('heimdalljs-logger')('main-i18n');
var path          = require('path');

var ADDON_NAME      = 'ember-template-i18n';
var PARENT          = 'parent';
var SECRET_REGISTRY = ADDON_NAME + '-secret-registry';

module.exports = Addon.extend({
  name: ADDON_NAME,

  included: function (app) {
    this._super.included.apply(this, arguments);
    this.setupPreprocessorRegistry(SECRET_REGISTRY, this._findHost().registry);
  },

  setupPreprocessorRegistry: function(type, registry) {
    switch(type) {
      case PARENT:
        this.parentPreprocessorRegistrations(registry);
        break;
      case SECRET_REGISTRY:
        this.translationPreprocessorRegistrations(registry);
        break;
      default:
        break;
    }
  },

  translationPreprocessorRegistrations: function(registry) {
    this.parentRegistry = registry;

    registry.add(SECRET_REGISTRY, {
      name: '[' + ADDON_NAME + '] extraction for "' + this.getParentName() + '"',
      addon: this
    });
  },

  parentPreprocessorRegistrations: function(registry) {
    if (this.isAppAddon()) {
      logger.info('inside of an app: ', this.getParentName(), '\n');
    } else {
      logger.info('inside of another addon: ', this.getParentName(), '\n');
    }

    registry.add('template', {
      name: '[' + ADDON_NAME + '] templates for "' + this.getParentName() + '"',
      ext: 'hbs',
      _addon: this,

      toTree: function(tree) {
        this._addon._treeForExtraction = new ExtractToJson([tree]);
        return tree;
      }
    });
  },

  treeForPublic: function(tree) {
    var publicTree = this._super.treeForPublic.apply(this, arguments);
    var translationTree;
    var trees = [];

    if (this.isAppAddon()) {
      var pluginWrappers = this.parentRegistry.load(SECRET_REGISTRY);

      pluginWrappers.forEach(function(plugin) {
        trees.push(plugin.addon._treeForTranslation());
      });
    }

    trees = trees.filter(Boolean);

    if (trees.length) {
      translationTree = new Funnel(mergeTrees(trees, { overwrite: true }), {
        destDir: path.join('i18n', 'properties')
      });
    }

    return mergeTrees([translationTree, publicTree].filter(Boolean));
  }
});
