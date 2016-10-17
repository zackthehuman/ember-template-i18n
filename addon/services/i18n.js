import Ember from 'ember';

const { computed } = Ember;

export default Ember.Service.extend({
  interfaceLocale: 'en_US',

  stringMap: computed(function() {
    return require('ember-template-i18n/utils/strings')['default'];
  }).readOnly(),

  getMessage(locale, namespace, key) {
    return this.get(`stringMap.${locale}.${namespace}.${key}`);
  }
});
