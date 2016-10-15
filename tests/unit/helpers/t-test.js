import { translate } from 'dummy/helpers/t';
import { module, test } from 'qunit';

module('Unit | Helper | t');

test('it returns the key string', function(assert) {
  let result = translate(['foo_bar']);
  assert.equal(result, 't(foo_bar)');
});
