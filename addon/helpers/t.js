import Ember from 'ember';

const {
  get,
  observer
} = Ember;

export function translate(params) {
  const key = params[0];
  const locale = params[1];
  const ns = params[2];
  const strings = require('ember-template-i18n/utils/strings')['default'];
  return get(strings, `${locale}.${ns}.${key}`);
}

export default Ember.Helper.extend({
  i18n: Ember.inject.service('i18n'),

  compute: function(params) {
    const i18n = get(this, 'i18n');
    const locale = get(i18n, 'interfaceLocale');

    return i18n.getMessage(locale, params[1], params[0]);
  },

  interfaceLocaleChanged: observer('i18n.interfaceLocale', function() {
    this.recompute();
  })
});
