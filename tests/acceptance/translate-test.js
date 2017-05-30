import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | translate');

test('Translation strings are rendering properly', function(assert) {
  visit('/translate');

  andThen(function() {
    assert.equal(find('#string-1').text(), 'This string is from a route template (translate.hbs)');
  });
});
